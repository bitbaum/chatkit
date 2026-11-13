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
/** A message waiting in a conversation. `id` is unique within the queue. */
export type QueuedSend<T extends object = object> = T & {
    id: string | number;
    conversationId: string;
};
/** The oldest message waiting in `conversationId`, and the queue without it. */
export declare function takeQueuedFor<Q extends {
    id: string | number;
    conversationId: string;
}>(queue: readonly Q[], conversationId: string): {
    next: Q | null;
    rest: Q[];
};
/** The messages waiting in one conversation, oldest first. */
export declare function queuedFor<Q extends {
    conversationId: string;
}>(queue: readonly Q[], conversationId: string | null | undefined): Q[];
/**
 * What may be written down so a reload keeps it: everything but a message
 * that carries files, because the files do not survive a reload either.
 */
export declare function storableQueue<Q extends object>(queue: readonly Q[]): Q[];
/** `JSON.stringify(storableQueue(queue))`: the text to keep. */
export declare function serializeQueue<Q extends object>(queue: readonly Q[]): string;
/**
 * A stored queue read back. Anything that is not a list of messages with an
 * id, a conversation and text is dropped, never thrown on: a damaged store
 * costs the queue, not the chat.
 */
export declare function parseStoredQueue<T extends {
    text: string;
}>(raw: string | null | undefined): QueuedSend<T>[];
/** The least a thread message needs for `unansweredTurn`. */
export interface TurnMessageLike {
    id: string;
    role: string;
    content: string;
    /** An optimistic bubble whose send is still in flight. */
    pending?: boolean;
    /** A message whose send failed: it has its own Try again. */
    failed?: boolean;
}
/**
 * The person's question that nothing is answering, or null.
 *
 * True only when the thread is idle: nothing sending, nothing loading,
 * nothing queued to go first. An optimistic bubble on its way is not a lost
 * question, and neither is a failed one (it already says so).
 */
export declare function unansweredTurn(messages: readonly TurnMessageLike[], state: {
    sending: boolean;
    loading?: boolean;
    queued?: number;
}): {
    id: string;
    text: string;
} | null;
//# sourceMappingURL=send-queue.d.ts.map