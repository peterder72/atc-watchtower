import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EngineSnapshot, FeedDef } from '../domain/models';
import { ConsoleView } from './ConsoleView';

const feeds: FeedDef[] = [
  {
    id: 'tower',
    label: 'EHEH Tower',
    streamUrl: 'https://example.com/tower',
    defaultPriority: 1
  }
];

const runningSnapshot: EngineSnapshot = {
  running: true,
  floorFeedId: null,
  feeds: {
    tower: {
      feedId: 'tower',
      label: 'EHEH Tower',
      priority: 1,
      powered: true,
      muted: false,
      isFloor: false,
      gateOpen: false,
      level: 0,
      peak: 0,
      status: 'idle',
      analysisMode: 'graph',
      currentTime: 0,
      paused: false,
      captureTrackCount: 0,
      debug: 'waiting for stream data'
    }
  }
};

afterEach(() => {
  cleanup();
});

function ConsoleViewHarness() {
  const [isDebugVisible, setIsDebugVisible] = useState(false);

  return (
    <ConsoleView
      airportName="EHEH"
      feeds={feeds}
      feedControls={{ tower: { powered: true, muted: false } }}
      feedPriorities={{ tower: 1 }}
      feedSquelchThresholdsDb={{}}
      engineSnapshot={runningSnapshot}
      isDebugVisible={isDebugVisible}
      isRunning={runningSnapshot.running}
      onStart={vi.fn()}
      onStop={vi.fn()}
      onFeedMutedChange={vi.fn()}
      onFeedPoweredChange={vi.fn()}
      onFeedSquelchChange={vi.fn()}
      onToggleDebug={() => setIsDebugVisible((current) => !current)}
    />
  );
}

describe('ConsoleView', () => {
  it('hides the debug panel by default and toggles it from the toolbar', () => {
    render(<ConsoleViewHarness />);

    expect(screen.queryByRole('heading', { name: 'Signal pipeline' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show debug' }));
    expect(screen.getByRole('heading', { name: 'Signal pipeline' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hide debug' }));
    expect(screen.queryByRole('heading', { name: 'Signal pipeline' })).toBeNull();
  });

  it('wires feed power and mute controls to the provided handlers', () => {
    const onFeedPoweredChange = vi.fn();
    const onFeedMutedChange = vi.fn();

    render(
      <ConsoleView
        airportName="EHEH"
        feeds={feeds}
        feedControls={{ tower: { powered: true, muted: false } }}
        feedPriorities={{ tower: 1 }}
        feedSquelchThresholdsDb={{}}
        engineSnapshot={runningSnapshot}
        isDebugVisible={false}
        isRunning={runningSnapshot.running}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onFeedMutedChange={onFeedMutedChange}
        onFeedPoweredChange={onFeedPoweredChange}
        onFeedSquelchChange={vi.fn()}
        onToggleDebug={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Power off EHEH Tower' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mute EHEH Tower' }));

    expect(onFeedPoweredChange).toHaveBeenCalledWith('tower', false);
    expect(onFeedMutedChange).toHaveBeenCalledWith('tower', true);
  });
});
