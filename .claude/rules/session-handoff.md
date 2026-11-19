# Session handoff — 2026-11-19

Temporary note, loaded automatically so a session on another workstation picks up where the last one stopped. **Delete this file once the "left to do" list is done or no longer relevant.**

## What was done

The web app was brought in line with `frontend.md`, `readability.md` and `review.md` (commits `d34349f`..`9349446`, plus this note):

- **Rules:** `readability.md` added (no nested ternaries, named conditions, no clever one-liners); `frontend.md` contradictions fixed. eslint enforces `no-nested-ternary` everywhere, `consistent-type-imports` and a 500-line `max-lines` warning on `apps/web`.
- **React Query:** every key comes from `lib/query-keys.ts`; settings through `lib/use-settings.ts`; immutable data (games of a DAT, game details, system icons) has `staleTime` and `gcTime` `Infinity`; `DatUpload` / `Fresh1g1rBrowser` invalidate `dats` themselves.
- **Layers:** `PathInput` and `SystemFolderBar` moved from `components/` to `features/folders/` (they touch the API), logic in `use-dir-listing.ts`.
- **`App.tsx`:** 940 → ~100 lines. Home screen in `features/systems/`, a system's view in `features/game-view/` (`GameView`, `GameHeader`, `SelectionDock`, `tabs.ts`), shared `components/SegmentedControl.tsx`.
- **Downloads:** `DownloadManager.tsx` split into `job-state.ts` (pure SSE event reducer), `use-download-jobs.ts`, `retry.ts`, `job-labels.ts`, `JobCard.tsx`, `DownloadGameRow.tsx`.
- **Bug fixed** (`5c26254`): queueing a second download closed the first job's SSE stream, freezing its progress while the server kept downloading. Regression test in `DownloadManager.test.tsx`.
- `ScanPage` split into `ScanResults` / `RenameRow`; all nested ternaries removed (web + `apps/server/src/services/archive-org/suggest.ts`).
- Tests: web 226 → 281, server 449, all green. Visual check in headless Chromium (Light, Lemon Grid, Night Drive): no regression.

## Done since (2026-11-19, Windows workstation)

- `ResolvePanel` split (`9733603`..`e3c4ecf`): pure helpers, `use-resolve-panel`, presentational views.
- French plural rule everywhere through `lib/plural.ts` (`f88a154`).
- Server: downloader split into `job-store` / `container-cache` / `chd-conversion` / `process-item`, `downloadFile` split, batch rename moved to `services/scanner/rename.ts`, `suggestSources` split (`42c735a`..`ed266cd`).
- eslint now warns on `complexity` > 15 and `max-depth` > 4 (tests excepted); zero warnings (`df9ac26`).
- Priority components tested: GameRow, PathInput, ScanResults, GameHeader, ResolvedGameRow, JobCard, DownloadGameRow (`0050d01`, `ff9e0e2`); remaining fixed plurals fixed (`b2d1f4f`).
- Tests: web 387, server 462, all green. Not checked in a browser.

## Left to do

1. Untested, lower priority: the settings sections, Fresh1g1rBrowser, SystemFolderBar, TopologyStep, SuggestionRow, SearchResultRow, SourceRow (connected), then small views (SystemCard, SelectionDock, Dialog…).
2. `CLAUDE.md` says phase 14 is "not yet merged into master" — stale, it is merged. Camille chose to leave it for later.

## Environment notes

- In `apps/web`, `tsc --noEmit -p .` checks NOTHING (`tsconfig.json` is `files: []` plus references). Typecheck with `tsc -b`. Vitest doesn't typecheck either.

## Environment notes (code-server host)

- `pnpm` is not on PATH there: `npx --yes pnpm@9 <cmd>`. No `python3`.
- After a pull touching dependencies: `pnpm install --frozen-lockfile`, then `npx panda codegen` in `apps/web` (stale codegen shows as bogus TS errors such as `"strip"` not assignable to a Button size).
- Prettier isn't clean repo-wide: format only the files you touch.
- `sudo` is blocked in the container; Playwright's Chromium runs only with its libraries extracted locally (`apt-get download` with user-owned `Dir::State::Lists` / `Dir::Cache`, `dpkg-deb -x`, `LD_LIBRARY_PATH`, and a `FONTCONFIG_FILE` pointing at the extracted fonts — without it no text renders). For screenshots, run the app with `ROM_CURATOR_DATA_DIR` / `ROMS_ROOT` on scratch dirs, never the real `~/.rom-curator`.
