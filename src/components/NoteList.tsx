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
    return <div className="p-4 text-sm text-gray-500">Loading…</div>;
  }
  if (notes.length === 0) {
    return <div className="p-4 text-sm text-gray-500">No notes yet.</div>;
  }

  return (
    <ul className="overflow-auto">
      {notes.map((note) => {
        const selected = note.path === selectedPath;
        const when = note.metadata.start ?? note.metadata.createdAt;
        return (
          <li
            key={note.path}
            className={clsx(
              "group px-3 py-2 border-b border-gray-800 cursor-pointer flex items-start justify-between gap-2",
              selected
                ? "bg-emerald-500/15 border-l-2 border-l-emerald-500"
                : "hover:bg-gray-800",
            )}
            onClick={() => onSelect(note)}
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate text-gray-100">
                {noteTitle(note)}
              </div>
              <div className="text-xs text-gray-500">{formatDate(when)}</div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 shrink-0">
              <button
                className="text-xs text-gray-400 hover:text-emerald-300"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleArchive(note);
                }}
                title={note.metadata.archived ? "Unarchive note" : "Archive note"}
              >
                {note.metadata.archived ? "Unarchive" : "Archive"}
              </button>
              <button
                className="text-xs text-red-400 hover:text-red-300"
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
