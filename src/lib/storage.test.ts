import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APP_STATE, type AppState } from '../domain/models';
import { resetStorageForTests } from './storage';

const DB_NAME = 'atc-watchtower';
const DB_VERSION = 2;
const STORE_NAME = 'app-state';
const STATE_KEY = 'root';

async function deleteDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  await resetStorageForTests();
  await deleteDatabase(DB_NAME);
});

describe('storage', () => {
  it('persists squelch thresholds alongside app state', async () => {
    const state: AppState = {
      ...DEFAULT_APP_STATE,
      selectedAirportKey: 'pack-eham::EHAM',
      selectedFeedIds: ['tower'],
      feedSquelchThresholdsDb: {
        tower: -54
      }
    };

    const { loadAppState, saveAppState } = await import('./storage');

    await saveAppState(state);
    expect(await loadAppState()).toEqual(state);
  });

  it('migrates legacy persisted state that does not include squelch thresholds', async () => {
    const database = await openDB(DB_NAME, DB_VERSION, {
      upgrade(nextDatabase) {
        if (!nextDatabase.objectStoreNames.contains(STORE_NAME)) {
          nextDatabase.createObjectStore(STORE_NAME);
        }
      }
    });

    await database.put(
      STORE_NAME,
      {
        packs: [],
        selectedAirportKey: 'pack-eham::EHAM',
        selectedFeedIds: ['tower']
      },
      STATE_KEY
    );
    database.close();

    const { loadAppState } = await import('./storage');
    const migratedState = await loadAppState();

    expect(migratedState).toEqual({
      ...DEFAULT_APP_STATE,
      selectedAirportKey: 'pack-eham::EHAM',
      selectedFeedIds: ['tower'],
      feedSquelchThresholdsDb: {}
    });
  });

  it('serializes saves so the latest state wins', async () => {
    const { loadAppState, saveAppState } = await import('./storage');

    await Promise.all([
      saveAppState({
        ...DEFAULT_APP_STATE,
        selectedFeedIds: ['tower'],
        feedSquelchThresholdsDb: {
          tower: -60
        }
      }),
      saveAppState({
        ...DEFAULT_APP_STATE,
        selectedFeedIds: ['ground'],
        feedSquelchThresholdsDb: {
          ground: -45
        }
      })
    ]);

    expect(await loadAppState()).toEqual({
      ...DEFAULT_APP_STATE,
      selectedFeedIds: ['ground'],
      feedSquelchThresholdsDb: {
        ground: -45
      }
    });
  });
});
