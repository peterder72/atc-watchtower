import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import { ConsoleView } from './components/ConsoleView';
import { LibraryView } from './components/LibraryView';
import { PriorityAudioEngine } from './audio/priorityAudioEngine';
import {
  clampSquelchThresholdDb,
  DEFAULT_SQUELCH_THRESHOLD_DB,
  DEFAULT_APP_STATE,
  type AppState,
  createAirportKey,
  type EngineSnapshot,
  type FeedSelection,
  type ImportNotice,
  type StoredFeedPack
} from './domain/models';
import {
  consolidateStoredPacks,
  createPriorityMapForPacks,
  createStoredFeedPack,
  filterPackByValidatedFeeds,
  formatAirportLabel,
  listAirportEntries,
  moveFeedToAirport,
  parseFeedImport,
  reorderFeedWithinAirport
} from './lib/feedPacks';
import { loadAppState, saveAppState } from './lib/storage';
import { validateStreamUrl } from './lib/streams';

const EMPTY_ENGINE_SNAPSHOT: EngineSnapshot = {
  running: false,
  floorFeedId: null,
  feeds: {}
};

function remapAirportKey(airportKey: string | null, packIdMap: Record<string, string>): string | null {
  if (!airportKey) {
    return null;
  }

  const [packId, icao] = airportKey.split('::');
  if (!packId || !icao) {
    return airportKey;
  }

  return createAirportKey(packIdMap[packId] ?? packId, icao);
}

function normalizeAppState(previous: AppState, nextPacks: AppState['packs'], preferredAirportKeys: Array<string | null> = []): AppState {
  const consolidation = consolidateStoredPacks(nextPacks);
  const airports = listAirportEntries(consolidation.packs);
  const availableAirportKeys = new Set(airports.map((entry) => entry.key));
  const availableFeedIds = new Set(
    consolidation.packs.flatMap((pack) => pack.airports.flatMap((airport) => airport.feeds.map((feed) => feed.id)))
  );

  const selectedAirportKey =
    [...preferredAirportKeys, previous.selectedAirportKey]
      .map((airportKey) => remapAirportKey(airportKey, consolidation.packIdMap))
      .find((airportKey): airportKey is string => {
        if (!airportKey) {
          return false;
        }

        return availableAirportKeys.has(airportKey);
      }) ??
    airports[0]?.key ??
    null;

  return {
    packs: consolidation.packs,
    selectedFeedIds: previous.selectedFeedIds
      .map((feedId) => consolidation.feedIdMap[feedId] ?? feedId)
      .filter((feedId, index, collection) => availableFeedIds.has(feedId) && collection.indexOf(feedId) === index),
    selectedAirportKey
  };
}

export default function App() {
  const [appState, setAppState] = useState(DEFAULT_APP_STATE);
  const [activeView, setActiveView] = useState<'library' | 'console'>('library');
  const [engineSnapshot, setEngineSnapshot] = useState<EngineSnapshot>(EMPTY_ENGINE_SNAPSHOT);
  const [feedSquelchThresholdsDb, setFeedSquelchThresholdsDb] = useState<Record<string, number>>({});
  const [importNotices, setImportNotices] = useState<ImportNotice[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const engineRef = useRef<PriorityAudioEngine | null>(null);

  useEffect(() => {
    const engine = new PriorityAudioEngine();
    engineRef.current = engine;

    const unsubscribe = engine.subscribe(setEngineSnapshot);

    return () => {
      unsubscribe();
      void engine.stop();
    };
  }, []);

  useEffect(() => {
    void loadAppState()
      .then((storedState) => {
        const normalizedState = normalizeAppState(
          {
            ...storedState,
            packs: []
          },
          storedState.packs
        );

        startTransition(() => {
          setAppState(normalizedState);
          setIsHydrated(true);
        });
      })
      .catch(() => {
        setIsHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void saveAppState(appState);
  }, [appState, isHydrated]);

  const airports = useMemo(() => listAirportEntries(appState.packs), [appState.packs]);
  const feedPriorities = useMemo(() => createPriorityMapForPacks(appState.packs), [appState.packs]);
  const activeFeedSquelchThresholdsDb = useMemo(() => {
    const availableFeedIds = new Set(
      appState.packs.flatMap((pack) => pack.airports.flatMap((airport) => airport.feeds.map((feed) => feed.id)))
    );

    return Object.fromEntries(
      Object.entries(feedSquelchThresholdsDb).filter(([feedId]) => availableFeedIds.has(feedId))
    );
  }, [appState.packs, feedSquelchThresholdsDb]);

  useEffect(() => {
    engineRef.current?.setPriorities(feedPriorities);
  }, [feedPriorities]);

  useEffect(() => {
    engineRef.current?.setFeedSquelchThresholds(activeFeedSquelchThresholdsDb);
  }, [activeFeedSquelchThresholdsDb]);

  const selectedAirport = useMemo(
    () => airports.find((entry) => entry.key === appState.selectedAirportKey) ?? airports[0] ?? null,
    [airports, appState.selectedAirportKey]
  );
  const selectedAirportKey = selectedAirport?.key ?? null;
  const airportFeeds = selectedAirport?.airport.feeds ?? [];
  const selectedFeedIdsSet = new Set(appState.selectedFeedIds);
  const selectedFeeds = airportFeeds.filter((feed) => selectedFeedIdsSet.has(feed.id));

  const handleImportFiles = async (files: FileList | null) => {
    const nextFiles = Array.from(files ?? []);
    if (nextFiles.length === 0) {
      return;
    }

    setIsImporting(true);
    const nextPacks: StoredFeedPack[] = [];
    const notices: ImportNotice[] = [];

    for (const file of nextFiles) {
      try {
        const parsedPack = parseFeedImport(file.name, await file.text());
        const uniqueUrls = [...new Set(parsedPack.airports.flatMap((airport) => airport.feeds.map((feed) => feed.streamUrl)))];
        const validations = Object.fromEntries(
          await Promise.all(uniqueUrls.map(async (streamUrl) => [streamUrl, await validateStreamUrl(streamUrl)] as const))
        );
        const filteredPack = filterPackByValidatedFeeds(parsedPack, validations);

        for (const result of Object.values(validations)) {
          if (!result.ok) {
            notices.push({
              fileName: file.name,
              level: 'warning',
              message: `${result.streamUrl} was skipped: ${result.reason ?? 'not browser-readable'}`
            });
          }
        }

        if (filteredPack.airports.length === 0) {
          notices.push({
            fileName: file.name,
            level: 'error',
            message: 'No compatible direct stream URLs remained after validation.'
          });
          continue;
        }

        nextPacks.push(createStoredFeedPack(filteredPack, file.name));
        const airportSummary = filteredPack.airports.length === 1 ? ` into ${filteredPack.airports[0].icao}` : '';
        notices.push({
          fileName: file.name,
          level: 'info',
          message: `Imported ${filteredPack.airports.reduce((sum, airport) => sum + airport.feeds.length, 0)} compatible feeds${airportSummary}.`
        });
      } catch (error) {
        notices.push({
          fileName: file.name,
          level: 'error',
          message: error instanceof Error ? error.message : 'Import failed.'
        });
      }
    }

    if (nextPacks.length > 0) {
      startTransition(() => {
        setAppState((previous) => normalizeAppState(previous, [...previous.packs, ...nextPacks]));
      });
    }

    setImportNotices(notices);
    setIsImporting(false);
  };

  const handleAirportChange = (airportKey: string) => {
    setAppState((previous) => ({
      ...previous,
      selectedAirportKey: airportKey
    }));
  };

  const handleToggleFeed = (feedId: string) => {
    setAppState((previous) => {
      const selectedFeedIds = previous.selectedFeedIds.includes(feedId)
        ? previous.selectedFeedIds.filter((id) => id !== feedId)
        : [...previous.selectedFeedIds, feedId];

      return {
        ...previous,
        selectedFeedIds
      };
    });
  };

  const handleReorderFeed = (draggedFeedId: string, targetFeedId: string) => {
    if (!selectedAirportKey) {
      return;
    }

    setAppState((previous) =>
      normalizeAppState(
        previous,
        reorderFeedWithinAirport(previous.packs, selectedAirportKey, draggedFeedId, targetFeedId),
        [selectedAirportKey]
      )
    );
  };

  const handleMoveFeed = (feedId: string, sourceAirportKey: string, targetAirportKey: string) => {
    setAppState((previous) =>
      normalizeAppState(
        previous,
        moveFeedToAirport(previous.packs, sourceAirportKey, targetAirportKey, feedId),
        [previous.selectedAirportKey, targetAirportKey]
      )
    );
  };

  const handleFeedSquelchChange = (feedId: string, thresholdDb: number) => {
    const nextThresholdDb = clampSquelchThresholdDb(thresholdDb);

    setFeedSquelchThresholdsDb((previous) => {
      if (nextThresholdDb === DEFAULT_SQUELCH_THRESHOLD_DB) {
        if (previous[feedId] === undefined) {
          return previous;
        }

        const nextThresholds = { ...previous };
        delete nextThresholds[feedId];
        return nextThresholds;
      }

      if (previous[feedId] === nextThresholdDb) {
        return previous;
      }

      return {
        ...previous,
        [feedId]: nextThresholdDb
      };
    });
  };

  const handleStartListening = async () => {
    if (!engineRef.current || selectedFeeds.length === 0) {
      return;
    }

    const selections: FeedSelection[] = selectedFeeds.map((feed, index) => ({
      feed,
      priority: feedPriorities[feed.id] ?? index + 1,
      order: index
    }));

    await engineRef.current.start(selections);
    setActiveView('console');
  };

  const handleStopListening = async () => {
    await engineRef.current?.stop();
  };

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">ATC Watchtower</p>
          <h1>Multi-feed listening without popup clutter.</h1>
          <p className="hero-copy">
            Import direct audio playlists, pick an airport, arrange the feed order, and let priority arbitration decide what stays on air.
          </p>
        </div>

        <nav className="mode-toggle" aria-label="Primary views">
          <button
            className={activeView === 'library' ? 'is-selected' : undefined}
            type="button"
            onClick={() => setActiveView('library')}
          >
            Library
          </button>
          <button
            className={activeView === 'console' ? 'is-selected' : undefined}
            type="button"
            onClick={() => setActiveView('console')}
          >
            Console
          </button>
        </nav>
      </header>

      <main className="workspace">
        <section className="status-strip">
          <article>
            <span>Imported airports</span>
            <strong>{airports.length}</strong>
          </article>
          <article>
            <span>Selected feeds</span>
            <strong>{selectedFeeds.length}</strong>
          </article>
          <article>
            <span>Live floor</span>
            <strong>{engineSnapshot.floorFeedId ? 'Active' : 'Idle'}</strong>
          </article>
        </section>

        {activeView === 'library' ? (
          <LibraryView
            airports={airports}
            selectedAirportKey={selectedAirportKey}
            feeds={airportFeeds}
            selectedFeedIds={appState.selectedFeedIds}
            feedPriorities={feedPriorities}
            importNotices={importNotices}
            isBusy={isImporting}
            isListening={engineSnapshot.running}
            onImportFiles={handleImportFiles}
            onAirportChange={handleAirportChange}
            onToggleFeed={handleToggleFeed}
            onReorderFeed={handleReorderFeed}
            onMoveFeed={handleMoveFeed}
          />
        ) : (
          <ConsoleView
            airportName={selectedAirport ? formatAirportLabel(selectedAirport.airport, selectedAirport.packName) : ''}
            feeds={selectedFeeds}
            feedPriorities={feedPriorities}
            feedSquelchThresholdsDb={activeFeedSquelchThresholdsDb}
            engineSnapshot={engineSnapshot}
            onStart={handleStartListening}
            onStop={handleStopListening}
            onFeedSquelchChange={handleFeedSquelchChange}
          />
        )}
      </main>
    </div>
  );
}
