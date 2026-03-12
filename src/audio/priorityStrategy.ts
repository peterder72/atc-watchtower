import type { ArbitrationStrategy, FeedActivityEvent } from '../domain/models';

interface ActiveFeed {
  openedAt: number;
  priority: number;
  order: number;
}

export class PriorityStrategy implements ArbitrationStrategy {
  readonly mode = 'priority' as const;

  private readonly priorities = new Map<string, { priority: number; order: number }>();

  private readonly activeFeeds = new Map<string, ActiveFeed>();

  reset(): void {
    this.priorities.clear();
    this.activeFeeds.clear();
  }

  registerFeed(feedId: string, priority: number, order: number): void {
    this.priorities.set(feedId, { priority, order });
  }

  updatePriority(feedId: string, priority: number): void {
    const existing = this.priorities.get(feedId);
    if (!existing) {
      return;
    }

    this.priorities.set(feedId, { ...existing, priority });

    const active = this.activeFeeds.get(feedId);
    if (active) {
      active.priority = priority;
    }
  }

  onFeedEvent(event: FeedActivityEvent): void {
    if (event.type === 'gate-open') {
      const registration = this.priorities.get(event.feedId);
      if (!registration) {
        return;
      }

      this.activeFeeds.set(event.feedId, {
        openedAt: event.at,
        priority: registration.priority,
        order: registration.order
      });
    }

    if (event.type === 'gate-close') {
      this.activeFeeds.delete(event.feedId);
    }
  }

  getFloorFeedId(): string | null {
    let winner: [string, ActiveFeed] | undefined;

    for (const candidate of this.activeFeeds.entries()) {
      if (!winner) {
        winner = candidate;
        continue;
      }

      const [candidateId, candidateFeed] = candidate;
      const [winnerId, winnerFeed] = winner;

      if (
        candidateFeed.priority < winnerFeed.priority ||
        (candidateFeed.priority === winnerFeed.priority && candidateFeed.openedAt < winnerFeed.openedAt) ||
        (
          candidateFeed.priority === winnerFeed.priority &&
          candidateFeed.openedAt === winnerFeed.openedAt &&
          candidateFeed.order < winnerFeed.order
        )
      ) {
        winner = [candidateId, candidateFeed];
      } else {
        winner = [winnerId, winnerFeed];
      }
    }

    return winner?.[0] ?? null;
  }
}
