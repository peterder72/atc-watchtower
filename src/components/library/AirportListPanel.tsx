import type { DragEvent } from 'react';
import type { AirportEntry } from '../../domain/models';
import { cn } from '../../lib/cn';
import { formatAirportLabel } from '../../lib/feedPacks';
import { EmptyState, SectionHeading } from '../ui/common';
import { subPanelClass } from '../ui/styles';

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
        title="Imported packs"
        description="Choose the airport you want to manage or monitor."
      />

      {airports.length === 0 ? (
        <EmptyState>Import a `.pls`, `.m3u`, or feed-pack JSON file to populate the airport list.</EmptyState>
      ) : (
        <ul className="grid gap-2">
          {airports.map((entry) => (
            <li
              key={entry.key}
              className={cn(
                'rounded-[18px] transition',
                entry.key === selectedAirportKey && 'ring-1 ring-teal/35',
                dragOverAirportKey === entry.key && 'ring-1 ring-accent/40'
              )}
              onDragLeave={(event) => onAirportDragLeave(event, entry.key)}
              onDragOver={(event) => onAirportDragOver(event, entry.key)}
              onDrop={(event) => onAirportDrop(event, entry.key)}
            >
              <button
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition',
                  entry.key === selectedAirportKey
                    ? 'border-teal/35 bg-teal/10'
                    : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]',
                  dragOverAirportKey === entry.key &&
                    'border-[rgba(255,138,76,0.45)] bg-[rgba(255,138,76,0.14)] ring-1 ring-inset ring-[rgba(255,138,76,0.18)]',
                  isListening && 'cursor-not-allowed opacity-60'
                )}
                disabled={isListening}
                type="button"
                onClick={() => onAirportChange(entry.key)}
              >
                <span className="grid gap-1">
                  <strong className="text-sm font-semibold text-stone-100">
                    {formatAirportLabel(entry.airport, entry.packName)}
                  </strong>
                  <span className="text-xs text-slate-400">{entry.airport.feeds.length} feeds</span>
                </span>
                <span className="whitespace-nowrap text-xs text-slate-400">Drop feed here</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
