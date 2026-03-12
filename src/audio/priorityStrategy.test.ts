import { describe, expect, it } from 'vitest';
import { PriorityStrategy } from './priorityStrategy';

describe('PriorityStrategy', () => {
  it('prefers lower priority numbers over later opens', () => {
    const strategy = new PriorityStrategy();
    strategy.registerFeed('tower', 3, 0);
    strategy.registerFeed('approach', 1, 1);
    strategy.onFeedEvent({ feedId: 'tower', at: 0, type: 'gate-open' });
    strategy.onFeedEvent({ feedId: 'approach', at: 100, type: 'gate-open' });

    expect(strategy.getFloorFeedId()).toBe('approach');
  });

  it('breaks ties by earlier start, then feed order', () => {
    const strategy = new PriorityStrategy();
    strategy.registerFeed('tower', 2, 1);
    strategy.registerFeed('ground', 2, 0);
    strategy.onFeedEvent({ feedId: 'tower', at: 0, type: 'gate-open' });
    strategy.onFeedEvent({ feedId: 'ground', at: 0, type: 'gate-open' });

    expect(strategy.getFloorFeedId()).toBe('ground');
  });

  it('promotes the remaining active feed when the floor closes', () => {
    const strategy = new PriorityStrategy();
    strategy.registerFeed('tower', 3, 0);
    strategy.registerFeed('approach', 1, 1);
    strategy.onFeedEvent({ feedId: 'tower', at: 0, type: 'gate-open' });
    strategy.onFeedEvent({ feedId: 'approach', at: 50, type: 'gate-open' });
    strategy.onFeedEvent({ feedId: 'approach', at: 120, type: 'gate-close' });

    expect(strategy.getFloorFeedId()).toBe('tower');
  });

  it('clears registrations and active feeds on reset', () => {
    const strategy = new PriorityStrategy();
    strategy.registerFeed('tower', 2, 0);
    strategy.onFeedEvent({ feedId: 'tower', at: 0, type: 'gate-open' });

    strategy.reset();

    expect(strategy.getFloorFeedId()).toBeNull();
    strategy.onFeedEvent({ feedId: 'tower', at: 100, type: 'gate-open' });
    expect(strategy.getFloorFeedId()).toBeNull();
  });
});
