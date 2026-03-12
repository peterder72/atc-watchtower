import type { FeedActivityEvent } from '../domain/models';
import {
  DEFAULT_ATTACK_MS,
  DEFAULT_CLOSE_GAP_DB,
  DEFAULT_HANG_MS,
  DEFAULT_OPEN_DELTA_DB
} from '../domain/models';

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
  attackMs: DEFAULT_ATTACK_MS,
  hangMs: DEFAULT_HANG_MS,
  configuredFloorDb: -50,
  openDeltaDb: DEFAULT_OPEN_DELTA_DB,
  closeGapDb: DEFAULT_CLOSE_GAP_DB,
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
  private config: GateDetectorConfig;

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

  updateConfig(config: Partial<Pick<GateDetectorConfig, 'attackMs' | 'hangMs' | 'openDeltaDb' | 'closeGapDb'>>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }

  processFrame(feedId: string, samples: ArrayLike<number>, at: number, elapsedMs = this.config.frameDurationMs): FeedActivityEvent[] {
    const events: FeedActivityEvent[] = [];
    const { rms, peak, rmsDb, peakDb } = summarizeFrame(samples);
    const effectiveElapsedMs = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : this.config.frameDurationMs;

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
        this.attackAccumMs += effectiveElapsedMs;
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
        this.silenceAccumMs += effectiveElapsedMs;
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
