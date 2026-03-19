import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';

afterEach(() => {
  cleanup();
});

describe('AppHeader', () => {
  it('renders the inline status strip and view switch controls', () => {
    const onOpenSettings = vi.fn();
    const onViewChange = vi.fn();

    render(
      <AppHeader
        activeView="library"
        importedAirports={4}
        liveFloorStatus="Idle"
        onOpenSettings={onOpenSettings}
        onViewChange={onViewChange}
        selectedFeeds={7}
      />
    );

    expect(screen.getByText('Imported airports')).toBeTruthy();
    expect(screen.getByText('Selected feeds')).toBeTruthy();
    expect(screen.getByText('Live floor')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Console' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(onViewChange).toHaveBeenCalledWith('console');
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
