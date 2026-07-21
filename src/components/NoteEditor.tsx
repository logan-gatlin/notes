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
import { languages } from "@codemirror/language-data";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// Syntax highlighting themed to "The Ledger" (warm paper + ink). Covers both
// markdown structure and the code tokens inside fenced blocks, so the editor
// matches the tree-sitter preview theme.
//
// The markdown grammar tags structural marks (`#`, `*`, `` ` ``, `-`, `>`) as
// `processingInstruction`; we keep those quiet and let the content stand out.
const ledgerHighlight = HighlightStyle.define([
  // --- Markdown structure --------------------------------------------------
  { tag: t.heading1, fontWeight: "700", fontSize: "1.35em", color: "#191a17" },
  { tag: t.heading2, fontWeight: "700", fontSize: "1.2em", color: "#191a17" },
  { tag: t.heading3, fontWeight: "700", fontSize: "1.08em", color: "#191a17" },
  {
    tag: [t.heading4, t.heading5, t.heading6],
    fontWeight: "700",
    color: "#191a17",
  },
  { tag: t.processingInstruction, color: "#b3a894" },
  { tag: t.strong, fontWeight: "700", color: "#191a17" },
  { tag: t.emphasis, fontStyle: "italic", color: "#42443d" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "#9a9b8e" },
  { tag: [t.link, t.url], color: "#b4530c", textDecoration: "underline" },
  { tag: t.quote, color: "#7c7f74", fontStyle: "italic" },
  { tag: t.list, color: "#42443d" },
  { tag: t.contentSeparator, color: "#7c7f74" },
  { tag: t.monospace, color: "#2e6b8a" }, // inline code

  // --- Code tokens inside fenced blocks ------------------------------------
  { tag: t.comment, color: "#9a9b8e", fontStyle: "italic" },
  {
    tag: [
      t.keyword,
      t.modifier,
      t.controlKeyword,
      t.operatorKeyword,
      t.moduleKeyword,
      t.definitionKeyword,
    ],
    color: "#b4530c",
  },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#5e7a2e" },
  { tag: t.escape, color: "#9a6400" },
  {
    tag: [t.number, t.bool, t.atom, t.constant(t.name), t.literal],
    color: "#9a6400",
  },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName],
    color: "#2e6b8a",
  },
  {
    tag: [t.typeName, t.className, t.namespace, t.definition(t.typeName)],
    color: "#7a5aa6",
  },
  {
    tag: [
      t.operator,
      t.punctuation,
      t.separator,
      t.bracket,
      t.angleBracket,
      t.derefOperator,
    ],
    color: "#8a8c80",
  },
  { tag: [t.propertyName, t.variableName, t.attributeValue], color: "#42443d" },
  { tag: [t.attributeName, t.labelName], color: "#9a6400" },
  { tag: t.tagName, color: "#b4530c" },
  { tag: t.meta, color: "#7c7f74" },
  { tag: t.invalid, color: "#a63328" },
]);

interface NoteEditorProps {
  /** Initial document. The component is expected to be remounted (via `key`)
   *  when switching to a different note. */
  initialValue: string;
  onChange: (value: string) => void;
  /** Receives the CodeMirror view once created (and `null` on teardown), so a
   *  parent can read the selection/cursor and dispatch AI edits. */
  onReady?: (view: EditorView | null) => void;
}

/** A thin CodeMirror 6 wrapper configured for markdown editing. */
export function NoteEditor({ initialValue, onChange, onReady }: NoteEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

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
        markdown({ codeLanguages: languages }),
        syntaxHighlighting(ledgerHighlight),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        updateListener,
        EditorView.theme(
          {
            "&": {
              height: "100%",
              fontSize: "14px",
              backgroundColor: "#ffffff",
              color: "#191a17",
            },
            ".cm-content": {
              caretColor: "#b4530c",
              padding: "12px 4px",
              lineHeight: "1.6",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            },
            "&.cm-focused .cm-cursor": { borderLeftColor: "#b4530c" },
            "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
              { backgroundColor: "rgba(255, 210, 77, 0.45)" },
            ".cm-gutters": {
              backgroundColor: "#ffffff",
              color: "#bcbeb4",
              border: "none",
            },
            ".cm-activeLine": { backgroundColor: "#fbfaf6" },
            ".cm-activeLineGutter": {
              backgroundColor: "#fbfaf6",
              color: "#7c7f74",
            },
            ".cm-scroller": { overflow: "auto" },
          },
          { dark: false },
        ),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    onReadyRef.current?.(view);

    return () => {
      onReadyRef.current?.(null);
      view.destroy();
      viewRef.current = null;
    };
    // Intentionally only run once per mount; parent remounts via `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="h-full overflow-hidden" />;
}
