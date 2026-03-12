import { openDB } from 'idb';
import { DEFAULT_APP_STATE, type AppState } from '../domain/models';

const DB_NAME = 'atc-watchtower';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';
const STATE_KEY = 'root';

async function openAppDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    }
  });
}

export async function loadAppState(): Promise<AppState> {
  const database = await openAppDb();
  const state = await database.get(STORE_NAME, STATE_KEY);
  return (state as AppState | undefined) ?? DEFAULT_APP_STATE;
}

export async function saveAppState(state: AppState): Promise<void> {
  const database = await openAppDb();
  await database.put(STORE_NAME, state, STATE_KEY);
}
