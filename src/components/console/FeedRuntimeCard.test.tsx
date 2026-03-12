import { cleanup, render, screen } from '@testing-library/react';
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
  isFloor: false,
  gateOpen: false,
  level: 0.08,
  peak: 0.12,
  status: 'ready'
};

afterEach(() => {
  cleanup();
});

function renderCard(runtime: EngineFeedState) {
  render(
    <FeedRuntimeCard
      feed={feed}
      priority={1}
      runtime={runtime}
      onFeedSquelchChange={vi.fn()}
    />
  );

  return screen.getByRole('heading', { name: feed.label }).closest('article');
}

describe('FeedRuntimeCard', () => {
  it('adds the green podium highlight when the feed has the floor', () => {
    const card = renderCard({
      ...baseRuntime,
      isFloor: true,
      gateOpen: true
    });

    expect(card).toBeTruthy();
    expect(card?.className).toContain('border-success/45');
    expect(card?.className).toContain('shadow-floor');
    expect(card?.className).toContain('transition-[border-color,box-shadow]');
  });

  it('does not add the podium highlight when the feed is not the floor owner', () => {
    const card = renderCard(baseRuntime);

    expect(card).toBeTruthy();
    expect(card?.className).not.toContain('border-success/45');
    expect(card?.className).not.toContain('shadow-floor');
    expect(card?.className).toContain('shadow-panel');
  });
});
