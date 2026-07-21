import type { NoteEntry } from "../lib/types";
import { formatDate, noteTitle } from "../lib/format";
import clsx from "clsx";

interface NoteListProps {
  notes: NoteEntry[];
  selectedPath?: string | null;
  loading: boolean;
  onSelect: (note: NoteEntry) => void;
  onDelete: (note: NoteEntry) => void;
  onToggleArchive: (note: NoteEntry) => void;
}

export function NoteList({
  notes,
  selectedPath,
  loading,
  onSelect,
  onDelete,
  onToggleArchive,
}: NoteListProps) {
  if (loading) {
    return <div className="p-4 text-sm text-muted">Loading…</div>;
  }
  if (notes.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-ink-soft">No notes here yet.</p>
        <p className="mt-1 text-xs text-muted">
          Use a button above to start one.
        </p>
      </div>
    );
  }

  return (
    <ul>
      {notes.map((note) => {
        const selected = note.path === selectedPath;
        const when = note.metadata.start ?? note.metadata.createdAt;
        return (
          <li
            key={note.path}
            className={clsx(
              "group px-3 py-2.5 border-b border-line cursor-pointer flex items-start justify-between gap-2 transition-colors",
              selected ? "marker-wash" : "hover:bg-paper",
            )}
            onClick={() => onSelect(note)}
          >
            <div className="min-w-0">
              <div
                className={clsx(
                  "text-sm truncate",
                  selected
                    ? "font-semibold text-ink"
                    : "font-medium text-ink-soft group-hover:text-ink",
                )}
              >
                {noteTitle(note)}
              </div>
              <div className="mt-0.5 font-mono text-[11px] tracking-tight text-muted">
                {formatDate(when)}
                {note.metadata.archived && (
                  <span className="ml-2 uppercase tracking-eyebrow text-[9px]">
                    Archived
                  </span>
                )}
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-2 shrink-0 transition-opacity">
              <button
                className="text-xs text-muted hover:text-ink"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleArchive(note);
                }}
                title={note.metadata.archived ? "Unarchive note" : "Archive note"}
              >
                {note.metadata.archived ? "Unarchive" : "Archive"}
              </button>
              <button
                className="text-xs text-muted hover:text-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(note);
                }}
                title="Delete note"
              >
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
