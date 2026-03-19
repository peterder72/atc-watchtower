import type { DragEvent } from 'react';
import type { AirportEntry } from '../../domain/models';
import { cn } from '../../lib/cn';
import { formatAirportLabel } from '../../lib/feedPacks';
import { EmptyState, SectionHeading } from '../ui/common';
import { fieldLabelClass, subPanelClass } from '../ui/styles';

interface AirportListPanelProps {
  airports: AirportEntry[];
  dragOverAirportKey: string | null;
  isListening: boolean;
  onAirportChange: (airportKey: string) => void;
  onAirportDragLeave: (event: DragEvent, airportKey: string) => void;
  onAirportDragOver: (event: DragEvent, airportKey: string) => void;
  onAirportDrop: (event: DragEvent, airportKey: string) => void;
  selectedAirportKey: string | null;
}

export function AirportListPanel({
  airports,
  dragOverAirportKey,
  isListening,
  onAirportChange,
  onAirportDragLeave,
  onAirportDragOver,
  onAirportDrop,
  selectedAirportKey
}: AirportListPanelProps) {
  return (
    <article className={cn(subPanelClass, 'space-y-4')}>
      <SectionHeading
        eyebrow="Airports"
        level="h3"
        title="Airport Manifest"
        description="Select the airport or pack you want to stage for monitoring."
      />

      {airports.length === 0 ? (
        <EmptyState>Import a `.pls`, `.m3u`, or feed-pack JSON file to populate the airport list.</EmptyState>
      ) : (
        <ul className="grid gap-2">
          {airports.map((entry) => (
            <li
              key={entry.key}
              data-drop-active={dragOverAirportKey === entry.key ? 'true' : 'false'}
              className={cn(
                'rounded-[6px] transition',
                entry.key === selectedAirportKey && 'shadow-[0_0_0_1px_var(--wt-tone-accent-outline)]',
                dragOverAirportKey === entry.key && 'shadow-[0_0_0_1px_var(--wt-tone-success-outline)]'
              )}
              onDragLeave={(event) => onAirportDragLeave(event, entry.key)}
              onDragOver={(event) => onAirportDragOver(event, entry.key)}
              onDrop={(event) => onAirportDrop(event, entry.key)}
            >
              <button
                aria-pressed={entry.key === selectedAirportKey}
                className={cn(
                  'grid w-full gap-3 rounded-[6px] border px-3 py-3 text-left transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center',
                  entry.key === selectedAirportKey
                    ? 'border-[var(--wt-accent-strong)] bg-[var(--wt-tone-accent-bg-soft)]'
                    : 'border-[var(--wt-border)] bg-[var(--wt-screen)] hover:border-[var(--wt-border-strong)] hover:text-[var(--wt-text)]',
                  dragOverAirportKey === entry.key &&
                    'border-[var(--wt-ok)] bg-[var(--wt-tone-success-bg-soft)]',
                  isListening && 'cursor-not-allowed opacity-60'
                )}
                disabled={isListening}
                type="button"
                onClick={() => onAirportChange(entry.key)}
              >
                <span className="grid min-w-0 gap-1">
                  <span className={fieldLabelClass}>{entry.airport.icao}</span>
                  <strong className="truncate text-[0.95rem] font-semibold uppercase tracking-[0.03em] text-[var(--wt-text)]">
                    {formatAirportLabel(entry.airport, entry.packName)}
                  </strong>
                  <span className="text-[0.78rem] text-[var(--wt-muted)]">{entry.airport.feeds.length} feeds loaded</span>
                </span>
                <span className="whitespace-nowrap text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--wt-muted)]">
                  {dragOverAirportKey === entry.key ? 'Release to move' : 'Drop target'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
