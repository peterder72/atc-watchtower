import type { EngineFeedState, EngineSnapshot, FeedSelection } from '../domain/models';
import { GateDetector, summarizeFrame } from './gateDetector';
import { PriorityStrategy } from './priorityStrategy';

interface FeedRuntime {
  selection: FeedSelection;
  state: EngineFeedState;
  element: HTMLAudioElement;
  sourceNode: MediaElementAudioSourceNode;
  gainNode: GainNode;
  analyzerNode: AnalyserNode;
  analysisBuffer: Float32Array<ArrayBuffer>;
  gateDetector: GateDetector;
  filterHigh: BiquadFilterNode;
  filterLow: BiquadFilterNode;
}

type SnapshotListener = (snapshot: EngineSnapshot) => void;

const ANALYSIS_INTERVAL_MS = 50;
const LEVEL_EPSILON = 0.002;

function stripPrioritySuffix(debug: string | undefined): string {
  if (!debug) {
    return 'media element graph active';
  }

  return debug
    .replace(/ · floor owner$/, '')
    .replace(/ · suppressed by priority$/, '');
}

function describeMediaError(error: MediaError | null): string {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'Playback aborted.';
    case MediaError.MEDIA_ERR_NETWORK:
      return 'Network error while loading the stream.';
    case MediaError.MEDIA_ERR_DECODE:
      return 'Browser could not decode the stream.';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'Stream source is not supported in this browser.';
    default:
      return 'Failed to play stream.';
  }
}

export class PriorityAudioEngine {
  private context: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  private analysisSink: GainNode | null = null;

  private readonly runtimes = new Map<string, FeedRuntime>();

  private readonly strategy = new PriorityStrategy();

  private readonly listeners = new Set<SnapshotListener>();

  private running = false;

  private floorFeedId: string | null = null;

  private analysisTimerId: number | null = null;

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.buildSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): EngineSnapshot {
    return this.buildSnapshot();
  }

  async start(selections: FeedSelection[]): Promise<void> {
    await this.stop();

    this.context = new AudioContext({
      latencyHint: 'interactive'
    });
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.context.destination);

    this.analysisSink = this.context.createGain();
    this.analysisSink.gain.value = 0;
    this.analysisSink.connect(this.context.destination);

    await this.context.resume();

    this.running = true;
    this.floorFeedId = null;
    this.strategy.reset();

    selections.forEach((selection) => this.attachFeed(selection));
    this.emitSnapshot();

    this.analysisTimerId = window.setInterval(() => this.sampleAnalysis(), ANALYSIS_INTERVAL_MS);
    this.sampleAnalysis();
  }

  async stop(): Promise<void> {
    if (this.analysisTimerId !== null) {
      clearInterval(this.analysisTimerId);
      this.analysisTimerId = null;
    }

    for (const runtime of this.runtimes.values()) {
      runtime.element.pause();
      runtime.element.src = '';
      runtime.element.load();
      runtime.filterLow.disconnect();
      runtime.filterHigh.disconnect();
      runtime.analyzerNode.disconnect();
      runtime.gainNode.disconnect();
      runtime.sourceNode.disconnect();
    }

    this.runtimes.clear();
    this.strategy.reset();

    if (this.analysisSink) {
      this.analysisSink.disconnect();
      this.analysisSink = null;
    }

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    this.masterGain = null;
    this.running = false;
    this.floorFeedId = null;
    this.emitSnapshot();
  }

  setPriorities(priorities: Record<string, number>): void {
    for (const runtime of this.runtimes.values()) {
      const nextPriority = priorities[runtime.selection.feed.id];
      if (nextPriority === undefined) {
        continue;
      }

      runtime.selection.priority = nextPriority;
      runtime.state.priority = nextPriority;
      this.strategy.updatePriority(runtime.selection.feed.id, nextPriority);
    }

    this.applyFloorState();
  }

  private buildSnapshot(): EngineSnapshot {
    const feeds = Object.fromEntries(
      [...this.runtimes.entries()].map(([feedId, runtime]) => [feedId, { ...runtime.state }])
    );

    return {
      running: this.running,
      floorFeedId: this.floorFeedId,
      feeds
    };
  }

  private emitSnapshot(): void {
    const snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private attachFeed(selection: FeedSelection): void {
    if (!this.context || !this.masterGain || !this.analysisSink) {
      throw new Error('Audio engine is not initialized.');
    }

    const element = new Audio();
    element.crossOrigin = 'anonymous';
    element.src = selection.feed.streamUrl;
    element.preload = 'auto';
    element.setAttribute('playsinline', 'true');

    const sourceNode = this.context.createMediaElementSource(element);
    const gainNode = this.context.createGain();
    gainNode.gain.value = 0;
    sourceNode.connect(gainNode);
    gainNode.connect(this.masterGain);

    const filterHigh = this.context.createBiquadFilter();
    filterHigh.type = 'highpass';
    filterHigh.frequency.value = 300;

    const filterLow = this.context.createBiquadFilter();
    filterLow.type = 'lowpass';
    filterLow.frequency.value = 3400;

    const analyzerNode = this.context.createAnalyser();
    analyzerNode.fftSize = 1024;
    analyzerNode.minDecibels = -100;
    analyzerNode.maxDecibels = -10;
    analyzerNode.smoothingTimeConstant = 0;

    sourceNode.connect(filterHigh);
    filterHigh.connect(filterLow);
    filterLow.connect(analyzerNode);
    analyzerNode.connect(this.analysisSink);

    const runtimeState: EngineFeedState = {
      feedId: selection.feed.id,
      label: selection.feed.label,
      priority: selection.priority,
      isFloor: false,
      gateOpen: false,
      level: 0,
      peak: 0,
      status: 'loading',
      analysisMode: 'graph',
      readyState: element.readyState,
      networkState: element.networkState,
      currentTime: element.currentTime,
      paused: element.paused,
      captureTrackCount: 0,
      debug: 'media element graph active'
    };

    const runtime: FeedRuntime = {
      selection,
      state: runtimeState,
      element,
      sourceNode,
      gainNode,
      analyzerNode,
      analysisBuffer: new Float32Array(
        new ArrayBuffer(analyzerNode.fftSize * Float32Array.BYTES_PER_ELEMENT)
      ),
      gateDetector: new GateDetector({
        frameDurationMs: (analyzerNode.fftSize / this.context.sampleRate) * 1000,
        configuredFloorDb: -68,
        openDeltaDb: 7,
        closeGapDb: 4
      }),
      filterHigh,
      filterLow
    };

    this.runtimes.set(selection.feed.id, runtime);
    this.strategy.registerFeed(selection.feed.id, selection.priority, selection.order);

    element.addEventListener('playing', () => {
      runtime.state.status = 'ready';
      runtime.state.readyState = runtime.element.readyState;
      runtime.state.networkState = runtime.element.networkState;
      runtime.state.currentTime = runtime.element.currentTime;
      runtime.state.paused = runtime.element.paused;
      runtime.state.debug = 'receiving decoded audio';
      this.emitSnapshot();
    });

    element.addEventListener('canplay', () => {
      runtime.state.status = 'ready';
      runtime.state.readyState = runtime.element.readyState;
      runtime.state.networkState = runtime.element.networkState;
      runtime.state.currentTime = runtime.element.currentTime;
      runtime.state.paused = runtime.element.paused;
      runtime.state.debug = 'decoder ready';
      this.emitSnapshot();
    });

    element.addEventListener('waiting', () => {
      runtime.state.status = 'buffering';
      runtime.state.readyState = runtime.element.readyState;
      runtime.state.networkState = runtime.element.networkState;
      runtime.state.currentTime = runtime.element.currentTime;
      runtime.state.paused = runtime.element.paused;
      runtime.state.debug = 'waiting for stream data';
      this.emitSnapshot();
    });

    element.addEventListener('stalled', () => {
      runtime.state.status = 'buffering';
      runtime.state.readyState = runtime.element.readyState;
      runtime.state.networkState = runtime.element.networkState;
      runtime.state.currentTime = runtime.element.currentTime;
      runtime.state.paused = runtime.element.paused;
      runtime.state.debug = 'stream stalled';
      this.emitSnapshot();
    });

    element.addEventListener('error', () => {
      runtime.state.status = 'error';
      runtime.state.error = describeMediaError(runtime.element.error);
      runtime.state.readyState = runtime.element.readyState;
      runtime.state.networkState = runtime.element.networkState;
      runtime.state.currentTime = runtime.element.currentTime;
      runtime.state.paused = runtime.element.paused;
      runtime.state.debug = `media error code ${runtime.element.error?.code ?? 'unknown'}`;
      this.emitSnapshot();
    });

    void element.play().catch((error) => {
      runtime.state.status = 'error';
      runtime.state.error = error instanceof Error ? error.message : 'Playback start failed.';
      runtime.state.readyState = runtime.element.readyState;
      runtime.state.networkState = runtime.element.networkState;
      runtime.state.currentTime = runtime.element.currentTime;
      runtime.state.paused = runtime.element.paused;
      runtime.state.debug = 'play() rejected';
      this.emitSnapshot();
    });
  }

  private sampleAnalysis(): void {
    let snapshotChanged = false;
    let arbitrationChanged = false;

    for (const runtime of this.runtimes.values()) {
      runtime.state.readyState = runtime.element.readyState;
      runtime.state.networkState = runtime.element.networkState;
      runtime.state.currentTime = runtime.element.currentTime;
      runtime.state.paused = runtime.element.paused;

      runtime.analyzerNode.getFloatTimeDomainData(runtime.analysisBuffer);
      const summary = summarizeFrame(runtime.analysisBuffer);

      if (Math.abs(runtime.state.level - summary.rms) > LEVEL_EPSILON) {
        runtime.state.level = summary.rms;
        snapshotChanged = true;
      }

      if (Math.abs(runtime.state.peak - summary.peak) > LEVEL_EPSILON) {
        runtime.state.peak = summary.peak;
        snapshotChanged = true;
      }

      const nextStatus = this.deriveStatus(runtime);
      if (nextStatus !== runtime.state.status) {
        runtime.state.status = nextStatus;
        if (nextStatus === 'loading') {
          runtime.state.debug = 'awaiting first decoded audio frame';
        }
        if (nextStatus === 'buffering') {
          runtime.state.debug = 'stream buffering';
        }
        snapshotChanged = true;
      }

      const events = runtime.gateDetector.processFrame(runtime.selection.feed.id, runtime.analysisBuffer, performance.now());
      for (const event of events) {
        if (event.type === 'gate-open' && !runtime.state.gateOpen) {
          runtime.state.gateOpen = true;
          runtime.state.debug = `gate open · rms ${event.rms?.toFixed(3) ?? '0.000'} · peak ${event.peak?.toFixed(3) ?? '0.000'}`;
          this.strategy.onFeedEvent(event);
          arbitrationChanged = true;
          snapshotChanged = true;
        }

        if (event.type === 'gate-close' && runtime.state.gateOpen) {
          runtime.state.gateOpen = false;
          runtime.state.debug = `gate closed · rms ${event.rms?.toFixed(3) ?? '0.000'} · peak ${event.peak?.toFixed(3) ?? '0.000'}`;
          this.strategy.onFeedEvent(event);
          arbitrationChanged = true;
          snapshotChanged = true;
        }
      }
    }

    if (arbitrationChanged) {
      this.applyFloorState();
      return;
    }

    if (snapshotChanged) {
      this.emitSnapshot();
    }
  }

  private deriveStatus(runtime: FeedRuntime): EngineFeedState['status'] {
    if (runtime.state.status === 'error') {
      return 'error';
    }

    if (runtime.element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !runtime.element.paused) {
      return 'ready';
    }

    if (
      runtime.element.networkState === HTMLMediaElement.NETWORK_LOADING ||
      runtime.element.readyState >= HTMLMediaElement.HAVE_METADATA
    ) {
      return 'buffering';
    }

    return 'loading';
  }

  private applyFloorState(): void {
    this.floorFeedId = this.strategy.getFloorFeedId();

    for (const runtime of this.runtimes.values()) {
      const isFloor = runtime.selection.feed.id === this.floorFeedId && runtime.state.gateOpen;
      runtime.state.isFloor = isFloor;
      const baseDebug = stripPrioritySuffix(runtime.state.debug);
      runtime.state.debug = isFloor
        ? `${baseDebug} · floor owner`
        : runtime.state.gateOpen
          ? `${baseDebug} · suppressed by priority`
          : baseDebug;

      const now = this.context?.currentTime ?? 0;
      runtime.gainNode.gain.cancelScheduledValues(now);
      runtime.gainNode.gain.setValueAtTime(runtime.gainNode.gain.value, now);
      runtime.gainNode.gain.linearRampToValueAtTime(isFloor ? 1 : 0, now + 0.02);
    }

    this.emitSnapshot();
  }
}
