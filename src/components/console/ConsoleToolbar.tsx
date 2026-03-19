import { Button, StatusField } from '../ui/common';
import { insetBlockClass } from '../ui/styles';

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
  return (
    <section className={`${insetBlockClass} grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start`}>
      <div className="grid gap-3">
        <div className="space-y-1">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--wt-accent-soft)]">Console</p>
          <h2 className="text-[1.1rem] font-semibold uppercase tracking-[0.05em] text-[var(--wt-text)]">
            {airportName || 'No airport selected'}
          </h2>
          <p className="text-[0.9rem] text-[var(--wt-muted)]">
            {activeSpeaker ? `Current speaker: ${activeSpeaker}` : 'Current speaker: none detected'}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <StatusField label="Current speaker" tone={activeSpeaker ? 'success' : 'neutral'} value={activeSpeaker ?? 'None'} />
          <StatusField
            label="Console state"
            tone={isRunning ? (isResyncing ? 'warning' : 'success') : 'neutral'}
            value={isRunning ? (isResyncing ? 'Resyncing' : 'Running') : 'Standby'}
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Button variant="secondary" onClick={onToggleDebug}>
          {isDebugVisible ? 'Hide debug' : 'Show debug'}
        </Button>
        <Button disabled={!isRunning} variant="secondary" onClick={onStop}>
          Stop
        </Button>
        <Button disabled={!isRunning || isResyncing} variant="secondary" onClick={onResyncAll}>
          {isResyncing ? 'Resyncing...' : 'Resync all'}
        </Button>
        <Button disabled={!canStart} onClick={onStart}>
          Start listening
        </Button>
      </div>
    </section>
  );
}
