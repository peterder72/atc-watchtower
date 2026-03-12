export type ArbitrationMode = 'priority' | 'blocked' | 'delay';

export interface FeedPackV1 {
  version: 1;
  name: string;
  airports: AirportDef[];
}

export interface AirportDef {
  icao: string;
  name: string;
  feeds: FeedDef[];
}

export interface FeedDef {
  id: string;
  label: string;
  streamUrl: string;
  frequency?: string;
  defaultPriority: number;
}

export interface FeedActivityEvent {
  feedId: string;
  at: number;
  type: 'gate-open' | 'gate-close' | 'level';
  rms?: number;
  peak?: number;
}

export interface ArbitrationStrategy {
  mode: ArbitrationMode;
  onFeedEvent(event: FeedActivityEvent): void;
  getFloorFeedId(): string | null;
}

export interface StoredFeedPack extends FeedPackV1 {
  packId: string;
  importedAt: number;
  sourceFileName: string;
}

export interface AudioProcessingSettings {
  attackMs: number;
  hangMs: number;
  openDeltaDb: number;
  closeGapDb: number;
}

export interface AppState {
  packs: StoredFeedPack[];
  selectedAirportKey: string | null;
  selectedFeedIds: string[];
  feedSquelchThresholdsDb: Record<string, number>;
  audioProcessingSettings: AudioProcessingSettings;
}

export interface FeedValidationResult {
  streamUrl: string;
  ok: boolean;
  status?: number;
  contentType?: string;
  reason?: string;
}

export interface ImportNotice {
  fileName: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface EngineFeedState {
  feedId: string;
  label: string;
  priority: number;
  isFloor: boolean;
  gateOpen: boolean;
  level: number;
  peak: number;
  status: 'idle' | 'loading' | 'ready' | 'buffering' | 'error';
  error?: string;
  analysisMode?: 'capture-pending' | 'capture' | 'graph';
  readyState?: number;
  networkState?: number;
  currentTime?: number;
  paused?: boolean;
  debug?: string;
  captureTrackCount?: number;
}

export interface EngineSnapshot {
  running: boolean;
  floorFeedId: string | null;
  feeds: Record<string, EngineFeedState>;
}

export interface FeedSelection {
  feed: FeedDef;
  priority: number;
  order: number;
}

export interface AirportEntry {
  key: string;
  packId: string;
  airport: AirportDef;
  packName: string;
}

export const MIN_SQUELCH_THRESHOLD_DB = -80;
export const MAX_SQUELCH_THRESHOLD_DB = -30;
export const DEFAULT_SQUELCH_THRESHOLD_DB = -68;

export const MIN_ATTACK_MS = 20;
export const MAX_ATTACK_MS = 300;
export const ATTACK_MS_STEP = 10;
export const DEFAULT_ATTACK_MS = 60;

export const MIN_HANG_MS = 100;
export const MAX_HANG_MS = 1500;
export const HANG_MS_STEP = 50;
export const DEFAULT_HANG_MS = 400;

export const MIN_OPEN_DELTA_DB = 3;
export const MAX_OPEN_DELTA_DB = 15;
export const OPEN_DELTA_DB_STEP = 1;
export const DEFAULT_OPEN_DELTA_DB = 7;

export const MIN_CLOSE_GAP_DB = 1;
export const MAX_CLOSE_GAP_DB = 10;
export const CLOSE_GAP_DB_STEP = 1;
export const DEFAULT_CLOSE_GAP_DB = 4;

export const DEFAULT_AUDIO_PROCESSING_SETTINGS: AudioProcessingSettings = {
  attackMs: DEFAULT_ATTACK_MS,
  hangMs: DEFAULT_HANG_MS,
  openDeltaDb: DEFAULT_OPEN_DELTA_DB,
  closeGapDb: DEFAULT_CLOSE_GAP_DB
};

function clampSteppedValue(
  value: number,
  minValue: number,
  maxValue: number,
  step: number,
  defaultValue: number
): number {
  if (!Number.isFinite(value)) {
    return defaultValue;
  }

  const snappedValue = minValue + Math.round((value - minValue) / step) * step;
  return Math.min(maxValue, Math.max(minValue, snappedValue));
}

export function clampSquelchThresholdDb(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SQUELCH_THRESHOLD_DB;
  }

  return Math.min(MAX_SQUELCH_THRESHOLD_DB, Math.max(MIN_SQUELCH_THRESHOLD_DB, Math.round(value)));
}

export function clampAttackMs(value: number): number {
  return clampSteppedValue(value, MIN_ATTACK_MS, MAX_ATTACK_MS, ATTACK_MS_STEP, DEFAULT_ATTACK_MS);
}

export function clampHangMs(value: number): number {
  return clampSteppedValue(value, MIN_HANG_MS, MAX_HANG_MS, HANG_MS_STEP, DEFAULT_HANG_MS);
}

export function clampOpenDeltaDb(value: number): number {
  return clampSteppedValue(value, MIN_OPEN_DELTA_DB, MAX_OPEN_DELTA_DB, OPEN_DELTA_DB_STEP, DEFAULT_OPEN_DELTA_DB);
}

export function clampCloseGapDb(value: number): number {
  return clampSteppedValue(value, MIN_CLOSE_GAP_DB, MAX_CLOSE_GAP_DB, CLOSE_GAP_DB_STEP, DEFAULT_CLOSE_GAP_DB);
}

export function normalizeAudioProcessingSettings(
  value: Partial<AudioProcessingSettings> | null | undefined
): AudioProcessingSettings {
  return {
    attackMs: clampAttackMs(value?.attackMs ?? DEFAULT_ATTACK_MS),
    hangMs: clampHangMs(value?.hangMs ?? DEFAULT_HANG_MS),
    openDeltaDb: clampOpenDeltaDb(value?.openDeltaDb ?? DEFAULT_OPEN_DELTA_DB),
    closeGapDb: clampCloseGapDb(value?.closeGapDb ?? DEFAULT_CLOSE_GAP_DB)
  };
}

export const DEFAULT_APP_STATE: AppState = {
  packs: [],
  selectedAirportKey: null,
  selectedFeedIds: [],
  feedSquelchThresholdsDb: {},
  audioProcessingSettings: DEFAULT_AUDIO_PROCESSING_SETTINGS
};

export function createAirportKey(packId: string, icao: string): string {
  return `${packId}::${icao.toUpperCase()}`;
}
