# ATC Watchtower v1 Architecture

## Summary

- Build a static SPA with TypeScript, React 19, and Vite 7.
- v1 ships only priority overlap handling.
- Feed acquisition is local-import only: `.pls`, `.m3u`, and a canonical JSON feed-pack format.
- Deployment target is GitHub Pages.

## Core Flow

1. Import one or more local playlist or feed-pack files.
2. Parse them into a canonical `FeedPackV1` shape.
3. Validate each direct stream URL with a browser CORS fetch.
4. Merge single-airport playlist imports by ICAO so repeated `.pls` imports for the same airport accumulate into one airport pack.
5. Persist imported packs and user settings in IndexedDB.
6. Select an airport and a set of feeds.
7. Reorder feeds with drag-and-drop so `P1` is always the top row.
8. Start a shared `AudioContext`.
9. Attach each feed to both playback and analysis branches.
10. Adjust per-feed squelch in the console when a stream carries steady idle noise.
11. Use adaptive gate detection plus the feed's user-set squelch floor to infer transmission windows.
12. Apply `PriorityStrategy` so only the highest-priority active feed is audible.

## Canonical Interfaces

```ts
type ArbitrationMode = 'priority' | 'blocked' | 'delay';

interface FeedPackV1 {
  version: 1;
  name: string;
  airports: AirportDef[];
}

interface AirportDef {
  icao: string;
  name: string;
  feeds: FeedDef[];
}

interface FeedDef {
  id: string;
  label: string;
  streamUrl: string;
  frequency?: string;
  defaultPriority: number;
}

interface FeedActivityEvent {
  feedId: string;
  at: number;
  type: 'gate-open' | 'gate-close' | 'level';
  rms?: number;
  peak?: number;
}

interface ArbitrationStrategy {
  mode: ArbitrationMode;
  onFeedEvent(event: FeedActivityEvent): void;
  getFloorFeedId(): string | null;
}
```

## Audio Pipeline

- One shared `AudioContext`, created from an explicit user gesture.
- Each selected feed uses:
  - one `HTMLAudioElement` with `crossOrigin="anonymous"`
  - one `MediaElementAudioSourceNode`
  - one `GainNode` for audible playback
  - one analysis-only branch into a filtered `AnalyserNode`
- The analyzer loop:
  - downmixes to mono
  - samples short time-domain windows from the analyser branch
  - tracks RMS and peak values
  - maintains a rolling noise floor while closed
  - applies a per-feed user squelch floor before opening the gate
  - opens after 60 ms above threshold
  - closes after 400 ms below threshold
  - preserves 200 ms of pre-roll for later segment capture features
- Transmission segmentation is silence detection on decoded PCM, not transport metadata.

## Priority Arbitration

- Feed order is the source of truth for priority. The top feed is `P1`, the next is `P2`, and lower numbers win.
- The active floor owner is always the highest-priority currently-open feed.
- Ties break by earlier open time, then feed list order.
- Preemption happens immediately with short gain ramps to avoid clicks.
- Lower-priority feeds stay connected and analyzed, but remain muted while not floor owner.

## Future Mode Seams

- `PriorityStrategy` is the only implemented scheduler in v1.
- Shared types retain `blocked` and `delay` so new strategies can slot in later.
- Gate-open and gate-close events are treated as a stable segmentation contract for future replay and transcription.

## Deployment Notes

- GitHub Pages build output uses the `/atc-watchtower/` base path.
- The app should avoid assumptions that require custom response headers.
