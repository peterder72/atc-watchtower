import { memo } from 'react';
import {
  DEFAULT_SQUELCH_THRESHOLD_DB,
  MAX_SQUELCH_THRESHOLD_DB,
  MIN_SQUELCH_THRESHOLD_DB,
  type EngineFeedState,
  type FeedDef
} from '../../domain/models';
import { cn } from '../../lib/cn';
import { Button, MeterRail, StatusField, ToneTag } from '../ui/common';
import { eyebrowClass, feedCardClass, fieldLabelClass, insetBlockClass } from '../ui/styles';

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
  const runtimeStatusTone =
    runtime?.status === 'error'
      ? 'danger'
      : runtime?.status === 'ready'
        ? 'success'
        : runtime?.status === 'loading' || runtime?.status === 'buffering'
          ? 'warning'
          : 'neutral';
  const measuredDelayMs = runtime?.streamDelayMs;
  const delayDetails =
    runtime && measuredDelayMs !== null && measuredDelayMs !== undefined
      ? getDelayDetails(measuredDelayMs, runtime.playbackDelayMs)
      : null;
  const signalLabel = runtime?.isFloor ? 'Talking now' : runtime?.gateOpen ? 'Signal detected' : 'Idle';
  const runtimeLabel = runtime?.status ?? 'idle';
  const meterTone = runtime?.status === 'error' ? 'danger' : runtime?.isFloor ? 'success' : runtime?.gateOpen ? 'accent' : 'neutral';

  return (
    <article
      data-floor={runtime?.isFloor ? 'true' : 'false'}
      data-gate={runtime?.gateOpen ? 'open' : 'closed'}
      className={cn(
        feedCardClass,
        'grid gap-4 transition-[border-color,background-color] duration-150',
        runtime?.isFloor && 'border-[var(--wt-tone-success-border)] bg-[var(--wt-tone-success-bg-faint)]',
        !runtime?.isFloor && runtime?.gateOpen && 'border-[var(--wt-tone-accent-border)]',
        runtime?.status === 'error' && 'border-[var(--wt-tone-danger-border)]'
      )}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="grid gap-1">
          <p className={eyebrowClass}>Feed module</p>
          <h3 className="text-[1rem] font-semibold uppercase tracking-[0.05em] text-[var(--wt-text)]">{feed.label}</h3>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.76rem] text-[var(--wt-muted)]">
            <span>{feed.frequency ?? 'No frequency listed'}</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{feed.streamUrl}</span>
          </div>
        </div>
        <ToneTag tone="accent">P{priority}</ToneTag>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <StatusField label="Signal" tone={!powered ? 'neutral' : gateStatusTone} value={signalLabel} />
        <StatusField label="Runtime" tone={runtimeStatusTone} value={runtimeLabel} />
      </div>

      {!powered || muted ? (
        <div className="flex flex-wrap gap-2">
          {!powered ? <ToneTag tone="danger">Powered off</ToneTag> : null}
          {muted ? <ToneTag tone="warning">Muted</ToneTag> : null}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <StatusField
          className="min-h-[74px]"
          label="Extra lag"
          tone={measuredDelayMs !== null && measuredDelayMs !== undefined ? 'accent' : 'neutral'}
          value={measuredDelayMs !== null && measuredDelayMs !== undefined ? formatSecondsFromMs(measuredDelayMs) : 'N/A'}
        />
        <StatusField
          className="min-h-[74px]"
          label="Monitor delay"
          value={formatSecondsFromMs(runtime?.playbackDelayMs ?? 200)}
        />
        <div className={cn(insetBlockClass, 'grid gap-2')} title={delayDetails ?? undefined}>
          <span className={fieldLabelClass}>Lag note</span>
          <p className="text-[0.8rem] leading-5 text-[var(--wt-muted)]">
            {delayDetails ? 'Browser live-edge data available.' : 'Browser did not expose live-edge delay.'}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          aria-label={`${powered ? 'Power off' : 'Power on'} ${feed.label}`}
          className={powered ? undefined : 'border-[var(--wt-tone-danger-border)] bg-[var(--wt-tone-danger-bg-strong)] text-[var(--wt-danger)]'}
          disabled={controlsDisabled}
          variant="secondary"
          onClick={() => onFeedPoweredChange(feed.id, !powered)}
        >
          {powered ? 'Power off' : 'Power on'}
        </Button>
        <Button
          aria-label={`${muted ? 'Unmute' : 'Mute'} ${feed.label}`}
          className={muted ? 'border-[var(--wt-tone-accent-border)] bg-[var(--wt-tone-accent-bg)] text-[var(--wt-accent)]' : undefined}
          disabled={controlsDisabled}
          variant="secondary"
          onClick={() => onFeedMutedChange(feed.id, !muted)}
        >
          {muted ? 'Unmute' : 'Mute'}
        </Button>
      </div>

      <div className={cn(insetBlockClass, 'grid gap-3')}>
        <div className="flex items-baseline justify-between gap-3">
          <span className={fieldLabelClass}>Squelch</span>
          <strong className="text-[0.85rem] font-semibold text-[var(--wt-text)]">{formatDb(squelchThresholdDb)}</strong>
        </div>
        <input
          aria-label={`Squelch threshold for ${feed.label}`}
          className="w-full"
          type="range"
          min={MIN_SQUELCH_THRESHOLD_DB}
          max={MAX_SQUELCH_THRESHOLD_DB}
          step={1}
          value={squelchThresholdDb}
          onChange={(event) => onFeedSquelchChange(feed.id, event.currentTarget.valueAsNumber)}
        />
        <div className="flex justify-between gap-3 text-[0.72rem] text-[var(--wt-muted)]">
          <span>More open</span>
          <span>Filter more static</span>
        </div>
      </div>

      <MeterRail label="Peak" tone={meterTone} value={level} valueText={formatLevel(runtime?.peak ?? 0)} />

      {runtime?.error ? (
        <p className="rounded-[6px] border border-[var(--wt-tone-danger-border)] bg-[var(--wt-tone-danger-bg)] px-3 py-2 text-[0.82rem] text-[var(--wt-danger)]">
          {runtime.error}
        </p>
      ) : null}
    </article>
  );
});
