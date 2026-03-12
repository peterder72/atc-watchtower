import { Button, SectionHeading } from '../ui/common';

interface ConsoleToolbarProps {
  activeSpeaker: string | null;
  airportName: string;
  canStart: boolean;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function ConsoleToolbar({
  activeSpeaker,
  airportName,
  canStart,
  isRunning,
  onStart,
  onStop
}: ConsoleToolbarProps) {
  return (
    <SectionHeading
      actions={
        <>
          <Button disabled={!isRunning} variant="secondary" onClick={onStop}>
            Stop
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
