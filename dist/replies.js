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
/**
 * Append to a system prompt. The model leads: every answer ends with the two
 * to four things the person is most likely to say next, the first being the
 * recommended next step. That is what makes a chat on a phone usable with a
 * thumb — the answer is read, the next move is one tap (owner, 2026-10-21:
 * "AI helps us to answer and lead the conversation"). Only an answer that
 * ends the conversation leaves the block off.
 */
export const REPLIES_INSTRUCTION = [
    "## Suggested replies",
    "End every answer with a fenced block of 2–4 short replies the person could tap instead of typing. Put the most useful next step FIRST — the one you would recommend — then alternatives:",
    "```" + REPLIES_FENCE,
    '["Yes, do it", "Show me first", "Not now"]',
    "```",
    'Rules: write them in the person\'s language, in their voice (what THEY would say, not what you would). Each under 40 characters. Each must make sense sent on its own. Never repeat what they already said. When your answer ends on a question to them, the replies are short answers to that question ("About two weeks", "After a fall"), never your own question repeated and not next steps. Put the block last, after everything else. Do not write any heading or label before it (no Quick replies, Follow-up questions or the like, in any language): the replies are drawn as buttons. Leave it out only when the conversation is over (a goodbye, a thanks with nothing left to do).',
].join("\n");
const COMPLETE = new RegExp("\\n?```" + REPLIES_FENCE + "\\s*([\\s\\S]*?)```", "i");
// A complete JSON array of short strings as the answer's last paragraph, with
// no fence around it: `["Yes, do it", "Show me first"]` on its own line.
const BARE_TAIL = /\n\s*(\[\s*"[^"\n]{1,60}"(?:\s*,\s*"[^"\n]{1,60}"){0,5}\s*\])\s*$/;
// Still streaming: the fence has opened (or is opening) and not yet closed.
const OPEN_TAIL = new RegExp("\\n?```(?:" + REPLIES_FENCE + "[\\s\\S]*|q[a-z_]*)?$", "i");
// A label the model writes over its replies: "**Quick follow-up options**",
// "### Suggested replies", "_Mögliche Rückfragen:_", "Быстрые ответы:".
// Decided by SHAPE and POSITION, never by a word list, so it holds in every
// language: the last block before the replies, at most six words, and no
// sentence punctuation but a closing colon. A sentence — "**China holds
// 99 %.**", or anything longer — is part of the answer and stays.
const HEADING = /^#{1,6}\s+(.*?)(?:\s+#+)?$/;
const EMPHASIS = /^(\*\*\*|\*\*|\*|___|__|_)(?!\s)(.+?)(?<!\s)\1(:?)$/;
const RULE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const MAX_LABEL_WORDS = 6;
function isLabelText(inner) {
    const words = inner.replace(/[*_]+/g, "").replace(/:\s*$/, "").trim();
    if (!words || /[.!?…;。！？]/.test(words) || words.includes(":"))
        return false;
    return words.split(/\s+/).length <= MAX_LABEL_WORDS;
}
function labelKind(line) {
    const t = line.trim();
    if (RULE.test(t))
        return "rule";
    const heading = HEADING.exec(t);
    if (heading)
        return isLabelText(heading[1] ?? "") ? "heading" : null;
    const emphasis = EMPHASIS.exec(t);
    if (emphasis)
        return isLabelText(emphasis[2] ?? "") ? "label" : null;
    // A plain line that only introduces what follows: "Mögliche Rückfragen:".
    if (t.endsWith(":") && !/^[-*+>|`]|^\d+[.)]/.test(t))
        return isLabelText(t) ? "label" : null;
    return null;
}
/**
 * Drop a heading, a bold or italic label, or a horizontal rule that sits
 * directly above the replies. The reply buttons are their own label; a
 * heading over them is the model narrating the interface, and in front of
 * the buttons it reads as an empty section. Safe on any text: a real
 * paragraph is never touched, and a label line that ends a paragraph
 * (no blank line above it) belongs to that paragraph and stays.
 */
export function dropReplyLabel(text) {
    const lines = text.trimEnd().split("\n");
    let droppedLabel = false;
    for (let guard = 0; guard < 4 && lines.length > 0; guard++) {
        const i = lines.length - 1;
        const kind = labelKind(lines[i] ?? "");
        if (!kind)
            break;
        const alone = i === 0 || (lines[i - 1] ?? "").trim() === "";
        if (kind === "label" && !alone)
            break;
        if (kind !== "rule") {
            if (droppedLabel)
                break;
            droppedLabel = true;
        }
        lines.pop();
        while (lines.length > 0 && (lines[lines.length - 1] ?? "").trim() === "")
            lines.pop();
    }
    return lines.join("\n");
}
// While streaming: could this last line still become a label? Starts like a
// heading, an emphasis run or a rule, and is short enough to be one.
function mayBecomeLabel(line) {
    const t = line.trim();
    if (/^[-*_]{1,3}$/.test(t))
        return true;
    if (!/^(?:#{1,6}(?:\s|$)|\*{1,3}(?!\s)|_{1,3}(?!\s))/.test(t))
        return false;
    return isLabelText(t.replace(/^#+\s*/, "")) || labelKind(t) !== null;
}
function holdBack(text) {
    let rest = text.replace(/\n?```\s*$/, "").trimEnd();
    rest = dropReplyLabel(rest);
    const lines = rest.split("\n");
    const last = lines[lines.length - 1] ?? "";
    const alone = lines.length === 1 || (lines[lines.length - 2] ?? "").trim() === "";
    if (alone && mayBecomeLabel(last)) {
        lines.pop();
        return lines.join("\n").trimEnd();
    }
    return rest;
}
function clean(raw, { max = 4, maxLength = 48 }) {
    let parsed;
    try {
        parsed = JSON.parse(raw.trim());
    }
    catch {
        // A model sometimes writes one reply per line instead of a JSON array.
        parsed = raw
            .split(/\r?\n/)
            .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^["']|["'],?$/g, ""));
    }
    if (!Array.isArray(parsed))
        return [];
    const seen = new Set();
    const out = [];
    for (const item of parsed) {
        if (typeof item !== "string")
            continue;
        const reply = item.trim();
        const key = reply.toLowerCase();
        if (!reply || reply.length > maxLength || seen.has(key))
            continue;
        seen.add(key);
        out.push(reply);
        if (out.length >= max)
            break;
    }
    return out;
}
/**
 * Split an answer into the text to show and its suggested replies. Safe on a
 * partial, streaming answer: an unfinished block is hidden, never shown.
 * Text with no block comes back unchanged with `replies: []`.
 */
export function extractReplies(text, options = {}) {
    const match = COMPLETE.exec(text);
    if (match) {
        const replies = clean(match[1] ?? "", options);
        const before = text.slice(0, match.index);
        const after = text.slice(match.index + match[0].length);
        const rest = ((replies.length > 0 ? dropReplyLabel(before) : before) + after).trimEnd();
        return { text: rest, replies };
    }
    // A model that forgets the fence and ends on the bare JSON array instead
    // (seen on Causius's answers in OrangeCat's companions home, 2026-10-30):
    // the array is the replies all the same, never text to show.
    const bare = BARE_TAIL.exec(text);
    if (bare && !options.streaming) {
        const replies = clean(bare[1] ?? "", options);
        if (replies.length > 0) {
            return { text: dropReplyLabel(text.slice(0, bare.index)).trimEnd(), replies };
        }
    }
    const tail = OPEN_TAIL.exec(text);
    // A bare ``` at the end may be the start of an ordinary code block; only
    // hide it while it could still become ours.
    if (tail && tail[0].trim() !== "```") {
        return { text: dropReplyLabel(text.slice(0, tail.index)), replies: [] };
    }
    if (options.streaming)
        return { text: holdBack(text), replies: [] };
    return { text, replies: [] };
}
//# sourceMappingURL=replies.js.map