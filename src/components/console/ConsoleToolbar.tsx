import { Button } from '../ui/common';
import { cn } from '../../lib/cn';
import { eyebrowClass, fieldLabelClass, insetBlockClass } from '../ui/styles';

interface ConsoleToolbarProps {
  activeSpeaker: string | null;
  airportName: string;
  canStart: boolean;
  isDebugVisible: boolean;
  isRunning: boolean;
  isResyncing: boolean;
  onStart: () => void;
  onResyncAll: () => void;
  onStop: () => void;
  onToggleDebug: () => void;
}

export function ConsoleToolbar({
  activeSpeaker,
  airportName,
  canStart,
  isDebugVisible,
  isRunning,
  isResyncing,
  onStart,
  onResyncAll,
  onStop,
  onToggleDebug
}: ConsoleToolbarProps) {
  const consoleState = isRunning ? (isResyncing ? 'Resyncing' : 'Running') : 'Standby';

  return (
    <section className={cn(insetBlockClass, 'grid gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start')}>
      <div className="grid gap-2 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 space-y-1">
            <p className={eyebrowClass}>Console</p>
            <h2 className="truncate text-[1rem] font-semibold uppercase tracking-[0.05em] text-[var(--wt-text)]">
              {airportName || 'No airport selected'}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="grid min-w-[12rem] gap-1 rounded-[6px] border border-[var(--wt-border)] bg-[var(--wt-screen)] px-3 py-2 shadow-[var(--wt-shadow-panel-soft)]">
            <span className={fieldLabelClass}>Current speaker</span>
            <strong className="truncate text-[0.88rem] font-semibold uppercase tracking-[0.04em] text-[var(--wt-text)]">
              {activeSpeaker ?? 'None'}
            </strong>
          </div>
          <div className="grid min-w-[10rem] gap-1 rounded-[6px] border border-[var(--wt-border)] bg-[var(--wt-screen)] px-3 py-2 shadow-[var(--wt-shadow-panel-soft)]">
            <span className={fieldLabelClass}>Console state</span>
            <strong className="text-[0.88rem] font-semibold uppercase tracking-[0.04em] text-[var(--wt-text)]">
              {consoleState}
            </strong>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Button size="compact" variant="secondary" onClick={onToggleDebug}>
          {isDebugVisible ? 'Hide debug' : 'Show debug'}
        </Button>
        <Button disabled={!isRunning} size="compact" variant="secondary" onClick={onStop}>
          Stop
        </Button>
        <Button disabled={!isRunning || isResyncing} size="compact" variant="secondary" onClick={onResyncAll}>
          {isResyncing ? 'Resyncing...' : 'Resync all'}
        </Button>
        <Button disabled={!canStart} size="compact" onClick={onStart}>
          Start listening
        </Button>
      </div>
    </section>
  );
}
