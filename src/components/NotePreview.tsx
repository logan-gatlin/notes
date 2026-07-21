import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightCode } from "../lib/tauri";

interface NotePreviewProps {
  body: string;
  /** When true (full-width preview) the text is capped and centered for
   *  reading; otherwise it fills the pane (e.g. the split view). */
  full?: boolean;
}

/**
 * A fenced code block, highlighted by the tree-sitter backend.
 *
 * Highlighting is async (an IPC round-trip), so we render the plain source
 * first and swap in the highlighted HTML when it arrives. If the backend is
 * unavailable (e.g. a non-Tauri preview) we simply keep the plain source.
 */
function HighlightedCode({ code, lang }: { code: string; lang?: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    highlightCode(code, lang)
      .then((r) => alive && setHtml(r.html))
      .catch(() => alive && setHtml(null));
    return () => {
      alive = false;
    };
  }, [code, lang]);

  if (html === null) {
    return <code className="hl">{code}</code>;
  }
  // `html` is produced and escaped by the Rust backend.
  return <code className="hl" dangerouslySetInnerHTML={{ __html: html }} />;
}

const components: Components = {
  code(props) {
    const { children, className } = props;
    const text = String(children ?? "");
    const match = /language-([\w-]+)/.exec(className ?? "");
    // Inline spans have no language and no newline; everything else is a block.
    const isBlock = match !== null || text.includes("\n");
    if (!isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <HighlightedCode code={text.replace(/\n$/, "")} lang={match?.[1]} />
    );
  },
};

/** Renders the markdown body with tree-sitter syntax highlighting. */
export function NotePreview({ body, full = false }: NotePreviewProps) {
  return (
    <div className="h-full overflow-auto bg-paper px-6 py-5">
      <div className={"markdown-preview" + (full ? " markdown-preview--full" : "")}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {body}
        </ReactMarkdown>
      </div>
    </div>
  );
}
