import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EngineFeedState, FeedDef } from '../../domain/models';
import { FeedRuntimeCard } from './FeedRuntimeCard';

const feed: FeedDef = {
  id: 'tower',
  label: 'EHEH Tower',
  streamUrl: 'https://example.com/tower',
  defaultPriority: 1
};

const baseRuntime: EngineFeedState = {
  feedId: 'tower',
  label: 'EHEH Tower',
  priority: 1,
  powered: true,
  muted: false,
  isFloor: false,
  gateOpen: false,
  level: 0.08,
  peak: 0.12,
  status: 'ready',
  streamDelayMs: 1400,
  playbackDelayMs: 200
};

afterEach(() => {
  cleanup();
});

function renderCard(runtime: EngineFeedState, controlsDisabled = false) {
  const onFeedPoweredChange = vi.fn();
  const onFeedMutedChange = vi.fn();

  render(
    <FeedRuntimeCard
      controls={{ powered: runtime.powered, muted: runtime.muted }}
      controlsDisabled={controlsDisabled}
      feed={feed}
      priority={1}
      runtime={runtime}
      onFeedMutedChange={onFeedMutedChange}
      onFeedPoweredChange={onFeedPoweredChange}
      onFeedSquelchChange={vi.fn()}
    />
  );

  return {
    article: screen.getByRole('heading', { name: feed.label }).closest('article'),
    onFeedMutedChange,
    onFeedPoweredChange
  };
}

describe('FeedRuntimeCard', () => {
  it('adds the green podium highlight when the feed has the floor', () => {
    const { article } = renderCard({
      ...baseRuntime,
      isFloor: true,
      gateOpen: true
    });

    expect(article).toBeTruthy();
    expect(article?.className).toContain('border-success/45');
    expect(article?.className).toContain('shadow-floor');
    expect(article?.className).toContain('transition-[border-color,box-shadow]');
  });

  it('does not add the podium highlight when the feed is not the floor owner', () => {
    const { article } = renderCard(baseRuntime);

    expect(article).toBeTruthy();
    expect(article?.className).not.toContain('border-success/45');
    expect(article?.className).not.toContain('shadow-floor');
    expect(article?.className).toContain('shadow-panel');
  });

  it('renders power and mute controls and forwards button actions', () => {
    const { onFeedMutedChange, onFeedPoweredChange } = renderCard(baseRuntime);

    fireEvent.click(screen.getByRole('button', { name: 'Power off EHEH Tower' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mute EHEH Tower' }));

    expect(onFeedPoweredChange).toHaveBeenCalledWith('tower', false);
    expect(onFeedMutedChange).toHaveBeenCalledWith('tower', true);
  });

  it('shows powered-off and muted pills without floor highlight', () => {
    const { article } = renderCard({
      ...baseRuntime,
      powered: false,
      muted: true,
      status: 'idle'
    });

    expect(screen.getByText('Powered off')).toBeTruthy();
    expect(screen.getByText('Muted')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Power on EHEH Tower' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unmute EHEH Tower' })).toBeTruthy();
    expect(article?.className).not.toContain('border-success/45');
  });

  it('disables feed controls when the console is not running', () => {
    renderCard(baseRuntime, true);

    expect((screen.getByRole('button', { name: 'Power off EHEH Tower' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Mute EHEH Tower' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows measured extra lag and hover details', () => {
    renderCard(baseRuntime);

    expect(screen.getByText('1.4 s')).toBeTruthy();
    expect(screen.getByText('1.4 s').closest('[title]')?.getAttribute('title')).toContain('Built-in monitor delay: 0.2 s');
    expect(screen.getByText('1.4 s').closest('[title]')?.getAttribute('title')).toContain('Total heard delay: 1.6 s');
  });

  it('hides the lag panel when the browser does not expose a live edge', () => {
    renderCard({
      ...baseRuntime,
      streamDelayMs: null
    });

    expect(screen.queryByText('Extra lag')).toBeNull();
    expect(screen.queryByText('Unknown')).toBeNull();
  });
});
