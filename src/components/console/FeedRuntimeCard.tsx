import { memo } from 'react';
import {
  DEFAULT_SQUELCH_THRESHOLD_DB,
  MAX_SQUELCH_THRESHOLD_DB,
  MIN_SQUELCH_THRESHOLD_DB,
  type EngineFeedState,
  type FeedDef
} from '../../domain/models';
import { cn } from '../../lib/cn';
import { Button, StatusPill } from '../ui/common';
import { eyebrowClass, feedCardClass, insetBlockClass } from '../ui/styles';

interface FeedRuntimeCardProps {
  controls: {
    powered: boolean;
    muted: boolean;
  };
  controlsDisabled: boolean;
  feed: FeedDef;
  priority: number;
  runtime?: EngineFeedState;
  onFeedMutedChange: (feedId: string, muted: boolean) => void;
  onFeedPoweredChange: (feedId: string, powered: boolean) => void;
  squelchThresholdDb?: number;
  onFeedSquelchChange: (feedId: string, thresholdDb: number) => void;
}

function formatLevel(value: number): string {
  return `${(value * 100).toFixed(value < 0.01 ? 1 : 0)}%`;
}

function formatDb(value: number): string {
  return `${value} dB`;
}

function formatSecondsFromMs(valueMs: number): string {
  const valueSeconds = valueMs / 1000;
  return `${valueSeconds.toFixed(valueSeconds >= 10 ? 0 : 1)} s`;
}

function getDelayDetails(streamDelayMs: number, playbackDelayMs: number): string {
  const extraLag = formatSecondsFromMs(streamDelayMs);
  const builtInDelay = formatSecondsFromMs(playbackDelayMs);
  const totalDelay = formatSecondsFromMs(streamDelayMs + playbackDelayMs);
  return `Extra stream lag: ${extraLag}\nBuilt-in monitor delay: ${builtInDelay}\nTotal heard delay: ${totalDelay}`;
}

export const FeedRuntimeCard = memo(function FeedRuntimeCard({
  controls,
  controlsDisabled,
  feed,
  priority,
  runtime,
  onFeedMutedChange,
  onFeedPoweredChange,
  squelchThresholdDb = DEFAULT_SQUELCH_THRESHOLD_DB,
  onFeedSquelchChange
}: FeedRuntimeCardProps) {
  const powered = runtime?.powered ?? controls.powered;
  const muted = runtime?.muted ?? controls.muted;
  const level = runtime ? Math.min(runtime.peak * 600, 100) : 0;
  const gateStatusTone = runtime?.isFloor ? 'success' : runtime?.gateOpen ? 'warning' : 'neutral';
  const runtimeStatusTone = runtime?.status === 'error' ? 'danger' : 'neutral';
  const measuredDelayMs = runtime?.streamDelayMs;
  const delayDetails =
    runtime && measuredDelayMs !== null && measuredDelayMs !== undefined
      ? getDelayDetails(measuredDelayMs, runtime.playbackDelayMs)
      : null;

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
        <StatusPill tone={!powered ? 'neutral' : gateStatusTone}>
          {runtime?.isFloor ? 'Talking now' : runtime?.gateOpen ? 'Signal detected' : 'Idle'}
        </StatusPill>
        <StatusPill tone={runtimeStatusTone}>{runtime?.status ?? 'idle'}</StatusPill>
        {!powered ? <StatusPill tone="danger">Powered off</StatusPill> : null}
        {muted ? <StatusPill tone="warning">Muted</StatusPill> : null}
      </div>

      {delayDetails ? (
        <div className={cn(insetBlockClass, 'grid gap-2')} title={delayDetails ?? undefined}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Extra lag</span>
            <strong className="text-sm font-semibold text-stone-100">{formatSecondsFromMs(measuredDelayMs)}</strong>
          </div>
          <p className="text-xs text-slate-400">Behind live edge when the browser exposes it.</p>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          aria-label={`${powered ? 'Power off' : 'Power on'} ${feed.label}`}
          className={powered ? undefined : 'border-rose-300/30 bg-rose-300/12 text-rose-100 enabled:hover:bg-rose-300/18'}
          disabled={controlsDisabled}
          variant="secondary"
          onClick={() => onFeedPoweredChange(feed.id, !powered)}
        >
          {powered ? 'Power off' : 'Power on'}
        </Button>
        <Button
          aria-label={`${muted ? 'Unmute' : 'Mute'} ${feed.label}`}
          className={muted ? 'border-amber-300/30 bg-amber-300/12 text-amber-100 enabled:hover:bg-amber-300/18' : undefined}
          disabled={controlsDisabled}
          variant="secondary"
          onClick={() => onFeedMutedChange(feed.id, !muted)}
        >
          {muted ? 'Unmute' : 'Mute'}
        </Button>
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
