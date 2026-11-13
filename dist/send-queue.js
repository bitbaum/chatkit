/**
 * Messages typed while an answer ran, waiting their turn: the rules.
 *
 * A chat that refuses the next thought until a spinner stops makes the person
 * wait on the machine, so the next message is taken at once and sent when the
 * turn lands. Three things went wrong with hand-rolled copies of that, all
 * measured on Loki's own chat on 2026-11-13:
 *
 *  - A queued message was sent by a closure that still saw "no conversation"
 *    and opened a second one: three quick messages became three
 *    conversations. So a queued message BELONGS TO A CONVERSATION, and the
 *    next one is taken for the conversation whose turn just landed.
 *  - A reload threw the queue away, after the person had been told the words
 *    would be sent. So the queue can be written down and read back.
 *  - A turn dies with its connection. A reload mid-answer left the question
 *    in the thread with nothing under it, no answer ever and no way to ask
 *    again. So a thread can be asked whether its last message is the
 *    person's with nothing answering it (`unansweredTurn`), to say so and
 *    offer Try again.
 *
 * Pure: no storage, no clock, no React. `useChatApp` uses these; an app with
 * its own chat state uses them directly.
 */
/** The oldest message waiting in `conversationId`, and the queue without it. */
export function takeQueuedFor(queue, conversationId) {
    const next = queue.find((q) => q.conversationId === conversationId) ?? null;
    return { next, rest: next ? queue.filter((q) => q.id !== next.id) : [...queue] };
}
/** The messages waiting in one conversation, oldest first. */
export function queuedFor(queue, conversationId) {
    return conversationId ? queue.filter((q) => q.conversationId === conversationId) : [];
}
/**
 * What may be written down so a reload keeps it: everything but a message
 * that carries files, because the files do not survive a reload either.
 */
export function storableQueue(queue) {
    return queue.filter((q) => {
        const files = q.attachments;
        return !Array.isArray(files) || files.length === 0;
    });
}
/** `JSON.stringify(storableQueue(queue))`: the text to keep. */
export function serializeQueue(queue) {
    return JSON.stringify(storableQueue(queue));
}
/**
 * A stored queue read back. Anything that is not a list of messages with an
 * id, a conversation and text is dropped, never thrown on: a damaged store
 * costs the queue, not the chat.
 */
export function parseStoredQueue(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter((q) => {
            if (!q || typeof q !== "object")
                return false;
            const row = q;
            return ((typeof row.id === "string" || typeof row.id === "number") &&
                typeof row.conversationId === "string" &&
                row.conversationId !== "" &&
                typeof row.text === "string");
        });
    }
    catch {
        return [];
    }
}
/**
 * The person's question that nothing is answering, or null.
 *
 * True only when the thread is idle: nothing sending, nothing loading,
 * nothing queued to go first. An optimistic bubble on its way is not a lost
 * question, and neither is a failed one (it already says so).
 */
export function unansweredTurn(messages, state) {
    if (state.sending || state.loading || (state.queued ?? 0) > 0)
        return null;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user" || last.pending || last.failed)
        return null;
    const text = last.content.trim();
    return text ? { id: last.id, text } : null;
}
//# sourceMappingURL=send-queue.js.map