import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import type { AiEdit, NoteEntry } from "../lib/types";
import { NoteEditor } from "./NoteEditor";
import { NotePreview } from "./NotePreview";
import { MetadataBar } from "./MetadataBar";
import { EditorContextMenu } from "./EditorContextMenu";
import { setDatePreservingTime } from "../lib/format";
import { useNotesStore } from "../state/notesStore";
import { useMeetingTypesStore } from "../state/meetingTypesStore";
import { aiEdit } from "../lib/tauri";
import { AI_ACTIONS, type AiAction, type AiActionContext } from "../lib/aiActions";
import { findPromptBlock } from "../lib/promptBlock";

type SaveState = "saved" | "saving" | "dirty";
type ViewMode = "edit" | "split" | "preview";
type AiState = "idle" | "running";

interface MenuState {
  x: number;
  y: number;
  ctx: AiActionContext;
}

const AUTOSAVE_MS = 750;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Resolve AI edits (anchored by exact `oldText`) into CodeMirror changes and
 * apply them in a single transaction (one undo step). Returns the number of
 * edits that could not be located.
 */
function applyAiEdits(
  view: EditorView,
  edits: AiEdit[],
  cursorFallback: number,
): { applied: number; missed: number } {
  const doc = view.state.doc.toString();
  const changes: { from: number; to: number; insert: string }[] = [];
  let missed = 0;

  for (const edit of edits) {
    if (edit.oldText.length === 0) {
      const pos = clamp(cursorFallback, 0, doc.length);
      changes.push({ from: pos, to: pos, insert: edit.newText });
      continue;
    }
    const idx = doc.indexOf(edit.oldText);
    if (idx === -1) {
      missed += 1;
      continue;
    }
    changes.push({ from: idx, to: idx + edit.oldText.length, insert: edit.newText });
  }

  // Sort by position and drop any overlapping edits (keep earliest).
  changes.sort((a, b) => a.from - b.from || a.to - b.to);
  const safe: typeof changes = [];
  let lastEnd = -1;
  for (const c of changes) {
    if (c.from < lastEnd) {
      missed += 1;
      continue;
    }
    safe.push(c);
    lastEnd = c.to;
  }

  if (safe.length === 0) return { applied: 0, missed };

  // Place the cursor at the end of the first applied edit.
  const first = safe[0];
  const caret = first.from + first.insert.length;

  view.dispatch({
    changes: safe,
    selection: { anchor: clamp(caret, 0, doc.length + first.insert.length) },
    scrollIntoView: true,
  });
  view.focus();

  return { applied: safe.length, missed };
}

/**
 * Editor + preview for a single note, with debounced autosave.
 * The parent remounts this (via `key={note.path}`) when switching notes.
 */
export function EditorPane({ note }: { note: NoteEntry }) {
  const save = useNotesStore((s) => s.save);
  const meetingTypes = useMeetingTypesStore((s) => s.types);

  const [body, setBody] = useState(note.body);
  const [metadata, setMetadata] = useState(note.metadata);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [mode, setMode] = useState<ViewMode>("split");
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiError, setAiError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const latest = useRef({ body, metadata });
  latest.current = { body, metadata };

  const meetingTypeName = meetingTypes.find(
    (t) => t.id === metadata.meetingTypeId,
  )?.name;

  const flush = useCallback(async () => {
    setSaveState("saving");
    try {
      await save(note.path, latest.current.metadata, latest.current.body);
      setSaveState("saved");
    } catch {
      setSaveState("dirty");
    }
  }, [note.path, save]);

  const scheduleSave = useCallback(() => {
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, AUTOSAVE_MS);
  }, [flush]);

  const handleDateChange = useCallback(
    (dateStr: string) => {
      const start = setDatePreservingTime(dateStr, metadata.start);
      if (!start) return;
      setMetadata((m) => ({ ...m, start }));
      scheduleSave();
    },
    [metadata.start, scheduleSave],
  );

  const openMenu = useCallback((e: React.MouseEvent) => {
    const view = viewRef.current;
    if (!view) return;
    e.preventDefault();
    const sel = view.state.selection.main;
    const doc = view.state.doc.toString();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      ctx: {
        doc,
        cursorOffset: sel.head,
        selectionText: view.state.sliceDoc(sel.from, sel.to),
        selectionFrom: sel.from,
        selectionTo: sel.to,
        promptBlock: findPromptBlock(doc, sel.head),
      },
    });
  }, []);

  const runAction = useCallback(async (action: AiAction, ctx: AiActionContext) => {
    const built = action.build(ctx);
    if ("error" in built) {
      setAiError(built.error);
      return;
    }
    setAiError(null);
    setAiState("running");
    try {
      const res = await aiEdit(built.system, built.userContent);
      const view = viewRef.current;
      if (!view) return;
      if (res.edits.length === 0) {
        setAiError(res.message ?? "The AI did not return any edits.");
        return;
      }
      const { applied, missed } = applyAiEdits(view, res.edits, ctx.cursorOffset);
      if (applied === 0) {
        setAiError("Could not locate the text the AI tried to edit. No changes made.");
      } else if (missed > 0) {
        setAiError(`Applied ${applied} edit(s); ${missed} could not be located.`);
      }
    } catch (err) {
      setAiError(typeof err === "string" ? err : String(err));
    } finally {
      setAiState("idle");
    }
  }, []);

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
    <div className="relative flex flex-col h-full">
      <MetadataBar
        note={{ ...note, body, metadata }}
        meetingTypeName={meetingTypeName}
        saveState={saveState}
        onDateChange={handleDateChange}
      />

      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-line bg-panel">
        {(["edit", "split", "preview"] as ViewMode[]).map((m) => (
          <button
            key={m}
            className={
              "px-2.5 py-1 rounded-md text-xs transition-colors " +
              (mode === m
                ? "marker-wash text-ink font-semibold"
                : "text-muted hover:text-ink hover:bg-paper")
            }
            onClick={() => setMode(m)}
          >
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {mode !== "preview" && (
          <div
            className={
              (mode === "split"
                ? "flex-1 md:flex-none md:w-1/2 border-b md:border-b-0 md:border-r border-line"
                : "w-full") + " min-h-0"
            }
            onContextMenu={openMenu}
          >
            <NoteEditor
              initialValue={note.body}
              onChange={(v) => {
                setBody(v);
                scheduleSave();
              }}
              onReady={(view) => {
                viewRef.current = view;
              }}
            />
          </div>
        )}
        {mode !== "edit" && (
          <div
            className={
              (mode === "split" ? "flex-1 md:flex-none md:w-1/2" : "w-full") +
              " min-h-0"
            }
          >
            <NotePreview body={body} full={mode === "preview"} />
          </div>
        )}
      </div>

      {menu && (
        <EditorContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={AI_ACTIONS.map((action) => ({
            id: action.id,
            label: action.label,
            disabled: aiState === "running" || !action.isAvailable(menu.ctx),
            onSelect: () => void runAction(action, menu.ctx),
          }))}
        />
      )}

      {(aiState === "running" || aiError) && (
        <div className="absolute bottom-4 right-4 z-40 max-w-sm">
          {aiState === "running" ? (
            <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink-soft shadow-lg">
              <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
              Thinking…
            </div>
          ) : (
            aiError && (
              <div className="flex items-start gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink shadow-lg">
                <span className="flex-1">{aiError}</span>
                <button
                  className="text-muted hover:text-ink leading-none"
                  onClick={() => setAiError(null)}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
