import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MetadataBar } from "./MetadataBar";
import type { NoteEntry } from "../lib/types";

function note(
  overrides: Partial<NoteEntry["metadata"]> = {},
  body = "",
): NoteEntry {
  return {
    path: "/n.md",
    body,
    metadata: {
      id: "1",
      title: "Weekly Sync",
      createdAt: "2026-07-09T13:00:00-04:00",
      source: "manual",
      ...overrides,
    },
  };
}

describe("MetadataBar", () => {
  it("titles a meeting note by its date", () => {
    render(<MetadataBar note={note()} saveState="saved" />);
    expect(screen.getByText("July 9")).toBeInTheDocument();
  });

  it("titles a misc note by its leading h1", () => {
    render(
      <MetadataBar
        note={note({ source: "misc" }, "# My Idea\n\nbody")}
        saveState="saved"
      />,
    );
    expect(screen.getByText("My Idea")).toBeInTheDocument();
  });

  it("shows the save state", () => {
    render(<MetadataBar note={note()} saveState="saving" />);
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  it("offers a date editor for meeting notes, defaulting to the note's date", () => {
    render(<MetadataBar note={note()} saveState="saved" />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    // Defaults to createdAt when start is absent.
    expect(input.value).toBe("2026-07-09");
  });

  it("emits the picked date on change (backdating)", () => {
    const onDateChange = vi.fn();
    render(
      <MetadataBar note={note()} saveState="saved" onDateChange={onDateChange} />,
    );
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-07-01" },
    });
    expect(onDateChange).toHaveBeenCalledWith("2026-07-01");
  });

  it("does not offer a date editor for misc notes", () => {
    render(<MetadataBar note={note({ source: "misc" })} saveState="saved" />);
    expect(screen.queryByLabelText("Date")).not.toBeInTheDocument();
  });
});
