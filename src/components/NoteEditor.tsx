import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";

interface NoteEditorProps {
  /** Initial document. The component is expected to be remounted (via `key`)
   *  when switching to a different note. */
  initialValue: string;
  onChange: (value: string) => void;
}

/** A thin CodeMirror 6 wrapper configured for markdown editing. */
export function NoteEditor({ initialValue, onChange }: NoteEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        markdown(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        updateListener,
        EditorView.theme(
          {
            "&": {
              height: "100%",
              fontSize: "14px",
              backgroundColor: "#0f1512",
              color: "#e5e7eb",
            },
            ".cm-content": {
              caretColor: "#34d399",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            },
            "&.cm-focused .cm-cursor": { borderLeftColor: "#34d399" },
            "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
              { backgroundColor: "#134e3a" },
            ".cm-gutters": {
              backgroundColor: "#0f1512",
              color: "#4b5563",
              border: "none",
            },
            ".cm-activeLine": { backgroundColor: "#18211d" },
            ".cm-activeLineGutter": {
              backgroundColor: "#18211d",
              color: "#9ca3af",
            },
            ".cm-scroller": { overflow: "auto" },
          },
          { dark: true },
        ),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Intentionally only run once per mount; parent remounts via `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="h-full overflow-hidden" />;
}
