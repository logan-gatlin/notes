/**
 * Utilities for locating an inline prompt block written as `<...>` in the note.
 *
 * The primary AI interaction is: the user types a prompt inside angle brackets
 * (e.g. `<summarize the section above>`), right-clicks, and runs an action. We
 * find the bracketed region at (or nearest to) the cursor so the action can use
 * its contents as the instruction and replace it with the result.
 */

export interface PromptBlock {
  /** Inner text of the block, trimmed (without the angle brackets). */
  text: string;
  /** Full matched text including the surrounding `<` and `>`. */
  raw: string;
  /** Start offset of the block (at the `<`). */
  from: number;
  /** End offset of the block (just after the `>`). */
  to: number;
}

// A block is `<...>` on a single line, with no nested angle brackets.
const BLOCK_RE = /<[^<>\n]*>/g;

/**
 * Find the `<...>` block containing the cursor, or—if none contains it—the
 * nearest one in the document. Returns `null` when no block exists.
 */
export function findPromptBlock(doc: string, cursor: number): PromptBlock | null {
  let nearest: PromptBlock | null = null;
  let nearestDist = Infinity;

  for (const m of doc.matchAll(BLOCK_RE)) {
    const from = m.index ?? 0;
    const to = from + m[0].length;
    const block: PromptBlock = {
      raw: m[0],
      text: m[0].slice(1, -1).trim(),
      from,
      to,
    };

    // Cursor inside (or touching the edges of) the block: exact match.
    if (cursor >= from && cursor <= to) return block;

    const dist = cursor < from ? from - cursor : cursor - to;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = block;
    }
  }

  return nearest;
}
