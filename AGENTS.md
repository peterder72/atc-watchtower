# AGENTS.md

This repository is a static ATC audio monitoring SPA built with React, TypeScript, and Vite. It is also fully AI generated, so verify assumptions instead of trusting the code or tests at face value.

## First Read

Before changing behavior, inspect these files:

- `docs/architecture.md`
- `src/App.tsx`
- `src/lib/feedPacks.ts`
- `src/lib/streams.ts`
- `src/audio/priorityAudioEngine.ts`
- `src/audio/gateDetector.ts`
- `src/audio/priorityStrategy.ts`

## Project Rules

- Preserve the static-first design. Do not introduce backend or server-side dependencies unless the task explicitly requires them.
- Keep production routing compatible with the GitHub Pages base path `/atc-watchtower/`.
- Audio startup must remain behind an explicit user action. Do not auto-start `AudioContext` or playback during render or hydration.
- Imported feeds are persisted in IndexedDB. If you change `AppState` or stored pack shapes, handle migration deliberately.
- Stream validation is browser-side and CORS-dependent. Do not replace it with Node-only checks unless the product direction changes.
- The only implemented arbitration mode is priority mode. Shared types mention future modes, but the UI and engine currently assume priority scheduling.

## Core Flow

1. Users import local `.pls`, `.m3u`, `.m3u8`, or FeedPack JSON files.
2. `feedPacks.ts` parses them into `FeedPackV1`.
3. `streams.ts` validates direct audio URLs and drops incompatible feeds.
4. `storage.ts` persists the normalized app state in IndexedDB.
5. `priorityAudioEngine.ts` creates one shared audio graph per selected feed.
6. `gateDetector.ts` emits gate-open, gate-close, and level events from PCM samples.
7. `priorityStrategy.ts` chooses the current floor owner by priority, then open time, then selection order.

## Editing Guidance

- Favor small, local changes. This codebase is compact and tightly coupled around `App.tsx`.
- If you touch import parsing, consolidation, or validation, update the corresponding tests in `src/lib/*.test.ts`.
- If you touch arbitration or gating, update the tests in `src/audio/*.test.ts`.
- If you change visible behavior in the library or console, read both component files before editing to avoid breaking view-specific assumptions.
- Keep the UI frontend-only. Avoid features that require secrets, custom headers, or server transforms unless requested.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## Verification Expectations

- Run targeted tests for the modules you changed.
- Run `npm run test:run` after meaningful logic changes.
- Run `npm run build` if you changed app wiring, Vite config, or anything deployment-related.

## Known Sharp Edges

- Real stream playback depends on browser codec support, CORS headers, and readable response bytes.
- The app stores state per browser profile in IndexedDB, so reproduction can be affected by previously imported packs.
- Single-airport imports are intentionally merged by ICAO and deduplicated by canonicalized stream URL. Do not change that casually because it affects persisted selections and priorities.
