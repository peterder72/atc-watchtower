import { Power, PowerOff, Volume2, VolumeX } from 'lucide-react';
import { memo } from 'react';
import {
  DEFAULT_SQUELCH_THRESHOLD_DB,
  MAX_SQUELCH_THRESHOLD_DB,
  MIN_SQUELCH_THRESHOLD_DB,
  type EngineFeedState,
  type FeedDef
} from '../../domain/models';
import { cn } from '../../lib/cn';
import { IconToggleButton, MeterRail, ToneTag } from '../ui/common';
import { compactInsetBlockClass, feedCardClass, fieldLabelClass } from '../ui/styles';

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

function getDelaySummary(runtime: EngineFeedState | undefined): { detail: string; title: string; value: string } {
  const playbackDelayMs = runtime?.playbackDelayMs ?? 200;
  const monitorDelay = formatSecondsFromMs(playbackDelayMs);

  if (!runtime || runtime.streamDelayMs === null || runtime.streamDelayMs === undefined) {
    return {
      detail: 'Monitor only',
      title: `Browser did not expose live-edge delay.\nBuilt-in monitor delay: ${monitorDelay}`,
      value: monitorDelay
    };
  }

  const streamDelay = formatSecondsFromMs(runtime.streamDelayMs);
  return {
    detail: `Net ${streamDelay} + Monitor ${monitorDelay}`,
    title: getDelayDetails(runtime.streamDelayMs, playbackDelayMs),
    value: formatSecondsFromMs(runtime.streamDelayMs + playbackDelayMs)
  };
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
  const gateStatusTone = !powered ? 'danger' : runtime?.isFloor ? 'success' : runtime?.gateOpen ? 'warning' : 'neutral';
  const runtimeStatusTone =
    runtime?.status === 'error'
      ? 'danger'
      : muted
        ? 'warning'
        : runtime?.status === 'ready'
          ? 'success'
          : runtime?.status === 'loading' || runtime?.status === 'buffering'
          ? 'warning'
          : 'neutral';
  const signalLabel = !powered ? 'Powered off' : runtime?.isFloor ? 'Talking now' : runtime?.gateOpen ? 'Signal detected' : 'Idle';
  const runtimeLabel = muted ? `Muted / ${runtime?.status ?? 'idle'}` : runtime?.status ?? 'idle';
  const meterTone = runtime?.status === 'error' ? 'danger' : runtime?.isFloor ? 'success' : runtime?.gateOpen ? 'accent' : 'neutral';
  const delaySummary = getDelaySummary(runtime);

  return (
    <article
      data-floor={runtime?.isFloor ? 'true' : 'false'}
      data-gate={runtime?.gateOpen ? 'open' : 'closed'}
      className={cn(
        feedCardClass,
        'grid gap-3 transition-[border-color,background-color] duration-150',
        runtime?.isFloor && 'border-[var(--wt-tone-success-border)] bg-[var(--wt-tone-success-bg-faint)]',
        !runtime?.isFloor && runtime?.gateOpen && 'border-[var(--wt-tone-accent-border)]',
        runtime?.status === 'error' && 'border-[var(--wt-tone-danger-border)]'
      )}
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <ToneTag className="shrink-0" tone="accent">
            P{priority}
          </ToneTag>
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="truncate text-[0.96rem] font-semibold uppercase tracking-[0.05em] text-[var(--wt-text)]">
                {feed.label}
              </h3>
              <span className="text-[0.74rem] font-semibold uppercase tracking-[0.08em] text-[var(--wt-muted)]">
                {feed.frequency ?? 'No frequency'}
              </span>
            </div>
            <p className="truncate text-[0.76rem] text-[var(--wt-muted)]" title={feed.streamUrl}>
              {feed.streamUrl}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 xl:justify-end">
          <IconToggleButton
            disabled={controlsDisabled}
            icon={<Power aria-hidden="true" className="h-4 w-4" strokeWidth={2} />}
            label={`${powered ? 'Power off' : 'Power on'} ${feed.label}`}
            pressed={!powered}
            pressedIcon={<PowerOff aria-hidden="true" className="h-4 w-4" strokeWidth={2} />}
            pressedTone="danger"
            onClick={() => onFeedPoweredChange(feed.id, !powered)}
          />
          <IconToggleButton
            disabled={controlsDisabled}
            icon={<Volume2 aria-hidden="true" className="h-4 w-4" strokeWidth={2} />}
            label={`${muted ? 'Unmute' : 'Mute'} ${feed.label}`}
            pressed={muted}
            pressedIcon={<VolumeX aria-hidden="true" className="h-4 w-4" strokeWidth={2} />}
            pressedTone="warning"
            onClick={() => onFeedMutedChange(feed.id, !muted)}
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <ToneTag tone={gateStatusTone}>{signalLabel}</ToneTag>
          <ToneTag tone={runtimeStatusTone}>{runtimeLabel}</ToneTag>
        </div>
        <div className={cn(compactInsetBlockClass, 'grid gap-1')} title={delaySummary.title}>
          <span className={fieldLabelClass}>Heard delay</span>
          <strong className="text-[0.86rem] font-semibold uppercase tracking-[0.04em] text-[var(--wt-text)]">
            {delaySummary.value}
          </strong>
          <span className="text-[0.72rem] leading-4 text-[var(--wt-muted)]">{delaySummary.detail}</span>
        </div>
        <MeterRail compact className="min-w-0" label="Peak" tone={meterTone} value={level} valueText={formatLevel(runtime?.peak ?? 0)} />
        <div className={cn(compactInsetBlockClass, 'grid gap-2 sm:col-span-2')}>
          <div className="flex items-center justify-between gap-3">
            <span className={fieldLabelClass}>Squelch</span>
            <strong className="text-[0.8rem] font-semibold text-[var(--wt-text)]">{formatDb(squelchThresholdDb)}</strong>
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
        </div>
      </div>

      {runtime?.error ? (
        <p className="rounded-[6px] border border-[var(--wt-tone-danger-border)] bg-[var(--wt-tone-danger-bg)] px-3 py-2 text-[0.82rem] text-[var(--wt-danger)]">
          {runtime.error}
        </p>
      ) : null}
    </article>
  );
});
