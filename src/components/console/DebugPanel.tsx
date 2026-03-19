import {
  DEFAULT_SQUELCH_THRESHOLD_DB,
  type EngineSnapshot,
  type FeedDef
} from '../../domain/models';
import { cn } from '../../lib/cn';
import { eyebrowClass, fieldLabelClass, subPanelClass } from '../ui/styles';

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
    <section className={cn(subPanelClass, 'space-y-4')}>
      <div className="space-y-1">
        <p className={eyebrowClass}>Debug</p>
        <h3 className="text-[1rem] font-semibold uppercase tracking-[0.05em] text-[var(--wt-text)]">Signal pipeline</h3>
      </div>

      <div className="overflow-x-auto rounded-[6px] border border-[var(--wt-border)] bg-[var(--wt-screen)]">
        <table className="min-w-[980px] w-full border-collapse text-left text-[0.78rem] text-[var(--wt-muted)]">
          <thead>
            <tr className="border-b border-[var(--wt-border)]">
              {['Feed', 'Squelch', 'Mode', 'Status', 'Gate', 'Floor', 'Peak', 'Time', 'Ready', 'Net', 'Tracks', 'Debug'].map(
                (label) => (
                  <th key={label} className={cn(fieldLabelClass, 'px-3 py-2')}>
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {feeds.map((feed) => {
              const runtime = engineSnapshot.feeds[feed.id];
              const squelchThresholdDb = feedSquelchThresholdsDb[feed.id] ?? DEFAULT_SQUELCH_THRESHOLD_DB;

              return (
                <tr key={feed.id} className="border-b border-[var(--wt-border)] last:border-b-0">
                  <td className="px-3 py-2 font-semibold uppercase tracking-[0.04em] text-[var(--wt-text)]">{feed.label}</td>
                  <td className="px-3 py-2">{formatDb(squelchThresholdDb)}</td>
                  <td className="px-3 py-2">{runtime?.analysisMode ?? 'none'}</td>
                  <td className="px-3 py-2">{runtime?.status ?? 'idle'}</td>
                  <td className="px-3 py-2">{runtime?.gateOpen ? 'open' : 'closed'}</td>
                  <td className="px-3 py-2">{runtime?.isFloor ? 'yes' : 'no'}</td>
                  <td className="px-3 py-2">{formatLevel(runtime?.peak ?? 0)}</td>
                  <td className="px-3 py-2">{formatTime(runtime?.currentTime)}</td>
                  <td className="px-3 py-2">{runtime?.readyState ?? -1}</td>
                  <td className="px-3 py-2">{runtime?.networkState ?? -1}</td>
                  <td className="px-3 py-2">{runtime?.captureTrackCount ?? 0}</td>
                  <td className="px-3 py-2">{runtime?.debug ?? 'no debug message'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
