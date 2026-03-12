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

const engineSnapshot: EngineSnapshot = {
  running: false,
  floorFeedId: null,
  feeds: {
    tower: {
      feedId: 'tower',
      label: 'EHEH Tower',
      priority: 1,
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
      feedPriorities={{ tower: 1 }}
      feedSquelchThresholdsDb={{}}
      engineSnapshot={engineSnapshot}
      isDebugVisible={isDebugVisible}
      onStart={vi.fn()}
      onStop={vi.fn()}
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
});
