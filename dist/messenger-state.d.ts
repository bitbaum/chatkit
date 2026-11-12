/**
 * The Messenger's state, as one pure function.
 *
 * Everything that can happen to a messenger — a list loads, a conversation is
 * opened, a message is sent, fails, arrives from elsewhere, is read — is an
 * action, and what the screen shows after it is `messengerReducer(state,
 * action)`. No timers, no network, no DOM: the hook (`useMessenger`) does
 * those and only reports what happened. So "a message that arrives twice is
 * shown once" and "opening a conversation clears its badge" are tests that
 * run in Node, not hopes about an effect order.
 */
import { type MessengerAgent, type MessengerConversation, type MessengerMessage } from "./messenger.js";
export type MessengerThreadState = {
    status: "loading" | "ready" | "failed";
    /** Oldest first. */
    messages: MessengerMessage[];
    /** The cursor for the page before the oldest shown; `null` when there is none. */
    before: string | null;
    loadingOlder: boolean;
    olderFailed: boolean;
    /**
     * The viewer's read mark when the thread was opened: where the "New" line
     * is drawn. Fixed for as long as the thread stays open, so the line does
     * not vanish the moment its messages are read.
     */
    unreadFrom: Date | null;
};
/** An agent somebody just called on: answering, or silent past its patience. */
export type MessengerAwaited = {
    agentId: string;
    state: "thinking" | "quiet";
};
export type MessengerState = {
    viewerId: string;
    status: "loading" | "ready" | "failed";
    conversations: MessengerConversation[];
    openId: string | null;
    threads: Record<string, MessengerThreadState>;
    /** Who is typing, per conversation (never the viewer). */
    typing: Record<string, string[]>;
    awaited: Record<string, MessengerAwaited[]>;
    connection: "online" | "reconnecting" | "offline";
};
export type MessengerAction = {
    type: "list-loading";
} | {
    type: "list-loaded";
    conversations: MessengerConversation[];
} | {
    type: "list-failed";
} | {
    type: "open";
    id: string | null;
} | {
    type: "thread-loading";
    id: string;
} | {
    type: "thread-loaded";
    id: string;
    messages: MessengerMessage[];
    before: string | null;
} | {
    type: "thread-failed";
    id: string;
} | {
    type: "older-loading";
    id: string;
} | {
    type: "older-loaded";
    id: string;
    messages: MessengerMessage[];
    before: string | null;
} | {
    type: "older-failed";
    id: string;
}
/**
 * A message exists: just written by the viewer (with `delivery: "sending"`),
 * stored by the server, or arrived from elsewhere. `seen` says whether the
 * viewer is looking at it now.
 */
 | {
    type: "message";
    message: MessengerMessage;
    seen: boolean;
    agents?: readonly MessengerAgent[];
} | {
    type: "send-failed";
    conversationId: string;
    clientId: string;
} | {
    type: "message-removed";
    conversationId: string;
    messageId: string;
} | {
    type: "read";
    conversationId: string;
    actorId: string;
    at: Date;
} | {
    type: "typing";
    conversationId: string;
    actorId: string;
    typing: boolean;
} | {
    type: "presence";
    actorId: string;
    online: boolean;
} | {
    type: "conversation";
    conversation: MessengerConversation;
} | {
    type: "conversation-removed";
    conversationId: string;
} | {
    type: "agent-quiet";
    conversationId: string;
    agentId: string;
} | {
    type: "agent-dismissed";
    conversationId: string;
    agentId: string;
} | {
    type: "connection";
    state: MessengerState["connection"];
};
export declare function initialMessengerState(viewerId: string): MessengerState;
export declare function messengerReducer(state: MessengerState, action: MessengerAction): MessengerState;
/** The newest message in a thread that somebody else wrote, if any. */
export declare function newestFromOthers(messages: readonly MessengerMessage[], viewerId: string): MessengerMessage | undefined;
/**
 * Should the viewer's read mark move? Only forward, and only to a message
 * somebody else wrote: reading your own message is not news to anybody.
 */
export declare function readMarkToSend(conversation: MessengerConversation | undefined, messages: readonly MessengerMessage[], viewerId: string): Date | null;
//# sourceMappingURL=messenger-state.d.ts.map