# Meeting Notes — Technical Plan

## 1. Overview

A native desktop app for taking markdown notes on recurring meetings. Notes
are organized by **meeting type** (e.g. "Weekly Sync", "1:1 with Manager",
"Sprint Planning"). The app syncs with **Google Calendar** to know when
meetings are scheduled, and automatically creates a notes page when the app
is opened near/during a scheduled meeting. Users can also manually create a
note for a specific meeting type, or a **misc note** not tied to any
schedule.

This plan covers **functionality first**. Visual design/styling is
explicitly deferred — Tailwind will be used with default/utility classes
only, no theming or polish pass in v1.

## 2. Goals / Non-Goals

**In scope (v1):**
- Native desktop app (Windows/macOS/Linux) via Tauri
- Markdown notes stored as plain `.md` files on disk, organized by meeting
  type folder
- Google Calendar sync (read-only) to detect meeting times
- Auto-create a note when the app is open near/during a scheduled meeting
- Manually create a note for an existing meeting type
- Create "misc" notes with no calendar linkage
- Basic markdown editor with live preview
- Basic full-text search across notes

**Out of scope (v1, future work):**
- Visual design/theming pass (dark mode, polish, animations)
- Other calendar providers (Outlook, iCal subscriptions, etc.)
- Multi-device sync / cloud storage of notes themselves
- Tagging, attachments, linked notes/backlinks
- Packaging/installers, auto-update, code signing
- Meeting reminders/notifications beyond the auto-create behavior

## 3. Tech Stack Summary

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Tauri v2** (Rust) | Small footprint, system webview, strong FS/OS integration, good React support |
| UI framework | **React 18 + TypeScript** | Ecosystem, editor component availability |
| Styling | **Tailwind CSS** | Utility-first, per requirements |
| Build tool | **Vite** | Fast dev server, first-class Tauri support |
| Editor | **CodeMirror 6** | Lightweight, good markdown mode, embeddable |
| Preview | **react-markdown + remark-gfm** | Render markdown to HTML for preview pane |
| State mgmt | **Zustand** | Minimal boilerplate for small app |
| Backend logic | **Rust (Tauri commands + background task)** | FS access, calendar polling, OAuth token handling |
| Calendar API | **Google Calendar API v3** (REST via `reqwest`) | Per user's requirement |
| OAuth | **`oauth2` crate**, loopback redirect flow | Standard desktop app OAuth (RFC 8252) |
| Secure token storage | **`keyring` crate** (OS keychain) | Avoid storing refresh tokens in plaintext |
| Notes storage | **Markdown files w/ YAML frontmatter** on disk | User-requested; git-friendly, portable, editable externally |
| Config storage | **JSON file in app config dir** (`tauri-plugin-store` or manual) | Meeting type definitions, settings |

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Tauri Desktop App                    │
│                                                           │
│  ┌───────────────────────┐      ┌────────────────────┐  │
│  │   Frontend (WebView)  │◄────►│   Rust Backend      │  │
│  │  React + TS + Tailwind│ IPC  │   (Tauri commands)  │  │
│  │                       │      │                     │  │
│  │  - Sidebar (types)    │      │  - fsstore.rs       │  │
│  │  - Note list          │      │  - config.rs        │  │
│  │  - Editor/Preview     │      │  - calendar/*.rs     │  │
│  │  - Settings/OAuth UI  │      │  - scheduler.rs      │  │
│  │  - New Note modals    │      │  - search.rs         │  │
│  └───────────────────────┘      └─────────┬───────────┘  │
│                                            │              │
└────────────────────────────────────────────┼──────────────┘
                                             │
                          ┌──────────────────┼───────────────────┐
                          │                  │                   │
                    Local Filesystem   OS Keychain          Google Calendar
                  (notes/*.md, config)  (refresh token)         API v3
```

Background scheduler runs inside the Rust process as a `tokio` interval
task. It polls Google Calendar periodically, checks the auto-create window
logic, writes new note files directly to disk, and emits a Tauri event
(`meeting-note-created`) so the frontend can refresh its note list / open
the new note.

## 5. Data & Storage Design

### 5.1 Notes root directory

Chosen on first run via native folder picker (`tauri-plugin-dialog`),
default suggestion: `~/Documents/MeetingNotes`.

```
MeetingNotes/
├── weekly-sync/
│   ├── 2026-07-06-weekly-sync.md
│   └── 2026-07-13-weekly-sync.md
├── 1-1-with-manager/
│   └── 2026-07-09-1-1-with-manager.md
├── sprint-planning/
│   └── 2026-07-08-sprint-planning.md
└── _misc/
    └── 2026-07-09-random-idea.md
```

- One folder per meeting type, slugified name.
- Filename: `<YYYY-MM-DD>-<slug-title>.md` (collisions get a numeric
  suffix).
- Misc notes live in `_misc/`.

### 5.2 Note file format (YAML frontmatter + markdown body)

```markdown
---
id: 6f1a2e3b-... (uuid)
title: "Weekly Sync"
meetingTypeId: weekly-sync
calendarEventId: "abc123_20260709T140000Z"   # null for manual/misc notes
start: 2026-07-09T14:00:00-04:00              # null for misc notes
end: 2026-07-09T14:30:00-04:00
createdAt: 2026-07-09T13:52:11-04:00
source: auto | manual | misc
---

## Agenda
-

## Notes

## Action Items
-
```

Frontmatter is parsed/serialized on the Rust side (`gray_matter` +
`serde_yaml`) so the frontend always receives structured JSON (`metadata`)
+ `body` separately, and sends the same shape back on save.

### 5.3 Config file

`<app-config-dir>/config.json`:

```json
{
  "notesRoot": "/home/user/Documents/MeetingNotes",
  "meetingTypes": [
    {
      "id": "weekly-sync",
      "name": "Weekly Sync",
      "recurringEventId": "abc123",
      "autoCreateMinutesBefore": 10,
      "autoCreateMinutesAfter": 0
    }
  ],
  "calendar": {
    "connected": true,
    "calendarId": "primary",
    "lastSyncedAt": "2026-07-09T13:50:00-04:00"
  },
  "sync": {
    "pollIntervalSeconds": 300,
    "lookaheadHours": 24,
    "backfillHours": 2
  }
}
```

Refresh token is **not** stored here — it goes in the OS keychain via
`keyring` (service: `meeting-notes`, account: the Google account email).

## 6. Google Calendar Integration

### 6.1 OAuth flow (desktop / loopback, RFC 8252)

1. User clicks "Connect Google Calendar" in Settings.
2. Rust backend starts a short-lived local HTTP listener on an ephemeral
   port (`tiny_http` or `axum` minimal router).
3. Backend opens system browser via `tauri-plugin-shell`/`opener` to
   Google's OAuth consent URL with `redirect_uri=http://127.0.0.1:<port>/callback`
   and scope `https://www.googleapis.com/auth/calendar.readonly`.
4. User approves in browser; Google redirects to the loopback server with
   an auth code.
5. Backend exchanges code for access + refresh tokens (`oauth2` crate).
6. Refresh token stored in OS keychain; access token kept in memory,
   refreshed as needed.
7. Local HTTP listener shuts down.

### 6.2 Fetching events

- Use `GET /calendars/primary/events` with `singleEvents=true` (expands
  recurring events into concrete instances), `timeMin`/`timeMax` bounded by
  `lookaheadHours` (and `backfillHours` behind "now").
- Each event instance has a stable Google `id` — used as `calendarEventId`
  for dedup.
- Recurring series share a `recurringEventId` — this is what a
  **meeting type** links to.

### 6.3 Sync cadence

- On app launch: immediate sync.
- Background `tokio` interval task: every `pollIntervalSeconds` (default
  300s).
- On window focus regain: trigger an extra sync (covers laptop
  sleep/wake).

## 7. Meeting Type ↔ Calendar Linking

- Meeting types can be created **with or without** a calendar link.
- "Link to calendar" flow: show the user their upcoming events (from the
  cached sync); user picks one instance of a recurring event; the app
  stores that event's `recurringEventId` on the meeting type.
- Any future event instance sharing that `recurringEventId` is
  automatically associated with the meeting type — no per-instance
  linking needed.
- If a calendar event doesn't match any meeting type's
  `recurringEventId`, it's simply ignored by auto-create (user can still
  make a manual/misc note for it).

## 8. Auto-Create Note Logic

Runs after every sync (launch, poll interval, focus regain):

1. For each upcoming/recent event in the synced window:
   - Skip if its `recurringEventId` doesn't match any meeting type.
   - Compute window: `[event.start - autoCreateMinutesBefore, event.end + autoCreateMinutesAfter]`.
   - Skip if `now` is not inside that window AND not within
     `backfillHours` after the window closed (this is the "missed
     meeting" backfill case — covers app being closed during the
     meeting).
   - Check for an existing note with matching `calendarEventId` (scan
     frontmatter index, see §11). Skip if one already exists (dedup).
   - Otherwise: create the note file (frontmatter pre-filled,
     `source: auto`), and emit `meeting-note-created` Tauri event with
     the note's path/metadata.
2. Frontend listens for `meeting-note-created` and:
   - Refreshes the relevant meeting type's note list.
   - If the event is currently in-progress, prompts/opens the new note
     automatically; if it's a backfilled note for a past meeting,
     just adds it to the list without stealing focus.

## 9. Manual Note Creation Flows

- **New meeting note**: user picks an existing meeting type (or creates a
  new one inline) → optionally link to a specific upcoming calendar event
  from that type's series → note created with `source: manual`.
- **New misc note**: single action, no meeting type, no calendar link,
  saved under `_misc/`, `source: misc`.
- **New meeting type**: name + optional calendar link (see §7) +
  optional per-type auto-create window override.

## 10. Editor & Preview

- CodeMirror 6 instance with `@codemirror/lang-markdown` for the editor
  pane.
- A small metadata bar above the editor showing title / meeting type /
  date-time (editable for manual/misc notes; read-only-ish for
  calendar-linked fields).
- Preview pane (toggle or split view) renders body via `react-markdown` +
  `remark-gfm`.
- Autosave: debounce ~750ms after last keystroke → write frontmatter +
  body back to disk via `write_note` command. No explicit save button
  needed, though one can exist for clarity.

## 11. Search

- v1: simple full-text filter. Rust command `search_notes(query)` walks
  the notes root (`walkdir`), reads each file, checks title/body for a
  case-insensitive substring match, returns matching note metadata list.
- No database/index needed at this scale; can be revisited if note
  volume becomes large enough to warrant an SQLite index — deferred.

## 12. Tauri Commands (IPC surface)

| Command | Description |
|---|---|
| `get_settings` / `save_settings` | Read/write config.json |
| `list_meeting_types` | Return all meeting types |
| `create_meeting_type` / `update_meeting_type` / `delete_meeting_type` | CRUD |
| `list_notes(meetingTypeId?)` | List notes, optionally filtered |
| `read_note(path)` | Parse frontmatter + body |
| `create_note(input)` | Create manual/misc note |
| `write_note(path, metadata, body)` | Save edits (autosave) |
| `delete_note(path)` | Remove a note file |
| `search_notes(query)` | Full-text search |
| `start_google_auth` | Kick off OAuth loopback flow |
| `disconnect_google_calendar` | Revoke/clear stored token |
| `get_upcoming_events` | Return cached synced events (for linking UI) |
| `force_sync` | Manually trigger a calendar sync + auto-create pass |

Events emitted backend → frontend:

| Event | Payload |
|---|---|
| `meeting-note-created` | note metadata + path |
| `calendar-sync-status` | `{ status: 'syncing' \| 'ok' \| 'error', message? }` |

## 13. Frontend Structure

```
src/
├── main.tsx
├── App.tsx
├── state/
│   ├── notesStore.ts
│   ├── meetingTypesStore.ts
│   ├── calendarStore.ts
│   └── settingsStore.ts
├── lib/
│   └── tauri.ts          # typed wrappers around invoke() per command
├── components/
│   ├── Sidebar.tsx
│   ├── NoteList.tsx
│   ├── NoteEditor.tsx     # CodeMirror wrapper
│   ├── NotePreview.tsx
│   ├── MetadataBar.tsx
│   ├── NewNoteModal.tsx
│   ├── NewMeetingTypeModal.tsx
│   └── SettingsPanel.tsx
└── views/
    ├── MainView.tsx
    └── SettingsView.tsx
```

Simple view switching (Settings vs Main) is enough — React Router is
optional and can be skipped for v1.

## 14. Rust Backend Structure

```
src-tauri/
├── src/
│   ├── main.rs
│   ├── commands.rs
│   ├── config.rs             # load/save config.json
│   ├── fsstore.rs            # notes CRUD, frontmatter parse/serialize
│   ├── search.rs
│   ├── scheduler.rs          # tokio interval task, auto-create logic
│   └── calendar/
│       ├── mod.rs
│       ├── auth.rs           # OAuth loopback flow, keyring storage
│       └── google.rs         # REST client for Calendar API
└── Cargo.toml
```

## 15. Dependencies

### 15.1 `Cargo.toml` (src-tauri)

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-fs = "2"
tauri-plugin-store = "2"
tauri-plugin-dialog = "2"
tauri-plugin-notification = "2"
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"
gray_matter = "0.2"
reqwest = { version = "0.12", features = ["json"] }
oauth2 = "4"
keyring = "3"
tokio = { version = "1", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }
chrono-tz = "0.9"
walkdir = "2"
uuid = { version = "1", features = ["v4", "serde"] }
tiny_http = "0.12"
```

### 15.2 `package.json` (frontend)

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "zustand": "^4",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-fs": "^2",
    "@tauri-apps/plugin-store": "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-shell": "^2",
    "@tauri-apps/plugin-notification": "^2",
    "@tauri-apps/plugin-opener": "^2",
    "@codemirror/state": "^6",
    "@codemirror/view": "^6",
    "@codemirror/lang-markdown": "^6",
    "@codemirror/commands": "^6",
    "react-markdown": "^9",
    "remark-gfm": "^4",
    "date-fns": "^3",
    "clsx": "^2",
    "zod": "^3"
  },
  "devDependencies": {
    "typescript": "^5",
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "@tauri-apps/cli": "^2",
    "tailwindcss": "^3",
    "postcss": "^8",
    "autoprefixer": "^10",
    "vitest": "^2",
    "@testing-library/react": "^16"
  }
}
```

## 16. Project Setup Steps

```bash
npm create tauri-app@latest meeting-notes -- --template react-ts
cd meeting-notes
npm install
npx tailwindcss init -p
# configure tailwind.config.js content globs, add directives to index.css
cargo add serde_yaml gray_matter reqwest oauth2 keyring tokio chrono chrono-tz walkdir uuid tiny_http --manifest-path src-tauri/Cargo.toml
npm install zustand react-markdown remark-gfm date-fns clsx zod
npm install @codemirror/state @codemirror/view @codemirror/lang-markdown @codemirror/commands
npm install @tauri-apps/plugin-fs @tauri-apps/plugin-store @tauri-apps/plugin-dialog @tauri-apps/plugin-shell @tauri-apps/plugin-notification @tauri-apps/plugin-opener
```

Also requires: registering a Google Cloud project, enabling the Calendar
API, and creating an OAuth Client ID of type **Desktop app** (client
id/secret go into a non-committed `src-tauri/.env` or config, loaded at
build/runtime — do not hardcode/commit).

## 17. Development Phases

| Phase | Deliverable |
|---|---|
| 0 | Scaffold Tauri + React + TS + Tailwind project, empty window renders |
| 1 | Local notes CRUD: manual meeting types, create/list/edit/save notes on disk (no calendar yet), misc notes |
| 2 | Editor experience: CodeMirror integration, metadata bar, preview pane, autosave |
| 3 | Google OAuth flow + calendar event fetch, Settings UI to connect account and link meeting types to recurring events |
| 4 | Scheduler: background polling, auto-create window logic, dedup, missed-meeting backfill, `meeting-note-created` event wiring |
| 5 | Full-text search, error/retry handling for sync failures, offline behavior (app fully usable without calendar connected) |
| 6 (later, not this pass) | Styling/theming pass, packaging & installers, auto-update |

## 18. Testing Strategy

- **Rust unit tests**: frontmatter parse/serialize round-trip, auto-create
  window math (before/during/after/backfill edge cases), event→meeting
  type matching, filename slug/collision handling.
- **Frontend**: vitest + React Testing Library for editor/metadata bar
  and store logic; mock `@tauri-apps/api` invoke calls.
- **Manual QA checklist**: connect/disconnect calendar, create meeting
  type linked to a real recurring event, verify auto-create fires within
  the window, verify no duplicate note on repeated syncs, verify backfill
  after simulating app being closed during a meeting, verify misc/manual
  flows work fully offline.

## 19. Security & Privacy Notes

- Calendar scope kept to `calendar.readonly` — app never writes to the
  user's calendar.
- Refresh token stored only in OS keychain (`keyring` crate), never in
  the plaintext config file.
- All notes stay local on disk; no note content is ever sent anywhere.
- OAuth client secret (desktop-type) treated as non-sensitive per Google
  guidance, but still not committed to version control — loaded from a
  local `.env`/config ignored by git.

## 20. Future Enhancements (explicitly deferred)

- Visual design pass: theming, dark mode, spacing/typography polish,
  icons.
- Additional calendar providers (Outlook/Microsoft Graph, generic
  `.ics` subscription).
- Tags, note linking/backlinks, attachments (images/files).
- Packaging: signed installers for macOS/Windows, auto-update channel.
- SQLite-backed index if note volume grows large enough that
  directory-walk search becomes slow.
- Multi-calendar support (beyond `primary`).
