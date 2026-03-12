# ATC Watchtower

> [!WARNING]
> This codebase is fully AI generated. Treat the implementation, tests, and architectural decisions as drafts that require human review before you rely on them in production.

ATC Watchtower is a static React application for monitoring multiple ATC audio feeds from one browser UI. It imports local playlist files, validates browser-readable stream URLs, stores the resulting feed packs in IndexedDB, and uses priority-based arbitration so only the highest-priority active transmission stays audible.

**Demo:** [https://peterder72.github.io/atc-watchtower/](https://peterder72.github.io/atc-watchtower/)

## What It Does

- Imports local `.pls`, `.m3u`, `.m3u8`, and FeedPack v1 JSON files.
- Infers airport groupings from feed labels and merges repeated single-airport imports by ICAO.
- Validates direct stream URLs with a browser `fetch` before saving them.
- Persists feed packs, selected feeds, and feed ordering in IndexedDB.
- Runs a Web Audio pipeline that detects transmission activity and assigns the audio floor to the highest-priority active feed.

## Constraints

- This is a static frontend-only app. There is no backend.
- Audio only starts after an explicit user action through the console.
- Streams must be directly browser-readable and CORS-compatible.
- v1 only implements `priority` arbitration. Shared types still mention `blocked` and `delay`, but those modes do not exist yet.

## Stack

- React 19
- TypeScript 5
- Vite 7
- Vitest + Testing Library
- IndexedDB via `idb`
- Web Audio API

## Getting Started

```bash
npm install
npm run dev
```

Open the local Vite URL, import one or more playlist files, choose an airport, select feeds, drag feeds into the desired order, and start listening from the Console view.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
npm run test:run
npm run typecheck
```

## Supported Import Formats

### Playlist files

- `.pls`: parsed from `FileN` and `TitleN` entries
- `.m3u` / `.m3u8`: parsed from `#EXTINF` metadata plus direct URLs

### FeedPack v1 JSON

```json
{
  "version": 1,
  "name": "Example Pack",
  "airports": [
    {
      "icao": "EHAM",
      "name": "Amsterdam Schiphol",
      "feeds": [
        {
          "id": "tower",
          "label": "EHAM Tower",
          "streamUrl": "https://example.com/tower",
          "frequency": "119.220",
          "defaultPriority": 3
        }
      ]
    }
  ]
}
```

## Architecture Overview

- `src/App.tsx` coordinates import, persistence, airport/feed selection, and audio engine lifecycle.
- `src/lib/feedPacks.ts` parses playlists, creates stored feed packs, deduplicates repeated imports, and filters invalid feeds.
- `src/lib/streams.ts` validates stream URLs with a browser-side CORS request and first-byte check.
- `src/lib/storage.ts` persists the full app state in IndexedDB.
- `src/audio/priorityAudioEngine.ts` creates the shared `AudioContext`, media graph, analyzers, and live engine snapshot.
- `src/audio/gateDetector.ts` performs adaptive silence gating from PCM frames.
- `src/audio/priorityStrategy.ts` decides which active feed owns the floor.

More detail lives in [`docs/architecture.md`](docs/architecture.md).

## Deployment

- Production builds use the Vite base path `/atc-watchtower/`.
- GitHub Actions builds and deploys the app to GitHub Pages from `main`.

## Current Test Coverage

The existing automated tests cover:

- playlist parsing and import consolidation
- stream validation behavior
- gate detector open/close timing
- priority arbitration ordering

They do not fully validate end-to-end browser audio behavior, so manual testing is still required for real stream playback.
