import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SQUELCH_THRESHOLD_DB,
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

function createGainNode(): GainNode {
  const gain = {
    value: 0,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn((value: number) => {
      gain.value = value;
    }),
    linearRampToValueAtTime: vi.fn((value: number) => {
      gain.value = value;
    })
  };

  return { gain } as unknown as GainNode;
}

function createRuntime(
  engine: PriorityAudioEngine,
  selection: FeedSelection,
  amplitudeRef: { value: number },
  configuredFloorDb = DEFAULT_SQUELCH_THRESHOLD_DB
) {
  const element: MockMediaElement = {
    readyState: HTMLMediaElement.HAVE_NOTHING,
    networkState: HTMLMediaElement.NETWORK_EMPTY,
    currentTime: 0,
    paused: false
  };
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
  const runtime = {
    selection,
    state: runtimeState,
    element: element as HTMLAudioElement,
    sourceNode: {} as MediaElementAudioSourceNode,
    gainNode: createGainNode(),
    analyzerNode: {
      getFloatTimeDomainData(buffer: Float32Array) {
        buffer.fill(amplitudeRef.value);
      }
    } as AnalyserNode,
    analysisBuffer: new Float32Array(128),
    gateDetector: new GateDetector({
      frameDurationMs: ANALYSIS_INTERVAL_MS,
      configuredFloorDb,
      openDeltaDb: 7,
      closeGapDb: 4
    }),
    filterHigh: {} as BiquadFilterNode,
    filterLow: {} as BiquadFilterNode
  };

  (engine as unknown as { context: AudioContext | null }).context = { currentTime: 0 } as AudioContext;
  (engine as unknown as { running: boolean }).running = true;
  (
    engine as unknown as {
      runtimes: Map<string, typeof runtime>;
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
  it('opens and closes gates using elapsed analysis time', () => {
    const engine = new PriorityAudioEngine();
    const amplitudeRef = { value: 0.2 };
    const { runtime } = createRuntime(engine, createSelection('tower', 1, 0), amplitudeRef);

    runAnalysis(engine, 20);
    runAnalysis(engine, 40);
    expect(runtime.state.gateOpen).toBe(false);

    runAnalysis(engine, 60);
    expect(runtime.state.gateOpen).toBe(true);
    expect(engine.getSnapshot().floorFeedId).toBe('tower');

    amplitudeRef.value = 0.0001;
    for (let now = 80; now < 460; now += ANALYSIS_INTERVAL_MS) {
      runAnalysis(engine, now);
    }

    expect(runtime.state.gateOpen).toBe(true);

    runAnalysis(engine, 460);
    expect(runtime.state.gateOpen).toBe(false);
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

  it('emits immediate floor-owner updates even while meter snapshots are throttled', () => {
    const engine = new PriorityAudioEngine();
    const snapshots: EngineSnapshot[] = [];

    engine.subscribe((snapshot) => {
      snapshots.push(snapshot);
    });
    createRuntime(engine, createSelection('tower', 2, 0), { value: 0.2 });
    createRuntime(engine, createSelection('approach', 1, 1), { value: 0.2 });

    runAnalysis(engine, 20);
    runAnalysis(engine, 40);
    expect(snapshots).toHaveLength(1);

    runAnalysis(engine, 60);

    expect(snapshots).toHaveLength(2);
    expect(snapshots[1].floorFeedId).toBe('approach');
    expect(snapshots[1].feeds.approach.isFloor).toBe(true);
    expect(snapshots[1].feeds.tower.isFloor).toBe(false);
  });
});
