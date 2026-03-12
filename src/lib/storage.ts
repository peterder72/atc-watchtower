import { openDB } from 'idb';
import { clampSquelchThresholdDb, DEFAULT_APP_STATE, type AppState } from '../domain/models';

const DB_NAME = 'atc-watchtower';
const DB_VERSION = 2;
const STORE_NAME = 'app-state';
const STATE_KEY = 'root';

let databasePromise: ReturnType<typeof openDB> | null = null;
let saveQueue = Promise.resolve();

async function openAppDb() {
  databasePromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    }
  });

  return databasePromise;
}

function migrateFeedSquelchThresholdsDb(
  feedSquelchThresholdsDb: unknown
): AppState['feedSquelchThresholdsDb'] {
  if (!feedSquelchThresholdsDb || typeof feedSquelchThresholdsDb !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(feedSquelchThresholdsDb)
      .filter(([feedId]) => typeof feedId === 'string')
      .flatMap(([feedId, thresholdDb]) => {
        if (typeof thresholdDb !== 'number') {
          return [];
        }

        return [[feedId, clampSquelchThresholdDb(thresholdDb)] as const];
      })
  );
}

function migrateAppState(state: unknown): AppState {
  if (!state || typeof state !== 'object') {
    return DEFAULT_APP_STATE;
  }

  const candidate = state as Partial<AppState>;

  return {
    packs: Array.isArray(candidate.packs) ? candidate.packs : DEFAULT_APP_STATE.packs,
    selectedAirportKey: typeof candidate.selectedAirportKey === 'string' ? candidate.selectedAirportKey : null,
    selectedFeedIds: Array.isArray(candidate.selectedFeedIds)
      ? candidate.selectedFeedIds.filter((feedId): feedId is string => typeof feedId === 'string')
      : DEFAULT_APP_STATE.selectedFeedIds,
    feedSquelchThresholdsDb: migrateFeedSquelchThresholdsDb(
      (candidate as { feedSquelchThresholdsDb?: unknown }).feedSquelchThresholdsDb
    )
  };
}

export async function loadAppState(): Promise<AppState> {
  const database = await openAppDb();
  const state = await database.get(STORE_NAME, STATE_KEY);
  return migrateAppState(state);
}

export function saveAppState(state: AppState): Promise<void> {
  const nextState: AppState = {
    ...state,
    selectedFeedIds: [...state.selectedFeedIds],
    feedSquelchThresholdsDb: { ...state.feedSquelchThresholdsDb }
  };

  saveQueue = saveQueue.catch(() => undefined).then(async () => {
    const database = await openAppDb();
    await database.put(STORE_NAME, nextState, STATE_KEY);
  });

  return saveQueue;
}

export async function resetStorageForTests(): Promise<void> {
  if (databasePromise) {
    const database = await databasePromise;
    database.close();
  }

  databasePromise = null;
  saveQueue = Promise.resolve();
}
