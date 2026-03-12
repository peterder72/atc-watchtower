import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_AUDIO_PROCESSING_SETTINGS,
  DEFAULT_SQUELCH_THRESHOLD_DB,
  type AudioProcessingSettings,
  type EngineFeedState,
  type EngineSnapshot,
  type FeedSelection
} from '../domain/models';
import { GateDetector } from './gateDetector';
import {
  ANALYSIS_INTERVAL_MS,
  METER_SNAPSHOT_INTERVAL_MS,
  PriorityAudioEngine
} from './priorityAudioEngine';

interface MockMediaElement {
  readyState: number;
  networkState: number;
  currentTime: number;
  paused: boolean;
  src: string;
  pause: () => void;
  load: () => void;
  play: () => Promise<void>;
}

interface TestRuntime {
  selection: FeedSelection;
  state: EngineFeedState;
  element: HTMLAudioElement;
  sourceNode: MediaElementAudioSourceNode;
  delayNode: DelayNode;
  gainNode: GainNode;
  analyzerNode: AnalyserNode;
  analysisBuffer: Float32Array;
  gateDetector: GateDetector;
  filterHigh: BiquadFilterNode;
  filterLow: BiquadFilterNode;
  playbackDelayMs: number;
  audibleGateOpen: boolean;
}

function createSelection(feedId: string, priority: number, order: number): FeedSelection {
  return {
    feed: {
      id: feedId,
      label: feedId,
      streamUrl: `https://example.com/${feedId}`,
      defaultPriority: priority
    },
    priority,
    order
  };
}

function getPlaybackDelayMs(settings: AudioProcessingSettings): number {
  return Math.max(200, settings.attackMs + 100);
}

function createAudioParam(initialValue = 0): AudioParam {
  const param = {
    value: initialValue,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn((value: number) => {
      param.value = value;
      return param;
    }),
    linearRampToValueAtTime: vi.fn((value: number) => {
      param.value = value;
      return param;
    })
  };

  return param as unknown as AudioParam;
}

function createGainNode(): GainNode {
  return {
    gain: createAudioParam(0),
    disconnect: vi.fn()
  } as unknown as GainNode;
}

function createDelayNode(initialValue = 0): DelayNode {
  return {
    delayTime: createAudioParam(initialValue),
    disconnect: vi.fn()
  } as unknown as DelayNode;
}

function createRuntime(
  engine: PriorityAudioEngine,
  selection: FeedSelection,
  amplitudeRef: { value: number },
  configuredFloorDb = DEFAULT_SQUELCH_THRESHOLD_DB
) {
  const audioProcessingSettings =
    (engine as unknown as { audioProcessingSettings: AudioProcessingSettings }).audioProcessingSettings ??
    DEFAULT_AUDIO_PROCESSING_SETTINGS;
  const playbackDelayMs = getPlaybackDelayMs(audioProcessingSettings);
  const element = {} as MockMediaElement;
  element.readyState = HTMLMediaElement.HAVE_NOTHING;
  element.networkState = HTMLMediaElement.NETWORK_EMPTY;
  element.currentTime = 0;
  element.paused = false;
  element.src = selection.feed.streamUrl;
  element.pause = vi.fn(() => {
    element.paused = true;
  });
  element.load = vi.fn(() => {
    element.currentTime = 0;
    element.readyState = HTMLMediaElement.HAVE_NOTHING;
    element.networkState = element.src ? HTMLMediaElement.NETWORK_LOADING : HTMLMediaElement.NETWORK_EMPTY;
  });
  element.play = vi.fn(async () => {
    element.paused = false;
    element.networkState = HTMLMediaElement.NETWORK_LOADING;
  });
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
    paused: element.paused,
    captureTrackCount: 0,
    debug: 'media element graph active'
  };
  const runtime: TestRuntime = {
    selection,
    state: runtimeState,
    element: element as HTMLAudioElement,
    sourceNode: {
      disconnect: vi.fn()
    } as unknown as MediaElementAudioSourceNode,
    delayNode: createDelayNode(playbackDelayMs / 1000),
    gainNode: createGainNode(),
    analyzerNode: {
      disconnect: vi.fn(),
      getFloatTimeDomainData(buffer: Float32Array) {
        buffer.fill(amplitudeRef.value);
      }
    } as unknown as AnalyserNode,
    analysisBuffer: new Float32Array(128),
    gateDetector: new GateDetector({
      frameDurationMs: ANALYSIS_INTERVAL_MS,
      configuredFloorDb,
      ...audioProcessingSettings
    }),
    filterHigh: {
      disconnect: vi.fn()
    } as unknown as BiquadFilterNode,
    filterLow: {
      disconnect: vi.fn()
    } as unknown as BiquadFilterNode,
    playbackDelayMs,
    audibleGateOpen: false
  };

  (engine as unknown as { context: AudioContext | null }).context = { currentTime: 0 } as AudioContext;
  (engine as unknown as { running: boolean }).running = true;
  (
    engine as unknown as {
      runtimes: Map<string, TestRuntime>;
      strategy: { registerFeed: (feedId: string, priority: number, order: number) => void };
    }
  ).runtimes.set(selection.feed.id, runtime);
  (
    engine as unknown as {
      strategy: { registerFeed: (feedId: string, priority: number, order: number) => void };
    }
  ).strategy.registerFeed(selection.feed.id, selection.priority, selection.order);

  return {
    element,
    runtime
  };
}

function runAnalysis(engine: PriorityAudioEngine, now: number) {
  (engine as unknown as { sampleAnalysis: (nextNow: number) => void }).sampleAnalysis(now);
}

describe('PriorityAudioEngine', () => {
  it('delays floor ownership until the delayed audio becomes audible', () => {
    const engine = new PriorityAudioEngine();
    const amplitudeRef = { value: 0.2 };
    const { runtime } = createRuntime(engine, createSelection('tower', 1, 0), amplitudeRef);

    runAnalysis(engine, 20);
    runAnalysis(engine, 40);
    expect(runtime.state.gateOpen).toBe(false);
    expect(engine.getSnapshot().floorFeedId).toBeNull();

    runAnalysis(engine, 60);
    expect(runtime.state.gateOpen).toBe(true);
    expect(engine.getSnapshot().floorFeedId).toBeNull();

    amplitudeRef.value = 0.0001;
    for (let now = 80; now < 200; now += ANALYSIS_INTERVAL_MS) {
      runAnalysis(engine, now);
    }

    expect(engine.getSnapshot().floorFeedId).toBeNull();

    runAnalysis(engine, 200);
    expect(engine.getSnapshot().floorFeedId).toBe('tower');
    expect(runtime.state.isFloor).toBe(true);

    for (let now = 220; now < 460; now += ANALYSIS_INTERVAL_MS) {
      runAnalysis(engine, now);
    }

    expect(runtime.state.gateOpen).toBe(true);

    runAnalysis(engine, 460);
    expect(runtime.state.gateOpen).toBe(false);
    expect(runtime.state.isFloor).toBe(false);
    expect(engine.getSnapshot().floorFeedId).toBeNull();
  });

  it('throttles meter-only snapshots', () => {
    const engine = new PriorityAudioEngine();
    const snapshots: EngineSnapshot[] = [];
    const amplitudeRef = { value: 0.01 };

    engine.subscribe((snapshot) => {
      snapshots.push(snapshot);
    });
    createRuntime(engine, createSelection('tower', 1, 0), amplitudeRef, 0);

    for (let now = ANALYSIS_INTERVAL_MS; now < METER_SNAPSHOT_INTERVAL_MS; now += ANALYSIS_INTERVAL_MS) {
      amplitudeRef.value += 0.001;
      runAnalysis(engine, now);
    }

    expect(snapshots).toHaveLength(1);

    amplitudeRef.value += 0.001;
    runAnalysis(engine, METER_SNAPSHOT_INTERVAL_MS);

    expect(snapshots).toHaveLength(2);
    expect(snapshots[1].feeds.tower.level).toBeGreaterThan(0);
  });

  it('emits immediate snapshots for status changes even when meter updates are throttled', () => {
    const engine = new PriorityAudioEngine();
    const snapshots: EngineSnapshot[] = [];
    const amplitudeRef = { value: 0.01 };
    const { element } = createRuntime(engine, createSelection('tower', 1, 0), amplitudeRef, 0);

    engine.subscribe((snapshot) => {
      snapshots.push(snapshot);
    });

    runAnalysis(engine, ANALYSIS_INTERVAL_MS);
    expect(snapshots).toHaveLength(1);

    element.readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
    element.paused = false;

    runAnalysis(engine, ANALYSIS_INTERVAL_MS * 2);

    expect(snapshots).toHaveLength(2);
    expect(snapshots[1].feeds.tower.status).toBe('ready');
  });

  it('refreshes currentTime snapshots while audio keeps advancing', () => {
    const engine = new PriorityAudioEngine();
    const snapshots: EngineSnapshot[] = [];
    const amplitudeRef = { value: 0 };
    const { element } = createRuntime(engine, createSelection('tower', 1, 0), amplitudeRef, 0);

    engine.subscribe((snapshot) => {
      snapshots.push(snapshot);
    });

    element.readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
    element.paused = false;

    runAnalysis(engine, ANALYSIS_INTERVAL_MS);
    expect(snapshots).toHaveLength(2);

    element.currentTime = 0.1;
    runAnalysis(engine, ANALYSIS_INTERVAL_MS * 2);
    expect(snapshots).toHaveLength(2);

    element.currentTime = 0.2;
    runAnalysis(engine, ANALYSIS_INTERVAL_MS * 3);
    expect(snapshots).toHaveLength(2);

    element.currentTime = 0.3;
    runAnalysis(engine, ANALYSIS_INTERVAL_MS * 4);

    expect(snapshots).toHaveLength(3);
    expect(snapshots[2].feeds.tower.currentTime).toBe(0.3);
  });

  it('delays higher-priority preemption until the delayed audio reaches the speakers', () => {
    const engine = new PriorityAudioEngine();
    const towerAmplitude = { value: 0.2 };
    const approachAmplitude = { value: 0 };
    const { runtime: towerRuntime } = createRuntime(engine, createSelection('tower', 2, 0), towerAmplitude);
    const { runtime: approachRuntime } = createRuntime(engine, createSelection('approach', 1, 1), approachAmplitude);

    runAnalysis(engine, 20);
    runAnalysis(engine, 40);
    runAnalysis(engine, 60);

    expect(towerRuntime.state.gateOpen).toBe(true);
    expect(engine.getSnapshot().floorFeedId).toBeNull();

    runAnalysis(engine, 80);
    approachAmplitude.value = 0.2;
    runAnalysis(engine, 100);
    runAnalysis(engine, 120);
    runAnalysis(engine, 140);

    expect(approachRuntime.state.gateOpen).toBe(true);
    expect(engine.getSnapshot().floorFeedId).toBeNull();

    runAnalysis(engine, 160);
    runAnalysis(engine, 180);
    runAnalysis(engine, 200);

    expect(engine.getSnapshot().floorFeedId).toBe('tower');
    expect(towerRuntime.state.isFloor).toBe(true);
    expect(approachRuntime.state.isFloor).toBe(false);

    runAnalysis(engine, 220);
    runAnalysis(engine, 240);
    runAnalysis(engine, 260);
    expect(engine.getSnapshot().floorFeedId).toBe('tower');

    runAnalysis(engine, 280);

    expect(engine.getSnapshot().floorFeedId).toBe('approach');
    expect(towerRuntime.state.isFloor).toBe(false);
    expect(approachRuntime.state.isFloor).toBe(true);
  });

  it('muting the current floor owner immediately transfers the floor', () => {
    const engine = new PriorityAudioEngine();
    const towerAmplitude = { value: 0.2 };
    const groundAmplitude = { value: 0.2 };
    const { runtime: towerRuntime } = createRuntime(engine, createSelection('tower', 1, 0), towerAmplitude);
    const { runtime: groundRuntime } = createRuntime(engine, createSelection('ground', 2, 1), groundAmplitude);

    for (let now = 20; now <= 200; now += ANALYSIS_INTERVAL_MS) {
      runAnalysis(engine, now);
    }

    expect(engine.getSnapshot().floorFeedId).toBe('tower');
    expect(towerRuntime.state.isFloor).toBe(true);
    expect(groundRuntime.state.isFloor).toBe(false);

    engine.setFeedMuted('tower', true);

    expect(towerRuntime.state.muted).toBe(true);
    expect(towerRuntime.state.isFloor).toBe(false);
    expect(groundRuntime.state.isFloor).toBe(true);
    expect(engine.getSnapshot().floorFeedId).toBe('ground');
  });

  it('treats unmuting a gate-open feed as a fresh opening', () => {
    const engine = new PriorityAudioEngine();
    const towerAmplitude = { value: 0.2 };
    const approachAmplitude = { value: 0.2 };
    const { runtime: towerRuntime } = createRuntime(engine, createSelection('tower', 1, 1), towerAmplitude);
    const { runtime: approachRuntime } = createRuntime(engine, createSelection('approach', 1, 0), approachAmplitude);

    engine.setFeedMuted('approach', true);

    for (let now = 20; now <= 200; now += ANALYSIS_INTERVAL_MS) {
      runAnalysis(engine, now);
    }

    expect(towerRuntime.state.isFloor).toBe(true);
    expect(approachRuntime.state.gateOpen).toBe(true);
    expect(engine.getSnapshot().floorFeedId).toBe('tower');

    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(210);
    engine.setFeedMuted('approach', false);
    nowSpy.mockRestore();

    expect(approachRuntime.state.muted).toBe(false);
    expect(approachRuntime.audibleGateOpen).toBe(true);
    expect(engine.getSnapshot().floorFeedId).toBe('tower');
    expect(towerRuntime.state.isFloor).toBe(true);
    expect(approachRuntime.state.isFloor).toBe(false);
  });

  it('powering off clears pending delayed openings and resets feed state', () => {
    const engine = new PriorityAudioEngine();
    const amplitudeRef = { value: 0.2 };
    const { element, runtime } = createRuntime(engine, createSelection('tower', 1, 0), amplitudeRef);

    runAnalysis(engine, 20);
    runAnalysis(engine, 40);
    runAnalysis(engine, 60);

    expect(runtime.state.gateOpen).toBe(true);
    expect(engine.getSnapshot().floorFeedId).toBeNull();

    engine.setFeedPowered('tower', false);

    expect(runtime.state.powered).toBe(false);
    expect(runtime.state.gateOpen).toBe(false);
    expect(runtime.state.level).toBe(0);
    expect(runtime.state.peak).toBe(0);
    expect(runtime.state.isFloor).toBe(false);
    expect(element.pause).toHaveBeenCalled();
    expect(element.load).toHaveBeenCalled();

    runAnalysis(engine, 200);
    expect(engine.getSnapshot().floorFeedId).toBeNull();
    expect(runtime.state.isFloor).toBe(false);
  });

  it('powering back on returns to loading state and preserves mute', () => {
    const engine = new PriorityAudioEngine();
    const amplitudeRef = { value: 0.2 };
    const { element, runtime } = createRuntime(engine, createSelection('tower', 1, 0), amplitudeRef);

    engine.setFeedMuted('tower', true);
    engine.setFeedPowered('tower', false);
    engine.setFeedPowered('tower', true);

    expect(runtime.state.powered).toBe(true);
    expect(runtime.state.muted).toBe(true);
    expect(runtime.state.status).toBe('loading');
    expect(runtime.state.gateOpen).toBe(false);
    expect(element.src).toBe('https://example.com/tower');
    expect(element.play).toHaveBeenCalled();

    element.readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
    element.paused = false;

    runAnalysis(engine, ANALYSIS_INTERVAL_MS);

    expect(runtime.state.status).toBe('ready');
  });

  it('reschedules delayed openings when audio settings change live', () => {
    const engine = new PriorityAudioEngine();
    const amplitudeRef = { value: 0.2 };
    const { runtime } = createRuntime(engine, createSelection('tower', 1, 0), amplitudeRef);

    runAnalysis(engine, 20);
    runAnalysis(engine, 40);
    runAnalysis(engine, 60);

    expect(runtime.state.gateOpen).toBe(true);
    expect(engine.getSnapshot().floorFeedId).toBeNull();
    expect(runtime.playbackDelayMs).toBe(200);
    expect(runtime.delayNode.delayTime.value).toBeCloseTo(0.2);

    engine.setAudioProcessingSettings({
      ...DEFAULT_AUDIO_PROCESSING_SETTINGS,
      attackMs: 140,
      hangMs: 400
    });

    expect(runtime.playbackDelayMs).toBe(240);
    expect(runtime.delayNode.delayTime.value).toBeCloseTo(0.24);

    for (let now = 80; now < 240; now += ANALYSIS_INTERVAL_MS) {
      runAnalysis(engine, now);
    }

    expect(engine.getSnapshot().floorFeedId).toBeNull();

    runAnalysis(engine, 240);
    expect(engine.getSnapshot().floorFeedId).toBe('tower');
    expect(runtime.state.isFloor).toBe(true);
  });

  it('keeps delayed audio tails audible when hang time is shorter than playback delay', () => {
    const engine = new PriorityAudioEngine();

    engine.setAudioProcessingSettings({
      ...DEFAULT_AUDIO_PROCESSING_SETTINGS,
      attackMs: 20,
      hangMs: 100
    });

    const amplitudeRef = { value: 0.2 };
    const { runtime } = createRuntime(engine, createSelection('tower', 1, 0), amplitudeRef);

    runAnalysis(engine, 20);
    expect(runtime.state.gateOpen).toBe(true);
    expect(engine.getSnapshot().floorFeedId).toBeNull();

    amplitudeRef.value = 0.0001;
    for (let now = 40; now <= 120; now += ANALYSIS_INTERVAL_MS) {
      runAnalysis(engine, now);
    }

    expect(runtime.state.gateOpen).toBe(false);
    expect(engine.getSnapshot().floorFeedId).toBeNull();

    runAnalysis(engine, 200);
    expect(runtime.state.isFloor).toBe(true);
    expect(engine.getSnapshot().floorFeedId).toBe('tower');

    runAnalysis(engine, 220);
    expect(runtime.state.isFloor).toBe(false);
    expect(engine.getSnapshot().floorFeedId).toBeNull();
  });

  it('uses the current audio settings and playback delay for new runtimes', () => {
    const engine = new PriorityAudioEngine();

    engine.setAudioProcessingSettings({
      ...DEFAULT_AUDIO_PROCESSING_SETTINGS,
      attackMs: 140,
      hangMs: 200,
      openDeltaDb: 11,
      closeGapDb: 6
    });

    const amplitudeRef = { value: 0.2 };
    const { runtime } = createRuntime(engine, createSelection('tower', 1, 0), amplitudeRef);

    expect(runtime.playbackDelayMs).toBe(240);
    expect(runtime.delayNode.delayTime.value).toBeCloseTo(0.24);

    for (let now = ANALYSIS_INTERVAL_MS; now < 140; now += ANALYSIS_INTERVAL_MS) {
      runAnalysis(engine, now);
    }

    expect(runtime.state.gateOpen).toBe(false);

    runAnalysis(engine, 140);
    expect(runtime.state.gateOpen).toBe(true);
  });
});
