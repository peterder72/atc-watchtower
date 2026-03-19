import type { AirportEntry, FeedDef, ImportNotice } from '../domain/models';
import { AirportListPanel } from './library/AirportListPanel';
import { FeedDeckPanel } from './library/FeedDeckPanel';
import { ImportReport } from './library/ImportReport';
import { useLibraryFeedDrag } from './library/useLibraryFeedDrag';
import { SectionHeading } from './ui/common';
import { buttonClass, panelClass } from './ui/styles';

interface LibraryViewProps {
  airports: AirportEntry[];
  selectedAirportKey: string | null;
  feeds: FeedDef[];
  selectedFeedIds: string[];
  feedPriorities: Record<string, number>;
  importNotices: ImportNotice[];
  isBusy: boolean;
  isListening: boolean;
  onImportFiles: (files: FileList | null) => void;
  onAirportChange: (airportKey: string) => void;
  onToggleFeed: (feedId: string) => void;
  onReorderFeed: (draggedFeedId: string, targetFeedId: string) => void;
  onMoveFeed: (feedId: string, sourceAirportKey: string, targetAirportKey: string) => void;
}

export function LibraryView({
  airports,
  selectedAirportKey,
  feeds,
  selectedFeedIds,
  feedPriorities,
  importNotices,
  isBusy,
  isListening,
  onImportFiles,
  onAirportChange,
  onToggleFeed,
  onReorderFeed,
  onMoveFeed
}: LibraryViewProps) {
  const {
    dragOverAirportKey,
    dragOverFeedId,
    draggedFeedId,
    handleAirportDragLeave,
    handleAirportDragOver,
    handleAirportDrop,
    handleFeedDragEnd,
    handleFeedDragLeave,
    handleFeedDragOver,
    handleFeedDragStart,
    handleFeedDrop
  } = useLibraryFeedDrag({
    isListening,
    onMoveFeed,
    onReorderFeed,
    selectedAirportKey
  });

  return (
    <section className={`${panelClass} space-y-5`}>
      <SectionHeading
        actions={
          <label
            className={buttonClass(
              'primary',
              isBusy || isListening ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'
            )}
          >
            <input
              disabled={isBusy || isListening}
              multiple
              accept=".pls,.m3u,.m3u8,.json"
              className="sr-only"
              type="file"
              onChange={(event) => {
                onImportFiles(event.target.files);
                event.target.value = '';
              }}
            />
            {isBusy ? 'Importing...' : 'Import playlists'}
          </label>
        }
        eyebrow="Library"
        title="Feed Setup"
        description="Import local playlists, choose an airport, and arrange priority order before opening the console."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(290px,360px)_minmax(0,1fr)]">
        <AirportListPanel
          airports={airports}
          dragOverAirportKey={dragOverAirportKey}
          isListening={isListening}
          onAirportChange={onAirportChange}
          onAirportDragLeave={handleAirportDragLeave}
          onAirportDragOver={handleAirportDragOver}
          onAirportDrop={handleAirportDrop}
          selectedAirportKey={selectedAirportKey}
        />

        <FeedDeckPanel
          draggedFeedId={draggedFeedId}
          dragOverFeedId={dragOverFeedId}
          feedPriorities={feedPriorities}
          feeds={feeds}
          isListening={isListening}
          onFeedDragEnd={handleFeedDragEnd}
          onFeedDragLeave={handleFeedDragLeave}
          onFeedDragOver={handleFeedDragOver}
          onFeedDragStart={handleFeedDragStart}
          onFeedDrop={handleFeedDrop}
          onToggleFeed={onToggleFeed}
          selectedFeedIds={selectedFeedIds}
        />
      </div>

      {importNotices.length > 0 ? <ImportReport notices={importNotices} /> : null}
    </section>
  );
}
