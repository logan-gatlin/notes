import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatTimeRange,
  noteTitle,
} from "./format";
import type { NoteEntry } from "./types";

function note(
  metadata: Partial<NoteEntry["metadata"]>,
  body = "",
): NoteEntry {
  return {
    path: "/n.md",
    body,
    metadata: {
      id: "1",
      title: "Stored Title",
      createdAt: "2026-06-14T09:00:00-04:00",
      source: "manual",
      ...metadata,
    },
  };
}

describe("format helpers", () => {
  it("returns empty string for null/undefined", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatTimeRange(null)).toBe("");
  });

  it("formats a valid date", () => {
    expect(formatDate("2026-07-09T14:00:00-04:00")).toBe("Jul 9, 2026");
  });

  it("formats a time range with start and end", () => {
    const out = formatTimeRange(
      "2026-07-09T14:00:00-04:00",
      "2026-07-09T14:30:00-04:00",
    );
    expect(out).toContain("–");
  });

  it("handles invalid input gracefully", () => {
    expect(formatDateTime("not-a-date")).toBe("");
  });
});

describe("noteTitle", () => {
  it("titles a meeting note by its date", () => {
    expect(noteTitle(note({ source: "manual" }))).toBe("June 14");
  });

  it("prefers a meeting note's start date over createdAt", () => {
    expect(
      noteTitle(note({ source: "auto", start: "2026-12-25T10:00:00-05:00" })),
    ).toBe("December 25");
  });

  it("titles a misc note by its leading h1", () => {
    expect(noteTitle(note({ source: "misc" }, "# Grocery list\n- milk"))).toBe(
      "Grocery list",
    );
  });

  it("ignores blank lines before the h1", () => {
    expect(noteTitle(note({ source: "misc" }, "\n\n#   Padded  \nbody"))).toBe(
      "Padded",
    );
  });

  it("falls back when a misc note's first line is not an h1", () => {
    expect(noteTitle(note({ source: "misc" }, "just text"))).toBe(
      "Stored Title",
    );
  });

  it("does not treat a non-leading h1 as the title", () => {
    expect(noteTitle(note({ source: "misc" }, "intro\n# Later"))).toBe(
      "Stored Title",
    );
  });
});
