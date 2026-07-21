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

export interface AiConfig {
  /** Access-protected gateway base, e.g. https://ai-gw.example.com/v1/<acct>/<gw> */
  baseUrl: string;
  /** Model id, e.g. anthropic/claude-3-5-sonnet-20241022 */
  model: string;
  /** Optional cf-aig-authorization token; usually unset behind Access. */
  gatewayToken?: string | null;
}

export interface Config {
  notesRoot?: string | null;
  meetingTypes: MeetingType[];
  ai?: AiConfig | null;
}

/** A single anchored edit returned by the AI. */
export interface AiEdit {
  /** Exact substring to replace; empty string means insert at the cursor. */
  oldText: string;
  newText: string;
}

export interface AiEditResponse {
  edits: AiEdit[];
  message?: string | null;
}

export interface AiAuthStatus {
  cloudflaredAvailable: boolean;
  configured: boolean;
  signedIn: boolean;
}

export interface CreateNoteInput {
  title: string;
  meetingTypeId?: string | null;
  start?: string | null;
  end?: string | null;
  source: NoteSource;
  body?: string | null;
}
