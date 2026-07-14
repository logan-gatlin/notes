import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MetadataBar } from "./MetadataBar";
import type { NoteEntry } from "../lib/types";

function note(overrides: Partial<NoteEntry["metadata"]> = {}): NoteEntry {
  return {
    path: "/n.md",
    body: "",
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
  it("allows editing the title for manual notes", () => {
    const onTitleChange = vi.fn();
    render(
      <MetadataBar
        note={note()}
        onTitleChange={onTitleChange}
        saveState="saved"
      />,
    );
    const input = screen.getByPlaceholderText("Untitled note");
    fireEvent.change(input, { target: { value: "Renamed" } });
    expect(onTitleChange).toHaveBeenCalledWith("Renamed");
  });

  it("shows the save state", () => {
    render(
      <MetadataBar note={note()} onTitleChange={vi.fn()} saveState="saving" />,
    );
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });
});
