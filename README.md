# rom-curator

A personal ROM library curator built around 1G1R DAT files.

## What it does

- **Load DAT files** from Redump and No-Intro collections (manual upload, or auto-fetch from [Fresh1G1R](https://github.com/UnluckyForSome/Fresh1G1R)).
- **Browse and filter** games per system.
- **Scan a local directory** for ROMs you already own, match them against the DAT by CRC32, and rename to the canonical 1G1R filenames.
- **Pick the games you want** and download them individually from archive.org sources.
- **Validate** every downloaded file against the DAT's CRC32 / SHA1 before keeping it.

## Stack

- **Frontend:** Vite + React + TypeScript + Panda CSS
- **Backend:** Hono + Node 20+ + TypeScript
- **Monorepo:** pnpm workspaces

## Status

Bootstrap phase. See [ROADMAP.md](./ROADMAP.md) for the implementation plan.

## Working with Claude Code

The repo is set up for Claude Code. Start by reading [CLAUDE.md](./CLAUDE.md).
