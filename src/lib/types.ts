export type NoteSource = "auto" | "manual" | "misc";

export interface NoteMetadata {
  id: string;
  title: string;
  meetingTypeId?: string | null;
  start?: string | null;
  end?: string | null;
  createdAt: string;
  source: NoteSource;
  archived?: boolean;
}

export interface NoteEntry {
  metadata: NoteMetadata;
  body: string;
  path: string;
}

export interface MeetingType {
  id: string;
  name: string;
}

export interface MeetingTypeInput {
  name: string;
}

export interface Config {
  notesRoot?: string | null;
  meetingTypes: MeetingType[];
}

export interface CreateNoteInput {
  title: string;
  meetingTypeId?: string | null;
  start?: string | null;
  end?: string | null;
  source: NoteSource;
  body?: string | null;
}
