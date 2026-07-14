import { invoke } from "@tauri-apps/api/core";
import type {
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

export const deleteNote = (path: string) =>
  invoke<void>("delete_note", { path });

export const searchNotes = (query: string) =>
  invoke<NoteEntry[]>("search_notes", { query });
