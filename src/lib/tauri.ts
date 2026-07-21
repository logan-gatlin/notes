import { invoke } from "@tauri-apps/api/core";
import type {
  AiAuthStatus,
  AiConfig,
  AiEditResponse,
  CreateNoteInput,
  MeetingType,
  MeetingTypeInput,
  NoteEntry,
  NoteMetadata,
} from "./types";

/**
 * Typed wrappers around the Rust IPC surface (see src-tauri/src/commands.rs).
 * Keeping these here means components never call `invoke` with raw strings.
 */

// Meeting types -------------------------------------------------------------
export const listMeetingTypes = () =>
  invoke<MeetingType[]>("list_meeting_types");

export const createMeetingType = (input: MeetingTypeInput) =>
  invoke<MeetingType>("create_meeting_type", { input });

export const updateMeetingType = (meetingType: MeetingType) =>
  invoke<MeetingType>("update_meeting_type", { meetingType });

export const deleteMeetingType = (id: string) =>
  invoke<void>("delete_meeting_type", { id });

// Notes ---------------------------------------------------------------------
export const listNotes = (meetingTypeId?: string | null) =>
  invoke<NoteEntry[]>("list_notes", { meetingTypeId: meetingTypeId ?? null });

export const readNote = (path: string) =>
  invoke<NoteEntry>("read_note", { path });

export const createNote = (input: CreateNoteInput) =>
  invoke<NoteEntry>("create_note", { input });

export const writeNote = (
  path: string,
  metadata: NoteMetadata,
  body: string,
) => invoke<void>("write_note", { path, metadata, body });

/** Move a note into/out of the archive folder. Returns the note at its new path. */
export const setArchived = (path: string, archived: boolean) =>
  invoke<NoteEntry>("set_archived", { path, archived });

export const deleteNote = (path: string) =>
  invoke<void>("delete_note", { path });

export const searchNotes = (query: string) =>
  invoke<NoteEntry[]>("search_notes", { query });

// Syntax highlighting -------------------------------------------------------
export interface HighlightResult {
  /** Pre-escaped inner HTML for a `<code>` element, with `hh-*` token spans. */
  html: string;
  /** Canonical language applied, or null when rendered as plain text. */
  language: string | null;
}

/** Highlight a fenced code block via the tree-sitter backend. */
export const highlightCode = (code: string, language?: string | null) =>
  invoke<HighlightResult>("highlight_code", {
    code,
    language: language ?? null,
  });

// AI integration ------------------------------------------------------------
export const getAiConfig = () => invoke<AiConfig | null>("get_ai_config");

export const setAiConfig = (config: AiConfig | null) =>
  invoke<void>("set_ai_config", { config });

/**
 * Send a note + instruction to the Cloudflare AI Gateway and return structured
 * edits. `system` and `userContent` are built by the action registry
 * (see src/lib/aiActions.ts).
 */
export const aiEdit = (system: string, userContent: string) =>
  invoke<AiEditResponse>("ai_edit", { req: { system, userContent } });

/** List model ids the configured gateway accepts (for the settings picker). */
export const aiListModels = () => invoke<string[]>("ai_list_models");

/** Force an interactive Cloudflare Access sign-in (opens the system browser). */
export const aiLogin = () => invoke<void>("ai_login");

/** Report cloudflared availability, whether AI is configured, and login state. */
export const aiAuthStatus = () => invoke<AiAuthStatus>("ai_auth_status");
