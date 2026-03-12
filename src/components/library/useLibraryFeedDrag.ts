import { useState, type DragEvent } from 'react';

interface DragFeedPayload {
  feedId: string;
  sourceAirportKey: string;
}

interface UseLibraryFeedDragOptions {
  isListening: boolean;
  onMoveFeed: (feedId: string, sourceAirportKey: string, targetAirportKey: string) => void;
  onReorderFeed: (draggedFeedId: string, targetFeedId: string) => void;
  selectedAirportKey: string | null;
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

export function useLibraryFeedDrag({
  isListening,
  onMoveFeed,
  onReorderFeed,
  selectedAirportKey
}: UseLibraryFeedDragOptions) {
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

  const resolvePayload = (event: DragEvent) => dragPayload ?? parseDragPayload(event);

  const handleFeedDragStart = (event: DragEvent, feedId: string) => {
    if (!selectedAirportKey) {
      return;
    }

    const payload: DragFeedPayload = {
      feedId,
      sourceAirportKey: selectedAirportKey
    };

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', feedId);
    event.dataTransfer.setData('application/x-atc-feed', JSON.stringify(payload));
    setDragPayload(payload);
    setDraggedFeedId(feedId);
  };

  const handleFeedDragOver = (event: DragEvent, feedId: string) => {
    if (isListening) {
      return;
    }

    const payload = resolvePayload(event);
    if (!payload || payload.feedId === feedId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverAirportKey(null);
    setDragOverFeedId(feedId);
  };

  const handleFeedDragLeave = (event: DragEvent, feedId: string) => {
    void event;
    void feedId;
  };

  const handleFeedDrop = (event: DragEvent, feedId: string) => {
    const payload = resolvePayload(event);
    clearDragState();

    if (!payload || isListening) {
      return;
    }

    event.preventDefault();

    if (payload.sourceAirportKey === selectedAirportKey) {
      onReorderFeed(payload.feedId, feedId);
      return;
    }

    if (selectedAirportKey) {
      onMoveFeed(payload.feedId, payload.sourceAirportKey, selectedAirportKey);
    }
  };

  const handleAirportDragOver = (event: DragEvent, airportKey: string) => {
    if (isListening) {
      return;
    }

    const payload = resolvePayload(event);
    if (!payload || payload.sourceAirportKey === airportKey) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverFeedId(null);
    setDragOverAirportKey(airportKey);
  };

  const handleAirportDragLeave = (event: DragEvent, airportKey: string) => {
    void event;
    void airportKey;
  };

  const handleAirportDrop = (event: DragEvent, airportKey: string) => {
    const payload = resolvePayload(event);
    clearDragState();

    if (!payload || payload.sourceAirportKey === airportKey || isListening) {
      return;
    }

    event.preventDefault();
    onMoveFeed(payload.feedId, payload.sourceAirportKey, airportKey);
  };

  return {
    dragOverAirportKey,
    dragOverFeedId,
    draggedFeedId,
    handleAirportDragLeave,
    handleAirportDragOver,
    handleAirportDrop,
    handleFeedDragEnd: clearDragState,
    handleFeedDragLeave,
    handleFeedDragOver,
    handleFeedDragStart,
    handleFeedDrop
  };
}
