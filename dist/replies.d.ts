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
export declare const REPLIES_FENCE = "quick_replies";
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
export declare const REPLIES_INSTRUCTION: string;
/**
 * Split an answer into the text to show and its suggested replies. Safe on a
 * partial, streaming answer: an unfinished block is hidden, never shown.
 * Text with no block comes back unchanged with `replies: []`.
 */
export declare function extractReplies(text: string, options?: RepliesOptions): {
    text: string;
    replies: string[];
};
//# sourceMappingURL=replies.d.ts.map