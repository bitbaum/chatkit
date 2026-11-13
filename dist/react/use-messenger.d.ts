import { type MessengerAgent, type MessengerAttachment, type MessengerCard, type MessengerConversation, type MessengerMessage, type MessengerQuote, type MessengerTransport } from "../messenger.js";
import { type MessengerState, type MessengerThreadState } from "../messenger-state.js";
export type UseMessengerOptions = {
    /** The id the viewer's own messages carry (`authorId`). */
    viewerId: string;
    transport: MessengerTransport;
    agents?: readonly MessengerAgent[];
    /**
     * The open conversation, when the app keeps it (in the URL, so a link and
     * the back button work). Leave it out and the Messenger keeps it itself.
     */
    conversationId?: string | null;
    onConversationChange?: (id: string | null) => void;
    /** How long an agent may take before the thread says it has not answered. */
    agentPatienceMs?: number;
};
export type MessengerController = {
    state: MessengerState;
    /** The open conversation, once the list (or a direct fetch) knows it. */
    open: MessengerConversation | null;
    thread: MessengerThreadState | null;
    select: (id: string | null) => void;
    reload: () => void;
    reloadThread: () => void;
    loadOlder: () => void;
    /** Send to the open conversation. Resolves once it is on its way: a message
     *  that then fails stays in the thread, marked, with its own Try again. */
    send: (body: string, attachments: readonly MessengerAttachment[], extra?: {
        replyTo?: MessengerQuote;
        card?: MessengerCard;
    }) => Promise<boolean>;
    /** Put the viewer's emoji on a message; the one they already have takes it
     *  off. Shown at once, taken back if the server refuses. */
    react: (message: MessengerMessage, emoji: string) => Promise<boolean>;
    retry: (message: MessengerMessage) => void;
    discard: (message: MessengerMessage) => void;
    edit: (message: MessengerMessage, body: string) => Promise<boolean>;
    remove: (message: MessengerMessage) => Promise<boolean>;
    /** The viewer typed something (throttled here). */
    typed: () => void;
    /** The viewer is looking at the newest message: move their read mark. */
    seen: () => void;
    /** Whether the thread is at its end, so an arriving message is seen at once. */
    setFollowing: (following: boolean) => void;
    start: (personIds: readonly string[]) => Promise<boolean>;
    leave: (conversationId: string) => Promise<boolean>;
    dismissAgent: (agentId: string) => void;
};
/**
 * The Messenger's behaviour, without its markup: what is loaded when, what an
 * arriving message does, when the read mark moves, how a failed send is kept.
 * `Messenger` is this plus the screen; an app with its own screen uses this
 * and the pieces (`ConversationList`, `MessageThread`).
 */
export declare function useMessenger(options: UseMessengerOptions): MessengerController;
//# sourceMappingURL=use-messenger.d.ts.map