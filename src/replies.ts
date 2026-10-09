/**
 * Suggested replies: the two to four things the person is most likely to say
 * next, as buttons under the answer. One tap sends it.
 *
 * From OrangeCat's Cat, where it was the most-used control in the chat and
 * existed nowhere else in the fleet. The model writes the replies itself, at
 * the end of its answer, in a fenced block:
 *
 *     ```quick_replies
 *     ["Yes, set it up", "Show me the numbers first", "Not now"]
 *     ```
 *
 * Asking the model in the same turn costs no second call and no latency, and
 * the replies are written by the thing that knows what it just asked. This
 * file is the one place the format lives: the instruction that asks for it,
 * and the parser that takes it back out — including while it is still
 * streaming, so a reader never watches raw JSON appear under an answer.
 */

export const REPLIES_FENCE = "quick_replies";

export type RepliesOptions = {
  /** At most this many buttons. Default 4. */
  max?: number;
  /** Longer than this is a sentence, not a button. Default 48. */
  maxLength?: number;
};

/**
 * Append to a system prompt. Written so a model leaves the block off when no
 * reply is likely — a button row on every answer is noise, and noise is what
 * makes people stop reading buttons.
 */
export const REPLIES_INSTRUCTION = [
  "## Suggested replies",
  "When the person's next message is predictable — you asked a question, offered a choice, or there is an obvious next step — end your answer with a fenced block of 2–4 short replies they could tap instead of typing:",
  "```" + REPLIES_FENCE,
  '["Yes, do it", "Show me first", "Not now"]',
  "```",
  "Rules: write them in the person's language, in their voice (what THEY would say, not what you would). Each under 40 characters. Each must make sense sent on its own. Never repeat what they already said. Put the block last, after everything else. Leave it out entirely when no reply is likely, or when the conversation is over.",
].join("\n");

const COMPLETE = new RegExp("\\n?```" + REPLIES_FENCE + "\\s*([\\s\\S]*?)```", "i");
// Still streaming: the fence has opened (or is opening) and not yet closed.
const OPEN_TAIL = new RegExp("\\n?```(?:" + REPLIES_FENCE + "[\\s\\S]*|q[a-z_]*)?$", "i");

function clean(raw: string, { max = 4, maxLength = 48 }: RepliesOptions): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    // A model sometimes writes one reply per line instead of a JSON array.
    parsed = raw
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^["']|["'],?$/g, ""));
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of parsed) {
    if (typeof item !== "string") continue;
    const reply = item.trim();
    const key = reply.toLowerCase();
    if (!reply || reply.length > maxLength || seen.has(key)) continue;
    seen.add(key);
    out.push(reply);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Split an answer into the text to show and its suggested replies. Safe on a
 * partial, streaming answer: an unfinished block is hidden, never shown.
 * Text with no block comes back unchanged with `replies: []`.
 */
export function extractReplies(
  text: string,
  options: RepliesOptions = {},
): { text: string; replies: string[] } {
  const match = COMPLETE.exec(text);
  if (match) {
    const rest = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).trimEnd();
    return { text: rest, replies: clean(match[1] ?? "", options) };
  }
  const tail = OPEN_TAIL.exec(text);
  // A bare ``` at the end may be the start of an ordinary code block; only
  // hide it while it could still become ours.
  if (tail && tail[0].trim() !== "```") {
    return { text: text.slice(0, tail.index).trimEnd(), replies: [] };
  }
  return { text, replies: [] };
}
