import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteEntry } from "../lib/types";
import { NoteEditor } from "./NoteEditor";
import { NotePreview } from "./NotePreview";
import { MetadataBar } from "./MetadataBar";
import { useNotesStore } from "../state/notesStore";
import { useMeetingTypesStore } from "../state/meetingTypesStore";

type SaveState = "saved" | "saving" | "dirty";
type ViewMode = "edit" | "split" | "preview";

const AUTOSAVE_MS = 750;

/**
 * Editor + preview for a single note, with debounced autosave.
 * The parent remounts this (via `key={note.path}`) when switching notes.
 */
export function EditorPane({ note }: { note: NoteEntry }) {
  const save = useNotesStore((s) => s.save);
  const meetingTypes = useMeetingTypesStore((s) => s.types);

  const [body, setBody] = useState(note.body);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [mode, setMode] = useState<ViewMode>("split");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ body });
  latest.current = { body };

  const meetingTypeName = meetingTypes.find(
    (t) => t.id === note.metadata.meetingTypeId,
  )?.name;

  const flush = useCallback(async () => {
    setSaveState("saving");
    try {
      await save(note.path, note.metadata, latest.current.body);
      setSaveState("saved");
    } catch {
      setSaveState("dirty");
    }
  }, [note.path, note.metadata, save]);

  const scheduleSave = useCallback(() => {
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, AUTOSAVE_MS);
  }, [flush]);

  // Flush pending changes on unmount / note switch.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void flush();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full">
      <MetadataBar
        note={{ ...note, body }}
        meetingTypeName={meetingTypeName}
        saveState={saveState}
      />

      <div className="flex items-center gap-1 px-3 py-1 border-b border-gray-800 text-xs text-gray-300 bg-gray-900">
        {(["edit", "split", "preview"] as ViewMode[]).map((m) => (
          <button
            key={m}
            className={
              "px-2 py-0.5 rounded " +
              (mode === m
                ? "bg-emerald-500/15 text-emerald-300 font-medium"
                : "hover:bg-gray-800")
            }
            onClick={() => setMode(m)}
          >
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex">
        {mode !== "preview" && (
          <div
            className={
              (mode === "split" ? "w-1/2 border-r border-gray-800" : "w-full") +
              " min-h-0"
            }
          >
            <NoteEditor
              initialValue={note.body}
              onChange={(v) => {
                setBody(v);
                scheduleSave();
              }}
            />
          </div>
        )}
        {mode !== "edit" && (
          <div className={mode === "split" ? "w-1/2 min-h-0" : "w-full min-h-0"}>
            <NotePreview body={body} />
          </div>
        )}
      </div>
    </div>
  );
}
