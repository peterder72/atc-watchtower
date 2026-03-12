import {
  DEFAULT_SQUELCH_THRESHOLD_DB,
  type EngineSnapshot,
  type FeedDef
} from '../../domain/models';
import { cn } from '../../lib/cn';
import { eyebrowClass, subPanelClass } from '../ui/styles';

interface DebugPanelProps {
  engineSnapshot: EngineSnapshot;
  feedSquelchThresholdsDb: Record<string, number>;
  feeds: FeedDef[];
}

function formatLevel(value: number): string {
  return `${(value * 100).toFixed(value < 0.01 ? 1 : 0)}%`;
}

function formatTime(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return value.toFixed(1);
}

function formatDb(value: number): string {
  return `${value} dB`;
}

export function DebugPanel({ engineSnapshot, feedSquelchThresholdsDb, feeds }: DebugPanelProps) {
  return (
    <section className={cn(subPanelClass, 'space-y-4 bg-slate-950/95')}>
      <div className="space-y-1">
        <p className={eyebrowClass}>Debug</p>
        <h3 className="text-lg font-semibold tracking-tight text-stone-100">Signal pipeline</h3>
      </div>

      <div className="grid gap-3">
        {feeds.map((feed) => {
          const runtime = engineSnapshot.feeds[feed.id];
          const squelchThresholdDb = feedSquelchThresholdsDb[feed.id] ?? DEFAULT_SQUELCH_THRESHOLD_DB;

          return (
            <div
              key={feed.id}
              className="grid gap-2 rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-slate-300 lg:grid-cols-[repeat(5,minmax(0,1fr))]"
            >
              <strong className="text-stone-100 lg:col-span-5">{feed.label}</strong>
              <span>squelch: {formatDb(squelchThresholdDb)}</span>
              <span>mode: {runtime?.analysisMode ?? 'none'}</span>
              <span>status: {runtime?.status ?? 'idle'}</span>
              <span>gate: {runtime?.gateOpen ? 'open' : 'closed'}</span>
              <span>floor: {runtime?.isFloor ? 'yes' : 'no'}</span>
              <span>peak: {formatLevel(runtime?.peak ?? 0)}</span>
              <span>readyState: {runtime?.readyState ?? -1}</span>
              <span>networkState: {runtime?.networkState ?? -1}</span>
              <span>currentTime: {formatTime(runtime?.currentTime)}</span>
              <span>paused: {runtime?.paused ? 'yes' : 'no'}</span>
              <span>captureTracks: {runtime?.captureTrackCount ?? 0}</span>
              <span className="lg:col-span-4">{runtime?.debug ?? 'no debug message'}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
