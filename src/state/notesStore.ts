import { create } from "zustand";
import type { CreateNoteInput, NoteEntry, NoteMetadata } from "../lib/types";
import * as api from "../lib/tauri";

/** Sentinel meeting-type id for the misc folder. */
export const MISC_ID = "_misc";

interface NotesState {
  notes: NoteEntry[];
  selected: NoteEntry | null;
  /** Current filter: a meeting type id, MISC_ID, or null for "all". */
  filter: string | null;
  searchQuery: string;
  loading: boolean;
  error: string | null;

  loadNotes: (meetingTypeId: string | null) => Promise<void>;
  select: (note: NoteEntry | null) => void;
  create: (input: CreateNoteInput) => Promise<NoteEntry>;
  save: (path: string, metadata: NoteMetadata, body: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
  search: (query: string) => Promise<void>;
  /** Merge a note created by the backend scheduler into the current list. */
  upsert: (note: NoteEntry) => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  selected: null,
  filter: null,
  searchQuery: "",
  loading: false,
  error: null,

  loadNotes: async (meetingTypeId) => {
    set({ loading: true, error: null, filter: meetingTypeId, searchQuery: "" });
    try {
      const notes = await api.listNotes(meetingTypeId);
      set({ notes, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  select: (note) => set({ selected: note }),

  create: async (input) => {
    const note = await api.createNote(input);
    get().upsert(note);
    set({ selected: note });
    return note;
  },

  save: async (path, metadata, body) => {
    await api.writeNote(path, metadata, body);
    set({
      notes: get().notes.map((n) =>
        n.path === path ? { ...n, metadata, body } : n,
      ),
      selected:
        get().selected?.path === path
          ? { ...get().selected!, metadata, body }
          : get().selected,
    });
  },

  remove: async (path) => {
    await api.deleteNote(path);
    set({
      notes: get().notes.filter((n) => n.path !== path),
      selected: get().selected?.path === path ? null : get().selected,
    });
  },

  search: async (query) => {
    set({ searchQuery: query });
    if (!query.trim()) {
      await get().loadNotes(get().filter);
      return;
    }
    set({ loading: true, error: null });
    try {
      set({ notes: await api.searchNotes(query), loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  upsert: (note) => {
    const { notes, filter, searchQuery } = get();
    // Only surface into the list if it matches the current view.
    const matchesFilter =
      searchQuery.trim() === "" &&
      (filter === null ||
        note.metadata.meetingTypeId === filter ||
        (filter === MISC_ID && note.metadata.source === "misc"));
    const exists = notes.some((n) => n.path === note.path);
    if (exists) {
      set({ notes: notes.map((n) => (n.path === note.path ? note : n)) });
    } else if (matchesFilter) {
      set({ notes: [note, ...notes] });
    }
  },
}));
