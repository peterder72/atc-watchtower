import type { DragEvent } from 'react';
import type { FeedDef } from '../../domain/models';
import { cn } from '../../lib/cn';
import { EmptyState, SectionHeading } from '../ui/common';
import { subPanelClass } from '../ui/styles';

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
        title="Priority queue"
        description="Drag to reorder. The top row is P1, then P2, and so on."
      />

      {feeds.length === 0 ? (
        <EmptyState>Choose an airport to manage its feed priorities.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {feeds.map((feed, index) => {
            const selected = selectedFeedIdsSet.has(feed.id);

            return (
              <label
                key={feed.id}
                className={cn(
                  'grid gap-3 rounded-[20px] border border-transparent bg-white/[0.03] p-4 transition md:grid-cols-[auto_auto_minmax(0,1fr)_auto] md:items-center',
                  selected && 'border-[rgba(255,138,76,0.3)] bg-[rgba(255,138,76,0.12)]',
                  draggedFeedId === feed.id && 'opacity-55',
                  dragOverFeedId === feed.id &&
                    'border-[rgba(99,212,199,0.45)] bg-[rgba(99,212,199,0.12)] ring-1 ring-inset ring-[rgba(99,212,199,0.18)]',
                  isListening && 'cursor-not-allowed'
                )}
                draggable={!isListening}
                onDragEnd={onFeedDragEnd}
                onDragOver={(event) => onFeedDragOver(event, feed.id)}
                onDragStart={(event) => onFeedDragStart(event, feed.id)}
                onDragLeave={(event) => onFeedDragLeave(event, feed.id)}
                onDrop={(event) => onFeedDrop(event, feed.id)}
              >
                <span className="flex items-center">
                  <input
                    aria-label={`Select ${feed.label}`}
                    checked={selected}
                    className="h-4 w-4 accent-accent"
                    disabled={isListening}
                    type="checkbox"
                    onChange={() => onToggleFeed(feed.id)}
                  />
                </span>
                <span aria-hidden="true" className="select-none text-sm font-semibold tracking-[-0.2em] text-slate-400">
                  ::
                </span>
                <span className="grid min-w-0 gap-1">
                  <strong className="text-sm font-semibold text-stone-100">{feed.label}</strong>
                  <span className="overflow-hidden text-ellipsis text-xs text-slate-400 [overflow-wrap:anywhere]">
                    {feed.streamUrl}
                  </span>
                </span>
                <span className="grid gap-1 text-left text-xs text-slate-400 md:justify-items-end md:text-right">
                  <span>Priority</span>
                  <strong className="text-sm font-semibold text-stone-100">P{feedPriorities[feed.id] ?? index + 1}</strong>
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
