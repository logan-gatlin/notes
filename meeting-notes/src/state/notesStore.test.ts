import { beforeEach, describe, expect, it, vi } from "vitest";

// The store module imports the tauri IPC wrappers, which import
// `@tauri-apps/api/core`. Stub it so importing the store is side-effect free.
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { MISC_ID, useNotesStore } from "./notesStore";
import type { NoteEntry } from "../lib/types";

function makeNote(path: string, overrides: Partial<NoteEntry["metadata"]> = {}): NoteEntry {
  return {
    path,
    body: "",
    metadata: {
      id: path,
      title: "T",
      createdAt: "2026-07-09T13:00:00-04:00",
      source: "auto",
      ...overrides,
    },
  };
}

describe("notesStore.upsert", () => {
  beforeEach(() => {
    useNotesStore.setState({
      notes: [],
      selected: null,
      filter: null,
      searchQuery: "",
    });
  });

  it("adds a note matching the current 'all' filter", () => {
    useNotesStore.getState().upsert(makeNote("/a.md", { meetingTypeId: "x" }));
    expect(useNotesStore.getState().notes).toHaveLength(1);
  });

  it("adds a note matching a specific meeting-type filter", () => {
    useNotesStore.setState({ filter: "weekly-sync" });
    useNotesStore
      .getState()
      .upsert(makeNote("/a.md", { meetingTypeId: "weekly-sync" }));
    expect(useNotesStore.getState().notes).toHaveLength(1);
  });

  it("ignores a note that does not match the active filter", () => {
    useNotesStore.setState({ filter: "weekly-sync" });
    useNotesStore
      .getState()
      .upsert(makeNote("/a.md", { meetingTypeId: "standup" }));
    expect(useNotesStore.getState().notes).toHaveLength(0);
  });

  it("routes misc notes into the misc filter", () => {
    useNotesStore.setState({ filter: MISC_ID });
    useNotesStore.getState().upsert(makeNote("/m.md", { source: "misc" }));
    expect(useNotesStore.getState().notes).toHaveLength(1);
  });

  it("replaces an existing note by path instead of duplicating", () => {
    useNotesStore.setState({ notes: [makeNote("/a.md", { title: "Old" })] });
    useNotesStore.getState().upsert(makeNote("/a.md", { title: "New" }));
    const notes = useNotesStore.getState().notes;
    expect(notes).toHaveLength(1);
    expect(notes[0].metadata.title).toBe("New");
  });

  it("does not add during an active search", () => {
    useNotesStore.setState({ searchQuery: "budget" });
    useNotesStore.getState().upsert(makeNote("/a.md"));
    expect(useNotesStore.getState().notes).toHaveLength(0);
  });
});
