import type { FeedActivityEvent } from '../domain/models';

export interface GateDetectorConfig {
  frameDurationMs: number;
  attackMs: number;
  hangMs: number;
  configuredFloorDb: number;
  openDeltaDb: number;
  closeGapDb: number;
  levelEmitIntervalMs: number;
  initialNoiseFloorDb: number;
  noiseFloorAlpha: number;
}

export const DEFAULT_GATE_CONFIG: GateDetectorConfig = {
  frameDurationMs: 20,
  attackMs: 60,
  hangMs: 400,
  configuredFloorDb: -50,
  openDeltaDb: 10,
  closeGapDb: 6,
  levelEmitIntervalMs: 100,
  initialNoiseFloorDb: -72,
  noiseFloorAlpha: 0.05
};

function clampDb(value: number): number {
  return Number.isFinite(value) ? value : -100;
}

function toDb(value: number): number {
  return 20 * Math.log10(Math.max(value, 1e-6));
}

export function summarizeFrame(samples: ArrayLike<number>): { rms: number; peak: number; rmsDb: number; peakDb: number } {
  let sumSquares = 0;
  let peak = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const absolute = Math.abs(samples[index]);
    sumSquares += absolute * absolute;
    if (absolute > peak) {
      peak = absolute;
    }
  }

  const rms = Math.sqrt(sumSquares / Math.max(samples.length, 1));
  return {
    rms,
    peak,
    rmsDb: clampDb(toDb(rms)),
    peakDb: clampDb(toDb(peak))
  };
}

export class GateDetector {
  private readonly config: GateDetectorConfig;

  private gateOpen = false;

  private attackAccumMs = 0;

  private silenceAccumMs = 0;

  private noiseFloorDb: number;

  private nextLevelEmitAt = 0;

  private configuredFloorDb: number;

  constructor(config: Partial<GateDetectorConfig> = {}) {
    this.config = { ...DEFAULT_GATE_CONFIG, ...config };
    this.noiseFloorDb = this.config.initialNoiseFloorDb;
    this.configuredFloorDb = this.config.configuredFloorDb;
  }

  setConfiguredFloorDb(value: number): void {
    this.configuredFloorDb = value;
  }

  processFrame(feedId: string, samples: ArrayLike<number>, at: number): FeedActivityEvent[] {
    const events: FeedActivityEvent[] = [];
    const { rms, peak, rmsDb, peakDb } = summarizeFrame(samples);

    const openThreshold = Math.max(this.noiseFloorDb + this.config.openDeltaDb, this.configuredFloorDb);
    const closeThreshold = openThreshold - this.config.closeGapDb;
    const aboveOpenThreshold = rmsDb >= openThreshold || peakDb >= openThreshold + 3;

    if (!this.gateOpen) {
      if (!aboveOpenThreshold) {
        this.noiseFloorDb =
          (1 - this.config.noiseFloorAlpha) * this.noiseFloorDb +
          this.config.noiseFloorAlpha * rmsDb;
      }

      if (aboveOpenThreshold) {
        this.attackAccumMs += this.config.frameDurationMs;
        if (this.attackAccumMs >= this.config.attackMs) {
          this.gateOpen = true;
          this.attackAccumMs = 0;
          this.silenceAccumMs = 0;
          events.push({ feedId, at, type: 'gate-open', rms, peak });
        }
      } else {
        this.attackAccumMs = 0;
      }
    } else {
      const belowCloseThreshold = rmsDb < closeThreshold && peakDb < closeThreshold + 3;

      if (belowCloseThreshold) {
        this.silenceAccumMs += this.config.frameDurationMs;
        if (this.silenceAccumMs >= this.config.hangMs) {
          this.gateOpen = false;
          this.silenceAccumMs = 0;
          events.push({ feedId, at, type: 'gate-close', rms, peak });
        }
      } else {
        this.silenceAccumMs = 0;
      }
    }

    if (at >= this.nextLevelEmitAt) {
      events.push({ feedId, at, type: 'level', rms, peak });
      this.nextLevelEmitAt = at + this.config.levelEmitIntervalMs;
    }

    return events;
  }

  isGateOpen(): boolean {
    return this.gateOpen;
  }
}
