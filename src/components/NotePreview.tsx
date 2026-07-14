import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface NotePreviewProps {
  body: string;
}

/** Renders the markdown body. Uses the Tailwind `prose`-free minimal styling
 *  per the plan (no theming pass in v1) — just readable defaults. */
export function NotePreview({ body }: NotePreviewProps) {
  return (
    <div className="h-full overflow-auto p-4 text-sm leading-relaxed markdown-preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
