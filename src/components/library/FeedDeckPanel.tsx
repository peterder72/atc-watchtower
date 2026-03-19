import type { DragEvent } from 'react';
import type { FeedDef } from '../../domain/models';
import { cn } from '../../lib/cn';
import { EmptyState, SectionHeading } from '../ui/common';
import { fieldLabelClass, subPanelClass } from '../ui/styles';

interface FeedDeckPanelProps {
  draggedFeedId: string | null;
  dragOverFeedId: string | null;
  feedPriorities: Record<string, number>;
  feeds: FeedDef[];
  isListening: boolean;
  onFeedDragEnd: () => void;
  onFeedDragLeave: (event: DragEvent, feedId: string) => void;
  onFeedDragOver: (event: DragEvent, feedId: string) => void;
  onFeedDragStart: (event: DragEvent, feedId: string) => void;
  onFeedDrop: (event: DragEvent, feedId: string) => void;
  onToggleFeed: (feedId: string) => void;
  selectedFeedIds: string[];
}

export function FeedDeckPanel({
  draggedFeedId,
  dragOverFeedId,
  feedPriorities,
  feeds,
  isListening,
  onFeedDragEnd,
  onFeedDragLeave,
  onFeedDragOver,
  onFeedDragStart,
  onFeedDrop,
  onToggleFeed,
  selectedFeedIds
}: FeedDeckPanelProps) {
  const selectedFeedIdsSet = new Set(selectedFeedIds);

  return (
    <article className={cn(subPanelClass, 'space-y-4')}>
      <SectionHeading
        eyebrow="Feed Deck"
        level="h3"
        title="Priority Queue"
        description="Drag to reorder. The first row becomes P1 and always wins the floor first."
      />

      {feeds.length === 0 ? (
        <EmptyState>Choose an airport to manage its feed priorities.</EmptyState>
      ) : (
        <div className="grid gap-3">
          <div className="hidden rounded-[6px] border border-[var(--wt-border)] bg-[var(--wt-screen)] px-3 py-2 md:grid md:grid-cols-[auto_auto_minmax(0,1.2fr)_minmax(0,0.9fr)] md:gap-3">
            <span className={fieldLabelClass}>Sel</span>
            <span className={fieldLabelClass}>Pri</span>
            <span className={fieldLabelClass}>Feed</span>
            <span className={fieldLabelClass}>Stream</span>
          </div>
          {feeds.map((feed, index) => {
            const selected = selectedFeedIdsSet.has(feed.id);

            return (
              <label
                key={feed.id}
                data-drag-over={dragOverFeedId === feed.id ? 'true' : 'false'}
                data-selected={selected ? 'true' : 'false'}
                className={cn(
                  'grid gap-3 rounded-[6px] border px-3 py-3 transition md:grid-cols-[auto_auto_minmax(0,1.2fr)_minmax(0,0.9fr)] md:items-center',
                  selected
                    ? 'border-[var(--wt-accent-strong)] bg-[var(--wt-tone-accent-bg-soft)]'
                    : 'border-[var(--wt-border)] bg-[var(--wt-screen)]',
                  draggedFeedId === feed.id && 'opacity-55',
                  dragOverFeedId === feed.id &&
                    'border-[var(--wt-ok)] bg-[var(--wt-tone-success-bg-soft)]',
                  isListening && 'cursor-not-allowed'
                )}
                draggable={!isListening}
                onDragEnd={onFeedDragEnd}
                onDragOver={(event) => onFeedDragOver(event, feed.id)}
                onDragStart={(event) => onFeedDragStart(event, feed.id)}
                onDragLeave={(event) => onFeedDragLeave(event, feed.id)}
                onDrop={(event) => onFeedDrop(event, feed.id)}
              >
                <span className="flex items-center gap-3">
                  <input
                    aria-label={`Select ${feed.label}`}
                    checked={selected}
                    className="h-4 w-4"
                    disabled={isListening}
                    type="checkbox"
                    onChange={() => onToggleFeed(feed.id)}
                  />
                  <span aria-hidden="true" className="text-[0.82rem] text-[var(--wt-muted)] md:hidden">
                    ||
                  </span>
                </span>
                <span className="grid gap-1">
                  <span aria-hidden="true" className="select-none text-[0.82rem] text-[var(--wt-muted)]">
                    ||
                  </span>
                  <strong className="text-[0.9rem] font-semibold uppercase tracking-[0.04em] text-[var(--wt-text)]">
                    P{feedPriorities[feed.id] ?? index + 1}
                  </strong>
                </span>
                <span className="grid min-w-0 gap-1">
                  <strong className="truncate text-[0.9rem] font-semibold uppercase tracking-[0.04em] text-[var(--wt-text)]">
                    {feed.label}
                  </strong>
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-[0.76rem] text-[var(--wt-muted)]">
                    <span>{feed.frequency ?? 'No frequency'}</span>
                    <span>{selected ? 'Selected for console' : 'Not selected'}</span>
                  </span>
                </span>
                <span className="grid min-w-0 gap-1 text-[0.78rem] text-[var(--wt-muted)]">
                  <span className="md:hidden text-[0.72rem] font-semibold uppercase tracking-[0.08em]">Stream</span>
                  <span className="overflow-hidden text-ellipsis [overflow-wrap:anywhere]">{feed.streamUrl}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {isListening ? (
        <EmptyState>Stop listening before changing the airport list or dragging feeds into a new order.</EmptyState>
      ) : null}
    </article>
  );
}
