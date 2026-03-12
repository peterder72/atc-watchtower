import { useState, type DragEvent } from 'react';
import type { AirportEntry, FeedDef, ImportNotice } from '../domain/models';
import { formatAirportLabel } from '../lib/feedPacks';

interface DragFeedPayload {
  feedId: string;
  sourceAirportKey: string;
}

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

function parseDragPayload(event: DragEvent): DragFeedPayload | null {
  const rawPayload = event.dataTransfer.getData('application/x-atc-feed');
  if (!rawPayload) {
    return null;
  }

  try {
    const payload = JSON.parse(rawPayload) as DragFeedPayload;
    if (typeof payload.feedId !== 'string' || typeof payload.sourceAirportKey !== 'string') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
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
  const [dragPayload, setDragPayload] = useState<DragFeedPayload | null>(null);
  const [draggedFeedId, setDraggedFeedId] = useState<string | null>(null);
  const [dragOverAirportKey, setDragOverAirportKey] = useState<string | null>(null);
  const [dragOverFeedId, setDragOverFeedId] = useState<string | null>(null);

  const clearDragState = () => {
    setDragPayload(null);
    setDraggedFeedId(null);
    setDragOverAirportKey(null);
    setDragOverFeedId(null);
  };

  return (
    <section className="panel stack-lg">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Library</p>
          <h2>Import feeds and shape the listening deck.</h2>
        </div>
        <label className={`upload-button ${isBusy || isListening ? 'is-disabled' : ''}`}>
          <input
            disabled={isBusy || isListening}
            multiple
            accept=".pls,.m3u,.m3u8,.json"
            type="file"
            onChange={(event) => {
              onImportFiles(event.target.files);
              event.target.value = '';
            }}
          />
          {isBusy ? 'Importing...' : 'Import playlists'}
        </label>
      </div>

      <div className="library-grid">
        <article className="subpanel stack-md">
          <div>
            <p className="eyebrow">Airports</p>
            <h3>Imported packs</h3>
          </div>
          {airports.length === 0 ? (
            <p className="muted">Import a `.pls`, `.m3u`, or feed-pack JSON file to populate the airport list.</p>
          ) : (
            <ul className="airport-list">
              {airports.map((entry) => (
                <li
                  key={entry.key}
                  className={[
                    entry.key === selectedAirportKey ? 'is-selected' : '',
                    dragOverAirportKey === entry.key ? 'is-drop-target' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onDragOver={(event) => {
                    if (isListening) {
                      return;
                    }

                    const payload = dragPayload ?? parseDragPayload(event);
                    if (!payload || payload.sourceAirportKey === entry.key) {
                      return;
                    }

                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDragOverAirportKey(entry.key);
                  }}
                  onDragLeave={() => {
                    if (dragOverAirportKey === entry.key) {
                      setDragOverAirportKey(null);
                    }
                  }}
                  onDrop={(event) => {
                    const payload = dragPayload ?? parseDragPayload(event);
                    clearDragState();
                    if (!payload || payload.sourceAirportKey === entry.key || isListening) {
                      return;
                    }

                    event.preventDefault();
                    onMoveFeed(payload.feedId, payload.sourceAirportKey, entry.key);
                  }}
                >
                  <button
                    type="button"
                    disabled={isListening}
                    onClick={() => onAirportChange(entry.key)}
                  >
                    <span className="airport-meta">
                      <strong>{formatAirportLabel(entry.airport, entry.packName)}</strong>
                      <span>{entry.airport.feeds.length} feeds</span>
                    </span>
                    <span className="airport-drop-hint">Drop feed here</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="subpanel stack-md">
          <div>
            <p className="eyebrow">Feed Deck</p>
            <h3>Priority queue</h3>
            <p className="muted">Drag to reorder. The top row is P1, then P2, and so on.</p>
          </div>
          {feeds.length === 0 ? (
            <p className="muted">Choose an airport to manage its feed priorities.</p>
          ) : (
            <div className="feed-table">
              {feeds.map((feed, index) => {
                const selected = selectedFeedIds.includes(feed.id);
                return (
                  <label
                    key={feed.id}
                    className={[
                      'feed-row',
                      selected ? 'is-active' : '',
                      draggedFeedId === feed.id ? 'is-dragging' : '',
                      dragOverFeedId === feed.id ? 'is-drag-target' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    draggable={!isListening}
                    onDragStart={(event) => {
                      if (!selectedAirportKey) {
                        return;
                      }

                      const payload: DragFeedPayload = {
                        feedId: feed.id,
                        sourceAirportKey: selectedAirportKey
                      };
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', feed.id);
                      event.dataTransfer.setData('application/x-atc-feed', JSON.stringify(payload));
                      setDragPayload(payload);
                      setDraggedFeedId(feed.id);
                    }}
                    onDragEnd={clearDragState}
                    onDragOver={(event) => {
                      if (isListening) {
                        return;
                      }

                      const payload = dragPayload ?? parseDragPayload(event);
                      if (!payload || payload.feedId === feed.id) {
                        return;
                      }

                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDragOverFeedId(feed.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverFeedId === feed.id) {
                        setDragOverFeedId(null);
                      }
                    }}
                    onDrop={(event) => {
                      const payload = dragPayload ?? parseDragPayload(event);
                      clearDragState();
                      if (!payload || isListening) {
                        return;
                      }

                      event.preventDefault();
                      if (payload.sourceAirportKey === selectedAirportKey) {
                        onReorderFeed(payload.feedId, feed.id);
                        return;
                      }

                      if (selectedAirportKey) {
                        onMoveFeed(payload.feedId, payload.sourceAirportKey, selectedAirportKey);
                      }
                    }}
                  >
                    <span className="feed-checkbox">
                      <input
                        checked={selected}
                        disabled={isListening}
                        type="checkbox"
                        onChange={() => onToggleFeed(feed.id)}
                      />
                    </span>
                    <span className="drag-handle" aria-hidden="true">
                      ::
                    </span>
                    <span className="feed-meta">
                      <strong>{feed.label}</strong>
                      <span>{feed.streamUrl}</span>
                    </span>
                    <span className="feed-priority">
                      <span>Priority</span>
                      <strong>P{feedPriorities[feed.id] ?? index + 1}</strong>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {isListening ? (
            <p className="muted">Stop listening before changing the airport list or dragging feeds into a new order.</p>
          ) : null}
        </article>
      </div>

      {importNotices.length > 0 ? (
        <article className="subpanel stack-sm">
          <div>
            <p className="eyebrow">Import Report</p>
            <h3>Compatibility checks</h3>
          </div>
          <ul className="notice-list">
            {importNotices.map((notice, index) => (
              <li key={`${notice.fileName}-${index}`} className={`notice-${notice.level}`}>
                <strong>{notice.fileName}</strong>
                <span>{notice.message}</span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
