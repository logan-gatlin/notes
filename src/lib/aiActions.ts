/**
 * Registry of AI actions available from the editor's right-click menu.
 *
 * Each action turns the current editor context (document, cursor, selection,
 * and any inline `<...>` prompt block) into a `{ system, userContent }` pair
 * that is sent to the Cloudflare AI Gateway. Adding a new action (e.g.
 * "Summarize", "Translate") is just adding an entry to `AI_ACTIONS`.
 */

import type { PromptBlock } from "./promptBlock";

export interface AiActionContext {
  /** Full note text. */
  doc: string;
  /** Cursor offset (head of the selection). */
  cursorOffset: number;
  /** Currently selected text ("" when the selection is empty). */
  selectionText: string;
  selectionFrom: number;
  selectionTo: number;
  /** The `<...>` prompt block at/nearest the cursor, if any. */
  promptBlock: PromptBlock | null;
}

export interface AiRequestContent {
  system: string;
  userContent: string;
}

export interface AiAction {
  id: string;
  label: string;
  /** Whether this action makes sense for the current context. */
  isAvailable: (ctx: AiActionContext) => boolean;
  /** Build the request, or return a user-facing error string if it can't. */
  build: (ctx: AiActionContext) => AiRequestContent | { error: string };
}

const SYSTEM_PROMPT = `You are an AI writing assistant embedded in a markdown notes editor. You edit the user's note directly by calling the \`apply_edits\` tool.

Each edit has:
- "oldText": an EXACT, verbatim substring copied character-for-character from the current note (including whitespace, punctuation, and markdown). The app locates this substring and replaces it. Use an empty string to insert text at the cursor.
- "newText": the replacement text. Use an empty string to delete.

Rules:
- Copy "oldText" verbatim from the note. If it does not match exactly, the edit is rejected.
- Make the smallest edits that accomplish the task.
- Write "newText" as clean markdown that fits naturally into the surrounding note.
- Do not wrap output in code fences unless the note context is itself a code block.
- Never leave the literal angle-bracket prompt (e.g. "<...>") in the note; replace it.
- Respond only via the apply_edits tool.`;

/** Shared preamble giving the model the verbatim note plus cursor/selection. */
function buildContext(ctx: AiActionContext): string {
  const selection =
    ctx.selectionText.length > 0
      ? JSON.stringify(ctx.selectionText)
      : "(none)";

  return [
    "Current note (verbatim, between the markers):",
    "<<<NOTE",
    ctx.doc,
    "NOTE>>>",
    "",
    `Cursor character offset: ${ctx.cursorOffset}`,
    `Selected text: ${selection}`,
  ].join("\n");
}

export const AI_ACTIONS: AiAction[] = [
  {
    id: "prompt",
    label: "Prompt",
    isAvailable: (ctx) =>
      (ctx.promptBlock?.text.length ?? 0) > 0 || ctx.selectionText.length > 0,
    build: (ctx) => {
      const block = ctx.promptBlock;
      let instruction: string;

      if (block && block.text.length > 0) {
        instruction = [
          `The user wrote this instruction inside the note as an angle-bracket prompt: ${JSON.stringify(block.text)}.`,
          `Carry out that instruction. Replace the exact prompt text ${JSON.stringify(block.raw)} with your answer as markdown. Do not leave the angle brackets behind.`,
        ].join(" ");
      } else if (ctx.selectionText.length > 0) {
        instruction = [
          `The user selected this text as an instruction: ${JSON.stringify(ctx.selectionText)}.`,
          `Carry out that instruction, replacing the selected text with your answer.`,
        ].join(" ");
      } else {
        return {
          error:
            "Write a prompt inside angle brackets (e.g. <your question>) or select text, then try again.",
        };
      }

      return {
        system: SYSTEM_PROMPT,
        userContent: `${buildContext(ctx)}\n\nTask: ${instruction}`,
      };
    },
  },
  {
    id: "proofread",
    label: "Proofread",
    isAvailable: () => true,
    build: (ctx) => {
      const target =
        ctx.selectionText.length > 0
          ? `Proofread the selected text: ${JSON.stringify(ctx.selectionText)}. Only edit within the selection.`
          : `Proofread the entire note.`;

      const instruction = [
        target,
        "Correct spelling, grammar, and punctuation. Preserve the original meaning, tone, and markdown structure. Do not rewrite content that is already correct.",
      ].join(" ");

      return {
        system: SYSTEM_PROMPT,
        userContent: `${buildContext(ctx)}\n\nTask: ${instruction}`,
      };
    },
  },
];
