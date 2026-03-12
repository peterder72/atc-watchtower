import { memo } from 'react';
import {
  DEFAULT_SQUELCH_THRESHOLD_DB,
  MAX_SQUELCH_THRESHOLD_DB,
  MIN_SQUELCH_THRESHOLD_DB,
  type EngineFeedState,
  type FeedDef
} from '../../domain/models';
import { cn } from '../../lib/cn';
import { StatusPill } from '../ui/common';
import { eyebrowClass, feedCardClass, insetBlockClass } from '../ui/styles';

interface FeedRuntimeCardProps {
  feed: FeedDef;
  priority: number;
  runtime?: EngineFeedState;
  squelchThresholdDb?: number;
  onFeedSquelchChange: (feedId: string, thresholdDb: number) => void;
}

function formatLevel(value: number): string {
  return `${(value * 100).toFixed(value < 0.01 ? 1 : 0)}%`;
}

function formatDb(value: number): string {
  return `${value} dB`;
}

export const FeedRuntimeCard = memo(function FeedRuntimeCard({
  feed,
  priority,
  runtime,
  squelchThresholdDb = DEFAULT_SQUELCH_THRESHOLD_DB,
  onFeedSquelchChange
}: FeedRuntimeCardProps) {
  const level = runtime ? Math.min(runtime.peak * 600, 100) : 0;
  const gateStatusTone = runtime?.isFloor ? 'success' : runtime?.gateOpen ? 'warning' : 'neutral';
  const runtimeStatusTone = runtime?.status === 'error' ? 'danger' : 'neutral';

  return (
    <article
      className={cn(
        feedCardClass,
        'grid gap-4 transition-[border-color,box-shadow] duration-150',
        runtime?.isFloor ? 'border-success/45 shadow-floor' : 'shadow-panel'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className={eyebrowClass}>Feed</p>
          <h3 className="text-lg font-semibold tracking-tight text-stone-100">{feed.label}</h3>
        </div>
        <StatusPill tone="accent">P{priority}</StatusPill>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusPill tone={gateStatusTone}>
          {runtime?.isFloor ? 'Talking now' : runtime?.gateOpen ? 'Signal detected' : 'Idle'}
        </StatusPill>
        <StatusPill tone={runtimeStatusTone}>{runtime?.status ?? 'idle'}</StatusPill>
      </div>

      <div className={cn(insetBlockClass, 'grid gap-3')}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Squelch</span>
          <strong className="text-sm font-semibold text-stone-100">{formatDb(squelchThresholdDb)}</strong>
        </div>
        <input
          aria-label={`Squelch threshold for ${feed.label}`}
          className="w-full accent-accent"
          type="range"
          min={MIN_SQUELCH_THRESHOLD_DB}
          max={MAX_SQUELCH_THRESHOLD_DB}
          step={1}
          value={squelchThresholdDb}
          onChange={(event) => onFeedSquelchChange(feed.id, event.currentTarget.valueAsNumber)}
        />
        <div className="flex justify-between gap-3 text-xs text-slate-400">
          <span>More open</span>
          <span>Filter more static</span>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
          <span>Peak</span>
          <span>{formatLevel(runtime?.peak ?? 0)}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/8">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-teal to-accent transition-[width] duration-75"
            style={{ width: `${level}%` }}
          />
        </div>
      </div>

      {runtime?.error ? <p className="text-sm text-rose-200">{runtime.error}</p> : null}
    </article>
  );
});
