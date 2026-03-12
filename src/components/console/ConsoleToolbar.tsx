import { Button, SectionHeading } from '../ui/common';

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
    <SectionHeading
      actions={
        <>
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
        </>
      }
      eyebrow="Console"
      title={airportName || 'No airport selected'}
      description={activeSpeaker ? `Current speaker: ${activeSpeaker}` : 'Current speaker: none detected'}
    />
  );
}
