import {
  DEFAULT_SQUELCH_THRESHOLD_DB,
  type EngineSnapshot,
  type FeedDef
} from '../domain/models';
import { DebugPanel } from './console/DebugPanel';
import { ConsoleToolbar } from './console/ConsoleToolbar';
import { FeedRuntimeCard } from './console/FeedRuntimeCard';
import { EmptyState } from './ui/common';
import { panelClass } from './ui/styles';
interface ConsoleViewProps {
  airportName: string;
  feeds: FeedDef[];
  feedControls: Record<string, { powered: boolean; muted: boolean }>;
  feedPriorities: Record<string, number>;
  feedSquelchThresholdsDb: Record<string, number>;
  engineSnapshot: EngineSnapshot;
  isDebugVisible: boolean;
  isRunning: boolean;
  isResyncing: boolean;
  onStart: () => void;
  onResyncAll: () => void;
  onStop: () => void;
  onFeedMutedChange: (feedId: string, muted: boolean) => void;
  onFeedPoweredChange: (feedId: string, powered: boolean) => void;
  onFeedSquelchChange: (feedId: string, thresholdDb: number) => void;
  onToggleDebug: () => void;
}

export function ConsoleView({
  airportName,
  feeds,
  feedControls,
  feedPriorities,
  feedSquelchThresholdsDb,
  engineSnapshot,
  isDebugVisible,
  isRunning,
  isResyncing,
  onStart,
  onResyncAll,
  onStop,
  onFeedMutedChange,
  onFeedPoweredChange,
  onFeedSquelchChange,
  onToggleDebug
}: ConsoleViewProps) {
  const canStart = feeds.length > 0 && !isRunning;
  const activeSpeaker = engineSnapshot.floorFeedId
    ? feeds.find((feed) => feed.id === engineSnapshot.floorFeedId)?.label ?? engineSnapshot.floorFeedId
    : null;

  return (
    <section className={`${panelClass} space-y-4`}>
      <ConsoleToolbar
        activeSpeaker={activeSpeaker}
        airportName={airportName}
        canStart={canStart}
        isDebugVisible={isDebugVisible}
        isRunning={isRunning}
        isResyncing={isResyncing}
        onStart={onStart}
        onResyncAll={onResyncAll}
        onStop={onStop}
        onToggleDebug={onToggleDebug}
      />

      {feeds.length === 0 ? (
        <EmptyState>Select one or more feeds in the Library before starting the console.</EmptyState>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {feeds.map((feed) => {
              return (
                <FeedRuntimeCard
                  key={feed.id}
                  feed={feed}
                  controls={feedControls[feed.id] ?? { powered: true, muted: false }}
                  controlsDisabled={!isRunning}
                  priority={feedPriorities[feed.id] ?? feed.defaultPriority}
                  runtime={engineSnapshot.feeds[feed.id]}
                  onFeedMutedChange={onFeedMutedChange}
                  onFeedPoweredChange={onFeedPoweredChange}
                  squelchThresholdDb={feedSquelchThresholdsDb[feed.id] ?? DEFAULT_SQUELCH_THRESHOLD_DB}
                  onFeedSquelchChange={onFeedSquelchChange}
                />
              );
            })}
          </div>
          {isDebugVisible ? (
            <DebugPanel engineSnapshot={engineSnapshot} feedSquelchThresholdsDb={feedSquelchThresholdsDb} feeds={feeds} />
          ) : null}
        </>
      )}
    </section>
  );
}
