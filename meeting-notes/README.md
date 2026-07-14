# Meeting Notes

A native desktop app (Tauri + React + TypeScript) for taking markdown notes on
recurring meetings, organized by meeting type.

See [`../PLAN.md`](../PLAN.md) for the full technical plan.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind (utility classes only,
  no theming pass in v1), Zustand for state, CodeMirror 6 editor,
  `react-markdown` preview.
- **Backend**: Rust / Tauri v2 commands.
- **`src-tauri/core`** (`notes-core`): a dependency-light, fully unit-tested
  crate holding the pure business logic (frontmatter parse/serialize, slug &
  filename collision handling, search). It has **no** Tauri/OS deps so it tests
  fast.
- **Notes**: plain `.md` files with YAML frontmatter, organized by meeting-type
  folder (misc notes under `_misc/`). Config lives in `config.json` in the app
  config dir. Notes are stored in `~/Documents/notes-app` by default.

## Prerequisites

- Node 18+ and Rust (stable).
- Linux only: Tauri system libraries — `libwebkit2gtk-4.1-dev`,
  `librsvg2-dev`, `libdbus-1-dev`, and `pkg-config`
  (see https://tauri.app/start/prerequisites/).

## Setup

```bash
npm install
```

## Develop / build

```bash
npm run tauri dev      # run the desktop app
npm run build          # typecheck + build frontend
npm run tauri build    # package (Linux needs the system libs above)
```

## Tests

```bash
npm test                                   # frontend (vitest)
cargo test --manifest-path src-tauri/core/Cargo.toml   # core logic
```
