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
    expect(article?.getAttribute('data-floor')).toBe('true');
    expect(article?.className).toContain('border-[var(--wt-tone-success-border)]');
    expect(screen.getByText('Talking now')).toBeTruthy();
  });

  it('marks a non-floor open feed as an active signal', () => {
    const { article } = renderCard({
      ...baseRuntime,
      gateOpen: true
    });

    expect(article).toBeTruthy();
    expect(article?.getAttribute('data-floor')).toBe('false');
    expect(article?.getAttribute('data-gate')).toBe('open');
    expect(article?.className).toContain('border-[var(--wt-tone-accent-border)]');
    expect(screen.getByText('Signal detected')).toBeTruthy();
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

    expect(screen.getByText(/powered off/i)).toBeTruthy();
    expect(screen.getByText(/muted/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Power on EHEH Tower' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unmute EHEH Tower' })).toBeTruthy();
    expect(article?.getAttribute('data-floor')).toBe('false');
  });

  it('disables feed controls when the console is not running', () => {
    renderCard(baseRuntime, true);

    expect((screen.getByRole('button', { name: 'Power off EHEH Tower' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Mute EHEH Tower' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows measured extra lag and hover details', () => {
    renderCard(baseRuntime);

    expect(screen.getByText('1.6 s')).toBeTruthy();
    expect(screen.getByText('Net 1.4 s + Monitor 0.2 s').closest('[title]')?.getAttribute('title')).toContain(
      'Built-in monitor delay: 0.2 s'
    );
    expect(screen.getByText('Net 1.4 s + Monitor 0.2 s').closest('[title]')?.getAttribute('title')).toContain(
      'Total heard delay: 1.6 s'
    );
  });

  it('shows an unavailable lag state when the browser does not expose a live edge', () => {
    renderCard({
      ...baseRuntime,
      streamDelayMs: null
    });

    expect(screen.getByText('Heard delay')).toBeTruthy();
    expect(screen.getByText('0.2 s')).toBeTruthy();
    expect(screen.getByText('Monitor only')).toBeTruthy();
  });
});
