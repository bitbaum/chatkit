import type { Attachment } from "../attachments.js";
import { type ConversationStore, type ConversationSummary } from "../conversations.js";
import type { ChatMessageData, LiveTurn } from "./Thread.js";
/** One turn, as ChatApp hands it to the product. */
export type ChatTurn = {
    /** The stored conversation, or null in a temporary chat (nothing is kept). */
    conversationId: string | null;
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
};
/**
 * Everything ChatApp does that is not drawing: the list, the open chat, new
 * and temporary chats, turns (one per conversation, each running on when the
 * person opens another chat), the queue, titles and the reopen-on-reload.
 */
export declare function useChatApp({ store, transport, makeTitle, conversationId, onConversationChange, rememberKey, }: UseChatAppOptions): {
    list: ConversationSummary[];
    listState: "error" | "loading" | "ready";
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
    send: (text: string, attachments?: Attachment[]) => Promise<boolean>;
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