import {
  DEFAULT_AUDIO_PROCESSING_SETTINGS,
  MAX_ATTACK_MS,
  DEFAULT_SQUELCH_THRESHOLD_DB,
  normalizeAudioProcessingSettings,
  type AudioProcessingSettings,
  type FeedActivityEvent,
  type EngineFeedState,
  type EngineSnapshot,
  type FeedSelection
} from '../domain/models';
import { GateDetector, summarizeFrame } from './gateDetector';
import { PriorityStrategy } from './priorityStrategy';

interface FeedRuntime {
  selection: FeedSelection;
  state: EngineFeedState;
  element: HTMLAudioElement;
  sourceNode: MediaElementAudioSourceNode;
  delayNode: DelayNode;
  gainNode: GainNode;
  analyzerNode: AnalyserNode;
  analysisBuffer: Float32Array<ArrayBuffer>;
  gateDetector: GateDetector;
  filterHigh: BiquadFilterNode;
  filterLow: BiquadFilterNode;
  playbackDelayMs: number;
  audibleGateOpen: boolean;
}

interface PendingStrategyEvent {
  feedId: string;
  type: Extract<FeedActivityEvent['type'], 'gate-open' | 'gate-close'>;
  detectedAt: number;
  referenceAt: number;
  at: number;
  sequence: number;
}

type SnapshotListener = (snapshot: EngineSnapshot) => void;

export const ANALYSIS_INTERVAL_MS = 20;
export const METER_SNAPSHOT_INTERVAL_MS = 50;
const CURRENT_TIME_SNAPSHOT_DELTA_S = 0.25;
const STREAM_DELAY_SNAPSHOT_DELTA_MS = 250;
const LEVEL_EPSILON = 0.002;
const MIN_PLAYBACK_DELAY_MS = 200;
const PLAYBACK_DELAY_PADDING_MS = 100;
const GAIN_RAMP_DURATION_S = 0.02;
const MAX_PLAYBACK_DELAY_S = (Math.max(MIN_PLAYBACK_DELAY_MS, MAX_ATTACK_MS + PLAYBACK_DELAY_PADDING_MS) + 100) / 1000;
const EMPTY_ENGINE_SNAPSHOT: EngineSnapshot = {
  running: false,
  floorFeedId: null,
  feeds: {}
};

function stripPrioritySuffix(debug: string | undefined): string {
  if (!debug) {
    return 'media element graph active';
  }

  return debug
    .replace(/ · floor owner$/, '')
    .replace(/ · suppressed by priority$/, '')
    .replace(/ · muted$/, '');
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

function getSeekableLiveEdge(element: HTMLMediaElement): number | null {
  if (Number.isFinite(element.duration) || element.seekable.length === 0) {
    return null;
  }

  try {
    const liveEdge = element.seekable.end(element.seekable.length - 1);
    return Number.isFinite(liveEdge) ? liveEdge : null;
  } catch {
    return null;
  }
}

function measureStreamDelayMs(element: HTMLMediaElement): number | null {
  const liveEdge = getSeekableLiveEdge(element);

  if (liveEdge === null || !Number.isFinite(element.currentTime)) {
    return null;
  }

  return Math.max(0, Math.round((liveEdge - element.currentTime) * 1000));
}

function hasStreamDelayChanged(previousDelayMs: number | null | undefined, nextDelayMs: number | null): boolean {
  if ((previousDelayMs === null || previousDelayMs === undefined) && nextDelayMs === null) {
    return false;
  }

  if (previousDelayMs === nextDelayMs) {
    return false;
  }

  if (previousDelayMs === null || previousDelayMs === undefined || nextDelayMs === null) {
    return true;
  }

  return Math.abs(previousDelayMs - nextDelayMs) >= STREAM_DELAY_SNAPSHOT_DELTA_MS;
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

  private snapshot: EngineSnapshot = EMPTY_ENGINE_SNAPSHOT;

  private analysisTimerId: number | null = null;

  private feedSquelchThresholdsDb: Record<string, number> = {};

  private audioProcessingSettings: AudioProcessingSettings = { ...DEFAULT_AUDIO_PROCESSING_SETTINGS };

  private lastAnalysisAt: number | null = null;

  private lastSnapshotAt = 0;

  private pendingStrategyEvents: PendingStrategyEvent[] = [];

  private nextPendingStrategySequence = 0;

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): EngineSnapshot {
    return this.snapshot;
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
    this.lastAnalysisAt = null;
    this.lastSnapshotAt = 0;
    this.pendingStrategyEvents = [];
    this.nextPendingStrategySequence = 0;
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

    this.pendingStrategyEvents = [];
    this.nextPendingStrategySequence = 0;

    for (const runtime of this.runtimes.values()) {
      runtime.element.pause();
      runtime.element.src = '';
      runtime.element.load();
      runtime.filterLow.disconnect();
      runtime.filterHigh.disconnect();
      runtime.analyzerNode.disconnect();
      runtime.delayNode.disconnect();
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
    this.lastAnalysisAt = null;
    this.emitSnapshot();
  }

  async resyncAll(): Promise<void> {
    if (!this.running) {
      return;
    }

    const now = performance.now();
    const resyncTasks: Promise<void>[] = [];

    this.pendingStrategyEvents = [];
    this.nextPendingStrategySequence = 0;
    this.strategy.reset();
    this.floorFeedId = null;

    for (const runtime of this.runtimes.values()) {
      this.strategy.registerFeed(runtime.selection.feed.id, runtime.selection.priority, runtime.selection.order);

      if (!runtime.state.powered) {
        runtime.state.isFloor = false;
        runtime.audibleGateOpen = false;
        continue;
      }

      this.resetRuntimeAfterResync(runtime);

      const liveEdge = getSeekableLiveEdge(runtime.element);
      if (liveEdge !== null) {
        try {
          runtime.element.currentTime = liveEdge;
          this.updateRuntimeElementState(runtime);
          runtime.state.debug = runtime.state.muted ? 'feed muted · resyncing to live edge' : 'resyncing to live edge';

          if (runtime.element.paused) {
            resyncTasks.push(this.playRuntimeElement(runtime));
          }

          continue;
        } catch {
          // Fall back to a reconnect when live-edge seeking is not supported.
        }
      }

      runtime.state.debug = runtime.state.muted ? 'feed muted · reconnecting stream' : 'reconnecting stream';
      resyncTasks.push(this.restartRuntimePlayback(runtime));
    }

    this.applyFloorState(now);

    if (resyncTasks.length > 0) {
      await Promise.all(resyncTasks);
    }
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

  setFeedSquelchThresholds(thresholdsDb: Record<string, number>): void {
    this.feedSquelchThresholdsDb = { ...thresholdsDb };

    for (const runtime of this.runtimes.values()) {
      runtime.gateDetector.setConfiguredFloorDb(this.getFeedSquelchThresholdDb(runtime.selection.feed.id));
    }
  }

  setAudioProcessingSettings(settings: AudioProcessingSettings): void {
    const nextSettings = normalizeAudioProcessingSettings(settings);
    this.audioProcessingSettings = { ...nextSettings };
    const nextPlaybackDelayMs = this.getPlaybackDelayMs(nextSettings);
    const audioNow = this.context?.currentTime ?? 0;

    for (const runtime of this.runtimes.values()) {
      runtime.gateDetector.updateConfig(nextSettings);
      if (nextPlaybackDelayMs !== runtime.playbackDelayMs) {
        runtime.playbackDelayMs = nextPlaybackDelayMs;
        runtime.state.playbackDelayMs = nextPlaybackDelayMs;
        this.updateDelayNode(runtime, audioNow);
      }
    }

    this.reschedulePendingStrategyEvents();

    if (this.running) {
      const now = this.lastAnalysisAt ?? performance.now();
      if (this.processPendingStrategyEvents(now)) {
        this.applyFloorState(now);
      }
    }
  }

  setFeedPowered(feedId: string, powered: boolean): void {
    const runtime = this.runtimes.get(feedId);
    if (!runtime || runtime.state.powered === powered) {
      return;
    }

    const now = performance.now();
    let arbitrationChanged = false;

    this.clearPendingStrategyEvents(feedId);

    if (!powered) {
      arbitrationChanged = this.updateRuntimeParticipation(runtime, false, now) || arbitrationChanged;
      runtime.state.powered = false;
      runtime.state.isFloor = false;
      runtime.state.gateOpen = false;
      runtime.state.level = 0;
      runtime.state.peak = 0;
      runtime.state.status = 'idle';
      runtime.state.error = undefined;
      runtime.state.debug = 'feed powered off';
      runtime.gateDetector = this.createGateDetector(feedId);
      this.stopRuntimePlayback(runtime);
    } else {
      runtime.state.powered = true;
      runtime.state.isFloor = false;
      runtime.state.gateOpen = false;
      runtime.state.level = 0;
      runtime.state.peak = 0;
      runtime.state.status = 'loading';
      runtime.state.error = undefined;
      runtime.state.debug = runtime.state.muted ? 'feed muted · awaiting stream data' : 'awaiting first decoded audio frame';
      runtime.gateDetector = this.createGateDetector(feedId);
      runtime.audibleGateOpen = false;
      this.startRuntimePlayback(runtime);
    }

    if (arbitrationChanged) {
      this.applyFloorState(now);
      return;
    }

    this.emitSnapshot([feedId], now);
  }

  setFeedMuted(feedId: string, muted: boolean): void {
    const runtime = this.runtimes.get(feedId);
    if (!runtime || runtime.state.muted === muted) {
      return;
    }

    const now = performance.now();
    runtime.state.muted = muted;
    this.clearPendingStrategyEvents(feedId);

    let arbitrationChanged = false;
    if (muted) {
      arbitrationChanged = this.updateRuntimeParticipation(runtime, false, now);
      const baseDebug = stripPrioritySuffix(runtime.state.debug);
      runtime.state.debug = runtime.state.powered ? `${baseDebug} · muted` : baseDebug;
    } else {
      runtime.state.debug = stripPrioritySuffix(runtime.state.debug);

      if (runtime.state.powered && runtime.state.gateOpen && !runtime.audibleGateOpen) {
        runtime.audibleGateOpen = true;
        this.strategy.onFeedEvent(this.createStrategyEvent(feedId, 'gate-open', now));
        arbitrationChanged = true;
      }
    }

    if (arbitrationChanged) {
      this.applyFloorState(now);
      return;
    }

    this.emitSnapshot([feedId], now);
  }

  private buildSnapshot(changedFeedIds?: Iterable<string>): EngineSnapshot {
    const changedFeedIdSet = changedFeedIds ? new Set(changedFeedIds) : null;
    const feeds = Object.fromEntries(
      [...this.runtimes.entries()].map(([feedId, runtime]) => [
        feedId,
        !changedFeedIdSet || changedFeedIdSet.has(feedId) || !this.snapshot.feeds[feedId]
          ? { ...runtime.state }
          : this.snapshot.feeds[feedId]
      ])
    );

    return {
      running: this.running,
      floorFeedId: this.floorFeedId,
      feeds
    };
  }

  private emitSnapshot(changedFeedIds?: Iterable<string>, at = performance.now()): void {
    const snapshot = this.buildSnapshot(changedFeedIds);
    this.snapshot = snapshot;
    this.lastSnapshotAt = at;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private createStrategyEvent(
    feedId: string,
    type: Extract<FeedActivityEvent['type'], 'gate-open' | 'gate-close'>,
    at: number
  ): FeedActivityEvent {
    return { feedId, type, at };
  }

  private clearPendingStrategyEvents(feedId: string): void {
    this.pendingStrategyEvents = this.pendingStrategyEvents.filter((event) => event.feedId !== feedId);
  }

  private updateRuntimeElementState(runtime: FeedRuntime): void {
    runtime.state.readyState = runtime.element.readyState;
    runtime.state.networkState = runtime.element.networkState;
    runtime.state.currentTime = runtime.element.currentTime;
    runtime.state.streamDelayMs = measureStreamDelayMs(runtime.element);
    runtime.state.playbackDelayMs = runtime.playbackDelayMs;
    runtime.state.paused = runtime.element.paused;
  }

  private updateRuntimeParticipation(runtime: FeedRuntime, shouldParticipate: boolean, at: number): boolean {
    if (shouldParticipate) {
      if (runtime.audibleGateOpen || !runtime.state.powered || runtime.state.muted || !runtime.state.gateOpen) {
        return false;
      }

      runtime.audibleGateOpen = true;
      this.strategy.onFeedEvent(this.createStrategyEvent(runtime.selection.feed.id, 'gate-open', at));
      return true;
    }

    if (!runtime.audibleGateOpen) {
      return false;
    }

    runtime.audibleGateOpen = false;
    this.strategy.onFeedEvent(this.createStrategyEvent(runtime.selection.feed.id, 'gate-close', at));
    return true;
  }

  private stopRuntimePlayback(runtime: FeedRuntime): void {
    runtime.element.pause();
    runtime.element.src = '';
    runtime.element.load();
    this.updateRuntimeElementState(runtime);
  }

  private async playRuntimeElement(runtime: FeedRuntime): Promise<void> {
    try {
      await runtime.element.play();
    } catch (error) {
      if (!runtime.state.powered) {
        return;
      }

      runtime.state.status = 'error';
      runtime.state.error = error instanceof Error ? error.message : 'Playback start failed.';
      this.updateRuntimeElementState(runtime);
      runtime.state.debug = 'play() rejected';
      this.emitSnapshot([runtime.selection.feed.id]);
    }
  }

  private async restartRuntimePlayback(runtime: FeedRuntime): Promise<void> {
    runtime.element.pause();
    runtime.element.src = runtime.selection.feed.streamUrl;
    runtime.element.load();
    this.updateRuntimeElementState(runtime);
    await this.playRuntimeElement(runtime);
  }

  private startRuntimePlayback(runtime: FeedRuntime): void {
    void this.restartRuntimePlayback(runtime);
  }

  private resetRuntimeAfterResync(runtime: FeedRuntime): void {
    this.clearPendingStrategyEvents(runtime.selection.feed.id);
    runtime.state.isFloor = false;
    runtime.state.gateOpen = false;
    runtime.state.level = 0;
    runtime.state.peak = 0;
    runtime.state.status = 'buffering';
    runtime.state.error = undefined;
    runtime.gateDetector = this.createGateDetector(runtime.selection.feed.id);
    runtime.audibleGateOpen = false;
  }

  private getFeedSquelchThresholdDb(feedId: string): number {
    return this.feedSquelchThresholdsDb[feedId] ?? DEFAULT_SQUELCH_THRESHOLD_DB;
  }

  private buildGateDetectorConfig(feedId: string) {
    return {
      frameDurationMs: ANALYSIS_INTERVAL_MS,
      configuredFloorDb: this.getFeedSquelchThresholdDb(feedId),
      ...this.audioProcessingSettings
    };
  }

  private createGateDetector(feedId: string): GateDetector {
    return new GateDetector(this.buildGateDetectorConfig(feedId));
  }

  private getPlaybackDelayMs(settings = this.audioProcessingSettings): number {
    return Math.max(MIN_PLAYBACK_DELAY_MS, settings.attackMs + PLAYBACK_DELAY_PADDING_MS);
  }

  private updateDelayNode(runtime: FeedRuntime, audioNow = this.context?.currentTime ?? 0): void {
    const nextDelaySeconds = runtime.playbackDelayMs / 1000;
    runtime.delayNode.delayTime.cancelScheduledValues(audioNow);
    runtime.delayNode.delayTime.setValueAtTime(runtime.delayNode.delayTime.value, audioNow);
    runtime.delayNode.delayTime.linearRampToValueAtTime(nextDelaySeconds, audioNow + GAIN_RAMP_DURATION_S);
  }

  private queueStrategyEvent(
    feedId: string,
    type: PendingStrategyEvent['type'],
    at: number,
    playbackDelayMs: number
  ): void {
    const detectorDelayMs = type === 'gate-open' ? this.audioProcessingSettings.attackMs : this.audioProcessingSettings.hangMs;
    const referenceAt = at - detectorDelayMs;
    this.pendingStrategyEvents.push({
      feedId,
      type,
      detectedAt: at,
      referenceAt,
      at: Math.max(at, referenceAt + playbackDelayMs),
      sequence: this.nextPendingStrategySequence++
    });
  }

  private reschedulePendingStrategyEvents(): void {
    this.pendingStrategyEvents = this.pendingStrategyEvents.map((event) => {
      const runtime = this.runtimes.get(event.feedId);
      if (!runtime) {
        return event;
      }

      return {
        ...event,
        at: Math.max(event.detectedAt, event.referenceAt + runtime.playbackDelayMs)
      };
    });
  }

  private processPendingStrategyEvents(now: number): boolean {
    if (this.pendingStrategyEvents.length === 0) {
      return false;
    }

    const dueEvents: PendingStrategyEvent[] = [];
    const nextPendingEvents: PendingStrategyEvent[] = [];

    for (const event of this.pendingStrategyEvents) {
      if (event.at <= now) {
        dueEvents.push(event);
        continue;
      }

      nextPendingEvents.push(event);
    }

    if (dueEvents.length === 0) {
      return false;
    }

    dueEvents.sort((left, right) => left.at - right.at || left.sequence - right.sequence);
    this.pendingStrategyEvents = nextPendingEvents;

    let changed = false;
    for (const event of dueEvents) {
      changed = this.dispatchStrategyEvent(event) || changed;
    }

    return changed;
  }

  private dispatchStrategyEvent(event: PendingStrategyEvent): boolean {
    const runtime = this.runtimes.get(event.feedId);
    if (!runtime) {
      return false;
    }

    if (event.type === 'gate-open') {
      if (runtime.audibleGateOpen || !runtime.state.powered || runtime.state.muted) {
        return false;
      }

      runtime.audibleGateOpen = true;
      this.strategy.onFeedEvent(event);
      return true;
    }

    if (!runtime.audibleGateOpen) {
      return false;
    }

    runtime.audibleGateOpen = false;
    this.strategy.onFeedEvent(event);
    return true;
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
    const delayNode = this.context.createDelay(MAX_PLAYBACK_DELAY_S);
    const gainNode = this.context.createGain();
    gainNode.gain.value = 0;
    sourceNode.connect(delayNode);
    delayNode.connect(gainNode);
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
      powered: true,
      muted: false,
      isFloor: false,
      gateOpen: false,
      level: 0,
      peak: 0,
      status: 'loading',
      analysisMode: 'graph',
      readyState: element.readyState,
      networkState: element.networkState,
      currentTime: element.currentTime,
      streamDelayMs: null,
      playbackDelayMs: this.getPlaybackDelayMs(),
      paused: element.paused,
      captureTrackCount: 0,
      debug: 'media element graph active'
    };

    const runtime: FeedRuntime = {
      selection,
      state: runtimeState,
      element,
      sourceNode,
      delayNode,
      gainNode,
      analyzerNode,
      analysisBuffer: new Float32Array(
        new ArrayBuffer(analyzerNode.fftSize * Float32Array.BYTES_PER_ELEMENT)
      ),
      gateDetector: this.createGateDetector(selection.feed.id),
      filterHigh,
      filterLow,
      playbackDelayMs: this.getPlaybackDelayMs(),
      audibleGateOpen: false
    };

    this.updateDelayNode(runtime);
    this.runtimes.set(selection.feed.id, runtime);
    this.strategy.registerFeed(selection.feed.id, selection.priority, selection.order);

    element.addEventListener('playing', () => {
      if (!runtime.state.powered) {
        return;
      }

      runtime.state.status = 'ready';
      runtime.state.error = undefined;
      this.updateRuntimeElementState(runtime);
      runtime.state.debug = 'receiving decoded audio';
      this.emitSnapshot([selection.feed.id]);
    });

    element.addEventListener('canplay', () => {
      if (!runtime.state.powered) {
        return;
      }

      runtime.state.status = 'ready';
      runtime.state.error = undefined;
      this.updateRuntimeElementState(runtime);
      runtime.state.debug = 'decoder ready';
      this.emitSnapshot([selection.feed.id]);
    });

    element.addEventListener('waiting', () => {
      if (!runtime.state.powered) {
        return;
      }

      runtime.state.status = 'buffering';
      this.updateRuntimeElementState(runtime);
      runtime.state.debug = 'waiting for stream data';
      this.emitSnapshot([selection.feed.id]);
    });

    element.addEventListener('stalled', () => {
      if (!runtime.state.powered) {
        return;
      }

      runtime.state.status = 'buffering';
      this.updateRuntimeElementState(runtime);
      runtime.state.debug = 'stream stalled';
      this.emitSnapshot([selection.feed.id]);
    });

    element.addEventListener('error', () => {
      if (!runtime.state.powered) {
        return;
      }

      runtime.state.status = 'error';
      runtime.state.error = describeMediaError(runtime.element.error);
      this.updateRuntimeElementState(runtime);
      runtime.state.debug = `media error code ${runtime.element.error?.code ?? 'unknown'}`;
      this.emitSnapshot([selection.feed.id]);
    });

    this.startRuntimePlayback(runtime);
  }

  private sampleAnalysis(now = performance.now()): void {
    const elapsedMs = this.lastAnalysisAt === null ? ANALYSIS_INTERVAL_MS : Math.max(1, now - this.lastAnalysisAt);
    this.lastAnalysisAt = now;

    const changedFeedIds = new Set<string>();
    let clockChanged = false;
    let meterChanged = false;
    let controlChanged = false;
    let arbitrationChanged = this.processPendingStrategyEvents(now);

    for (const runtime of this.runtimes.values()) {
      this.updateRuntimeElementState(runtime);

      if (!runtime.state.powered) {
        continue;
      }

      const previousFeedSnapshot = this.snapshot.feeds[runtime.selection.feed.id];
      const previousCurrentTime = previousFeedSnapshot?.currentTime;
      if (
        previousCurrentTime !== undefined &&
        runtime.state.currentTime !== undefined &&
        Math.abs(runtime.state.currentTime - previousCurrentTime) >= CURRENT_TIME_SNAPSHOT_DELTA_S
      ) {
        changedFeedIds.add(runtime.selection.feed.id);
        clockChanged = true;
      }

      if (hasStreamDelayChanged(previousFeedSnapshot?.streamDelayMs, runtime.state.streamDelayMs)) {
        changedFeedIds.add(runtime.selection.feed.id);
        clockChanged = true;
      }

      runtime.analyzerNode.getFloatTimeDomainData(runtime.analysisBuffer);
      const summary = summarizeFrame(runtime.analysisBuffer);

      if (Math.abs(runtime.state.level - summary.rms) > LEVEL_EPSILON) {
        runtime.state.level = summary.rms;
        changedFeedIds.add(runtime.selection.feed.id);
        meterChanged = true;
      }

      if (Math.abs(runtime.state.peak - summary.peak) > LEVEL_EPSILON) {
        runtime.state.peak = summary.peak;
        changedFeedIds.add(runtime.selection.feed.id);
        meterChanged = true;
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
        changedFeedIds.add(runtime.selection.feed.id);
        controlChanged = true;
      }

      const events = runtime.gateDetector.processFrame(
        runtime.selection.feed.id,
        runtime.analysisBuffer,
        now,
        elapsedMs
      );
      for (const event of events) {
        if (event.type === 'gate-open' && !runtime.state.gateOpen) {
          runtime.state.gateOpen = true;
          runtime.state.debug = `gate open · rms ${event.rms?.toFixed(3) ?? '0.000'} · peak ${event.peak?.toFixed(3) ?? '0.000'}`;
          if (!runtime.state.muted) {
            this.queueStrategyEvent(event.feedId, 'gate-open', event.at, runtime.playbackDelayMs);
          }
          changedFeedIds.add(runtime.selection.feed.id);
          controlChanged = true;
        }

        if (event.type === 'gate-close' && runtime.state.gateOpen) {
          runtime.state.gateOpen = false;
          runtime.state.debug = `gate closed · rms ${event.rms?.toFixed(3) ?? '0.000'} · peak ${event.peak?.toFixed(3) ?? '0.000'}`;
          if (!runtime.state.muted) {
            this.queueStrategyEvent(event.feedId, 'gate-close', event.at, runtime.playbackDelayMs);
          }
          changedFeedIds.add(runtime.selection.feed.id);
          controlChanged = true;
        }
      }
    }

    arbitrationChanged = this.processPendingStrategyEvents(now) || arbitrationChanged;

    if (arbitrationChanged) {
      this.applyFloorState(now);
      return;
    }

    if (controlChanged) {
      this.emitSnapshot(changedFeedIds, now);
      return;
    }

    if ((meterChanged && now - this.lastSnapshotAt >= METER_SNAPSHOT_INTERVAL_MS) || clockChanged) {
      this.emitSnapshot(changedFeedIds, now);
    }
  }

  private deriveStatus(runtime: FeedRuntime): EngineFeedState['status'] {
    if (!runtime.state.powered) {
      return 'idle';
    }

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

  private applyFloorState(now = performance.now()): void {
    this.floorFeedId = this.strategy.getFloorFeedId();

    for (const runtime of this.runtimes.values()) {
      const isFloor =
        runtime.state.powered && !runtime.state.muted && runtime.selection.feed.id === this.floorFeedId;
      runtime.state.isFloor = isFloor;
      const baseDebug = stripPrioritySuffix(runtime.state.debug);
      runtime.state.debug = isFloor
        ? `${baseDebug} · floor owner`
        : runtime.audibleGateOpen
          ? `${baseDebug}${runtime.state.muted ? '' : ' · suppressed by priority'}`
          : baseDebug;

      const audioNow = this.context?.currentTime ?? 0;
      runtime.gainNode.gain.cancelScheduledValues(audioNow);
      runtime.gainNode.gain.setValueAtTime(runtime.gainNode.gain.value, audioNow);
      runtime.gainNode.gain.linearRampToValueAtTime(isFloor ? 1 : 0, audioNow + GAIN_RAMP_DURATION_S);
    }

    this.emitSnapshot(this.runtimes.keys(), now);
  }
}
