import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioSettingsDialog } from './components/AudioSettingsDialog';
import { ConsoleView } from './components/ConsoleView';
import { LibraryView } from './components/LibraryView';
import { AppHeader } from './components/AppHeader';
import { StatusStrip } from './components/StatusStrip';
import { pageShellClass } from './components/ui/styles';
import { PriorityAudioEngine } from './audio/priorityAudioEngine';
import {
  DEFAULT_AUDIO_PROCESSING_SETTINGS,
  clampSquelchThresholdDb,
  DEFAULT_APP_STATE,
  DEFAULT_SQUELCH_THRESHOLD_DB,
  normalizeAudioProcessingSettings,
  type AudioProcessingSettings,
  type EngineSnapshot,
  type FeedDef,
  type FeedSelection,
  type ImportNotice
} from './domain/models';
import {
  createPriorityMapForPacks,
  formatAirportLabel,
  listAirportEntries,
  moveFeedToAirport,
  reorderFeedWithinAirport
} from './lib/feedPacks';
import { normalizeAppState } from './lib/appState';
import { importFeedFiles } from './lib/importFeeds';
import { loadAppState, saveAppState } from './lib/storage';

const EMPTY_ENGINE_SNAPSHOT: EngineSnapshot = {
  running: false,
  floorFeedId: null,
  feeds: {}
};

interface ConsoleFeedControlState {
  powered: boolean;
  muted: boolean;
}

const DEFAULT_CONSOLE_FEED_CONTROL_STATE: ConsoleFeedControlState = {
  powered: true,
  muted: false
};

function createConsoleFeedControls(feeds: FeedDef[]): Record<string, ConsoleFeedControlState> {
  return Object.fromEntries(feeds.map((feed) => [feed.id, { ...DEFAULT_CONSOLE_FEED_CONTROL_STATE }]));
}

export default function App() {
  const [appState, setAppState] = useState(DEFAULT_APP_STATE);
  const [activeView, setActiveView] = useState<'library' | 'console'>('library');
  const [engineSnapshot, setEngineSnapshot] = useState<EngineSnapshot>(EMPTY_ENGINE_SNAPSHOT);
  const [importNotices, setImportNotices] = useState<ImportNotice[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
  const [isDebugPanelVisible, setIsDebugPanelVisible] = useState(false);
  const [consoleFeedControls, setConsoleFeedControls] = useState<Record<string, ConsoleFeedControlState>>({});
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

    const timeoutId = window.setTimeout(() => {
      void saveAppState(appState);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [appState, isHydrated]);

  const airports = useMemo(() => listAirportEntries(appState.packs), [appState.packs]);
  const feedPriorities = useMemo(() => createPriorityMapForPacks(appState.packs), [appState.packs]);
  const activeFeedSquelchThresholdsDb = appState.feedSquelchThresholdsDb;

  useEffect(() => {
    engineRef.current?.setPriorities(feedPriorities);
  }, [feedPriorities]);

  useEffect(() => {
    engineRef.current?.setFeedSquelchThresholds(activeFeedSquelchThresholdsDb);
  }, [activeFeedSquelchThresholdsDb]);

  useEffect(() => {
    engineRef.current?.setAudioProcessingSettings(appState.audioProcessingSettings);
  }, [appState.audioProcessingSettings]);

  const selectedAirport = useMemo(
    () => airports.find((entry) => entry.key === appState.selectedAirportKey) ?? airports[0] ?? null,
    [airports, appState.selectedAirportKey]
  );
  const selectedAirportKey = selectedAirport?.key ?? null;
  const airportFeeds = selectedAirport?.airport.feeds ?? [];
  const selectedFeedIdsSet = new Set(appState.selectedFeedIds);
  const selectedFeeds = airportFeeds.filter((feed) => selectedFeedIdsSet.has(feed.id));
  const consoleFeedControlStates = useMemo<Record<string, ConsoleFeedControlState>>(
    () =>
      Object.fromEntries(
        selectedFeeds.map((feed) => {
          const runtime = engineSnapshot.feeds[feed.id];
          const control = consoleFeedControls[feed.id];

          return [
            feed.id,
            {
              powered: runtime?.powered ?? control?.powered ?? DEFAULT_CONSOLE_FEED_CONTROL_STATE.powered,
              muted: runtime?.muted ?? control?.muted ?? DEFAULT_CONSOLE_FEED_CONTROL_STATE.muted
            }
          ];
        })
      ),
    [consoleFeedControls, engineSnapshot.feeds, selectedFeeds]
  );

  const handleImportFiles = async (files: FileList | null) => {
    const nextFiles = Array.from(files ?? []);
    if (nextFiles.length === 0) {
      return;
    }

    setIsImporting(true);
    try {
      const { notices, packs } = await importFeedFiles(nextFiles);

      if (packs.length > 0) {
        startTransition(() => {
          setAppState((previous) => normalizeAppState(previous, [...previous.packs, ...packs]));
        });
      }

      setImportNotices(notices);
    } catch (error) {
      setImportNotices([
        {
          fileName: 'Import',
          level: 'error',
          message: error instanceof Error ? error.message : 'Import failed.'
        }
      ]);
    } finally {
      setIsImporting(false);
    }
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

  const handleFeedSquelchChange = useCallback((feedId: string, thresholdDb: number) => {
    const nextThresholdDb = clampSquelchThresholdDb(thresholdDb);

    setAppState((previous) => {
      const previousThresholdDb = previous.feedSquelchThresholdsDb[feedId];

      if (nextThresholdDb === DEFAULT_SQUELCH_THRESHOLD_DB) {
        if (previousThresholdDb === undefined) {
          return previous;
        }

        const nextThresholds = { ...previous.feedSquelchThresholdsDb };
        delete nextThresholds[feedId];

        return {
          ...previous,
          feedSquelchThresholdsDb: nextThresholds
        };
      }

      if (previousThresholdDb === nextThresholdDb) {
        return previous;
      }

      return {
        ...previous,
        feedSquelchThresholdsDb: {
          ...previous.feedSquelchThresholdsDb,
          [feedId]: nextThresholdDb
        }
      };
    });
  }, []);

  const handleStartListening = async () => {
    if (!engineRef.current || selectedFeeds.length === 0) {
      return;
    }

    setConsoleFeedControls(createConsoleFeedControls(selectedFeeds));

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
    setConsoleFeedControls({});
  };

  const handleFeedPoweredChange = useCallback((feedId: string, powered: boolean) => {
    setConsoleFeedControls((previous) => {
      const current = previous[feedId] ?? DEFAULT_CONSOLE_FEED_CONTROL_STATE;

      if (current.powered === powered) {
        return previous;
      }

      return {
        ...previous,
        [feedId]: {
          ...current,
          powered
        }
      };
    });

    engineRef.current?.setFeedPowered(feedId, powered);
  }, []);

  const handleFeedMutedChange = useCallback((feedId: string, muted: boolean) => {
    setConsoleFeedControls((previous) => {
      const current = previous[feedId] ?? DEFAULT_CONSOLE_FEED_CONTROL_STATE;

      if (current.muted === muted) {
        return previous;
      }

      return {
        ...previous,
        [feedId]: {
          ...current,
          muted
        }
      };
    });

    engineRef.current?.setFeedMuted(feedId, muted);
  }, []);

  const handleAudioProcessingSettingChange = useCallback(
    (setting: keyof AudioProcessingSettings, value: number) => {
      setAppState((previous) => {
        const nextAudioProcessingSettings = normalizeAudioProcessingSettings({
          ...previous.audioProcessingSettings,
          [setting]: value
        });

        if (
          nextAudioProcessingSettings.attackMs === previous.audioProcessingSettings.attackMs &&
          nextAudioProcessingSettings.hangMs === previous.audioProcessingSettings.hangMs &&
          nextAudioProcessingSettings.openDeltaDb === previous.audioProcessingSettings.openDeltaDb &&
          nextAudioProcessingSettings.closeGapDb === previous.audioProcessingSettings.closeGapDb
        ) {
          return previous;
        }

        return {
          ...previous,
          audioProcessingSettings: nextAudioProcessingSettings
        };
      });
    },
    []
  );

  const handleResetAudioProcessingSettings = useCallback(() => {
    setAppState((previous) => {
      if (
        previous.audioProcessingSettings.attackMs === DEFAULT_AUDIO_PROCESSING_SETTINGS.attackMs &&
        previous.audioProcessingSettings.hangMs === DEFAULT_AUDIO_PROCESSING_SETTINGS.hangMs &&
        previous.audioProcessingSettings.openDeltaDb === DEFAULT_AUDIO_PROCESSING_SETTINGS.openDeltaDb &&
        previous.audioProcessingSettings.closeGapDb === DEFAULT_AUDIO_PROCESSING_SETTINGS.closeGapDb
      ) {
        return previous;
      }

      return {
        ...previous,
        audioProcessingSettings: { ...DEFAULT_AUDIO_PROCESSING_SETTINGS }
      };
    });
  }, []);

  return (
    <div className={pageShellClass}>
      <AppHeader
        activeView={activeView}
        onOpenSettings={() => setIsAudioSettingsOpen(true)}
        onViewChange={setActiveView}
      />

      <main className="space-y-4">
        <StatusStrip
          importedAirports={airports.length}
          selectedFeeds={selectedFeeds.length}
          liveFloorStatus={engineSnapshot.floorFeedId ? 'Active' : 'Idle'}
        />

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
            feedControls={consoleFeedControlStates}
            feedPriorities={feedPriorities}
            feedSquelchThresholdsDb={activeFeedSquelchThresholdsDb}
            engineSnapshot={engineSnapshot}
            isDebugVisible={isDebugPanelVisible}
            isRunning={engineSnapshot.running}
            onStart={handleStartListening}
            onStop={handleStopListening}
            onFeedMutedChange={handleFeedMutedChange}
            onFeedPoweredChange={handleFeedPoweredChange}
            onFeedSquelchChange={handleFeedSquelchChange}
            onToggleDebug={() => setIsDebugPanelVisible((current) => !current)}
          />
        )}
      </main>

      <AudioSettingsDialog
        isOpen={isAudioSettingsOpen}
        settings={appState.audioProcessingSettings}
        onChange={handleAudioProcessingSettingChange}
        onClose={() => setIsAudioSettingsOpen(false)}
        onReset={handleResetAudioProcessingSettings}
      />
    </div>
  );
}
