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

export interface AppState {
  packs: StoredFeedPack[];
  selectedAirportKey: string | null;
  selectedFeedIds: string[];
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

export function clampSquelchThresholdDb(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SQUELCH_THRESHOLD_DB;
  }

  return Math.min(MAX_SQUELCH_THRESHOLD_DB, Math.max(MIN_SQUELCH_THRESHOLD_DB, Math.round(value)));
}

export const DEFAULT_APP_STATE: AppState = {
  packs: [],
  selectedAirportKey: null,
  selectedFeedIds: []
};

export function createAirportKey(packId: string, icao: string): string {
  return `${packId}::${icao.toUpperCase()}`;
}
