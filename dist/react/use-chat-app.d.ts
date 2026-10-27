import type { Attachment } from "../attachments.js";
import { type ConversationStore, type ConversationSummary } from "../conversations.js";
import type { ChatFailure, ChatMessageData, LiveTurn, MessageChip } from "./Thread.js";
/** One turn, as ChatApp hands it to the product. */
export type ChatTurn = {
    /** The stored conversation, or null in a temporary chat (nothing is kept). */
    conversationId: string | null;
    /** This chat's id on the page: the stored id, or — in a temporary chat — a
     *  page-only id, the one `onTemporaryEnd` names when the chat ends. A
     *  product that keeps a hidden server row for a temporary chat keys it here. */
    chatId: string;
    temporary: boolean;
    /** What the person wrote (or the composer's attachment-only words). */
    text: string;
    attachments: Attachment[];
    /** The conversation BEFORE this message, failed turns left out. */
    history: ChatMessageData[];
    /** Aborted by Stop, by deleting the chat, or when a temporary chat is left. */
    signal: AbortSignal;
    /** What has arrived so far — the WHOLE text each time, a status line before
     *  the first word, the steps taken. Call it as often as you like. */
    update: (live: LiveTurn) => void;
    /** Whether Stop keeps what has arrived for THIS turn, overriding ChatApp's
     *  `stopKeepsPartial` — `false` while the text so far is unchecked (Heidi's
     *  variety gate), `true` once it is. Call it any time before the turn ends. */
    stopKeepsPartial: (keep: boolean) => void;
};
/**
 * Throw this from a transport to say why a turn failed in the reader's
 * words: the failed bubble shows `message`, and `kind` (the product's own
 * code, e.g. "quota" or "no-vision") travels with that message as
 * `failure.kind` for a footer to link the fix. Any other error shows the
 * thread's `failed` label — a raw `TypeError: Failed to fetch` is never
 * shown to a reader — unless ChatApp's `failureMessage` maps it.
 */
export declare class ChatTurnError extends Error {
    readonly kind?: string;
    constructor(message: string, options?: {
        kind?: string;
        cause?: unknown;
    });
}
/**
 * What a failed turn keeps: a `ChatTurnError`'s words and kind, a plain
 * `{ message, kind }` object as thrown, or what `map` makes of anything
 * else. Never an ordinary Error's message — that is for the console.
 */
export declare function chatTurnFailure(error: unknown, map?: (error: unknown) => string | null | undefined): ChatFailure;
/** How a page sends for the person (`ChatAppHandle.send`). */
export type SendOptions = {
    /** Start a new chat for it instead of adding to the open one. */
    newChat?: boolean;
    /** The product's own things shown on the person's message (see `MessageChip`). */
    chips?: readonly MessageChip[];
};
/** The answer: its words, or the whole message (replies, citations, thinking…). */
export type ChatTurnResult = string | (Omit<ChatMessageData, "id" | "role"> & {
    content: string;
});
/**
 * The product's one job: send a turn and resolve with the answer. Throw to
 * show a failed turn with Retry. Streaming is `turn.update`.
 */
export type ChatTransport = (turn: ChatTurn) => Promise<ChatTurnResult>;
export type ChatAppProblem = "load" | "save" | "open";
type Queued = {
    id: string;
    conversation: string;
    text: string;
    attachments: Attachment[];
    chips?: readonly MessageChip[];
};
export declare const isTemporaryId: (id: string | null | undefined) => boolean;
export type UseChatAppOptions = {
    store: ConversationStore;
    transport: ChatTransport;
    makeTitle?: (first: {
        text: string;
        answer: string;
    }) => string | null | Promise<string | null>;
    conversationId?: string | null;
    onConversationChange?: (id: string | null) => void;
    rememberKey: string | null;
    /** Stop keeps the half answer that had arrived. Default true. */
    stopKeepsPartial?: boolean;
    /** The words for a failed turn whose error is not a `ChatTurnError`. */
    failureMessage?: (error: unknown) => string | null | undefined;
    /** A temporary chat ended: left for a new or another chat, the page hidden
     *  or ChatApp unmounted. Called once per chat, with `turn.chatId`. */
    onTemporaryEnd?: (chatId: string) => void;
    /** Reopen the chat from before the reload. False when the page arrives
     *  with a message to send (it starts a new chat). Default true. */
    restore?: boolean;
};
/**
 * Everything ChatApp does that is not drawing: the list, the open chat, new
 * and temporary chats, turns (one per conversation, each running on when the
 * person opens another chat), the queue, titles and the reopen-on-reload.
 */
export declare function useChatApp({ store, transport, makeTitle, conversationId, onConversationChange, rememberKey, stopKeepsPartial, failureMessage, onTemporaryEnd, restore, }: UseChatAppOptions): {
    list: ConversationSummary[];
    listState: "error" | "loading" | "ready";
    /** The list has loaded (or failed) and the reopened chat is chosen. */
    ready: boolean;
    whenReady: () => Promise<void>;
    reloadList: () => void;
    activeId: string | null;
    stored: string | null;
    temporary: boolean;
    messages: ChatMessageData[];
    loading: boolean;
    live: LiveTurn;
    busy: boolean;
    busyIds: Set<string>;
    stopped: boolean;
    queued: Queued[];
    unqueue: (qid: string) => void;
    problem: ChatAppProblem | null;
    clearProblem: () => void;
    send: (text: string, attachments?: Attachment[], options?: SendOptions) => Promise<boolean>;
    stop: () => void;
    retry: () => void;
    open: (id: string) => void;
    newChat: () => void;
    toggleTemporary: () => void;
    rename: (id: string, title: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
};
export type ChatAppController = ReturnType<typeof useChatApp>;
export {};
//# sourceMappingURL=use-chat-app.d.ts.map