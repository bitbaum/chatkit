import { type ReactNode } from "react";
import type { Attachment } from "../attachments.js";
import type { ConversationStore, ConversationSummary } from "../conversations.js";
import type { Speaker } from "../speech.js";
import type { AnswerFeedback } from "../review.js";
import { type ChatMessageData, type FooterInfo, type MessageChip, type Starter, type ThreadLabels } from "./Thread.js";
import { type ComposerProps } from "./Composer.js";
import type { RenderLink } from "./Markdown.js";
import type { RichRenderers } from "./renderers.js";
import { type ChatAppProblem, type ChatTransport, type SendOptions } from "./use-chat-app.js";
export type ChatAppLabels = {
    chats: string;
    openChats: string;
    closeChats: string;
    newChat: string;
    /** The title of a chat nobody has named and that has no words yet. */
    untitled: string;
    more: string;
    temporary: string;
    /** Under the title while a chat is temporary. */
    temporaryNote: string;
    share: string;
    rename: string;
    renameField: string;
    delete: string;
    deleteAsk: (title: string) => string;
    save: string;
    cancel: string;
    search: string;
    today: string;
    yesterday: string;
    earlier: string;
    noChats: string;
    noMatch: (query: string) => string;
    loadingChats: string;
    listFailed: string;
    tryAgain: string;
    answering: string;
    chatActions: (title: string) => string;
    queued: string;
    unqueue: (text: string) => string;
    dismiss: string;
    problems: Record<ChatAppProblem, string>;
};
export declare const DEFAULT_CHAT_APP_LABELS: ChatAppLabels;
/**
 * What a page can do to the chat it holds (`<ChatApp ref={chat}>`): send for
 * the person ("Check this", `/chat?q=`, a message handed over from a home
 * box), put words in the box for them to finish, and move between chats.
 */
export type ChatAppHandle = {
    /**
     * Send now, exactly as if typed and sent: queued behind a running answer,
     * a new chat created when none is open (or always, with `newChat`). Files
     * are read like the paperclip's (limits, shrinking); if one cannot be
     * attached, nothing is sent — the words and files go into the box with the
     * reason, for the person to decide. Resolves whether it was sent.
     */
    send: (text: string, attachments?: readonly (Attachment | File)[], options?: SendOptions) => Promise<boolean>;
    /** Put words (and files) in the box and the cursor after them; nothing is sent. */
    fill: (text: string, files?: readonly File[]) => void;
    focus: () => void;
    newChat: () => void;
    openConversation: (id: string) => void;
};
/** A message the page arrives with (see `initialMessage`). */
export type InitialMessage = {
    text: string;
    /** Pictures and files with it: `File`s as picked, or wire attachments. */
    attachments?: readonly (Attachment | File)[];
    chips?: readonly MessageChip[];
    /** Send it (the default), or only put it in the box (`false`). */
    send?: boolean;
};
/** What `thread.renderFooter` gets beside the message. */
export type ChatAppFooterInfo = FooterInfo & {
    /** Send for the person — a chip whose label differs from what it says. */
    send: (text: string, options?: SendOptions) => void;
    /** Put words in the box for the person to finish. */
    fill: (text: string) => void;
};
export type ChatAppProps = {
    /** Send a turn and resolve with the answer (stream through `turn.update`). */
    transport: ChatTransport;
    /** Where chats live. Default: on this device (`localConversationStore`). */
    store?: ConversationStore;
    /** The composer's placeholder. */
    placeholder?: string;
    /** Over a new chat, where a chat's title goes (the product's name). */
    name?: string;
    /** Name a chat after its first answer. Without it, the first message names it. */
    makeTitle?: (first: {
        text: string;
        answer: string;
    }) => string | null | Promise<string | null>;
    /** Starters on an empty chat; or your own `empty`. */
    starters?: readonly Starter[];
    startersTitle?: ReactNode;
    empty?: ReactNode;
    /** Composer options: `voice` (give it `transcribeUrl`), `attach` (on by
     *  default; `false` only when the product's API takes no files), `tools`,
     *  `labels`… Sending, Stop and the queue are ChatApp's. */
    composer?: Partial<Omit<ComposerProps, "onSend" | "sending" | "onStop" | "queue" | "handleRef">>;
    /** Thread options, passed to ChatThread. */
    thread?: {
        renderLink?: RenderLink;
        renderFooter?: (m: ChatMessageData, info: ChatAppFooterInfo) => ReactNode;
        /** After the last turn, inside the thread (a pending action, a picker). */
        after?: ReactNode;
        renderers?: RichRenderers;
        speaker?: Speaker | null;
        share?: {
            title?: string;
            url?: string;
        } | false;
        onFeedback?: (feedback: AnswerFeedback & {
            conversationId: string | null;
        }) => void;
        labels?: Partial<ThreadLabels>;
    };
    /** One quiet line under the composer. */
    footnote?: ReactNode;
    /** "viewport" (default) follows the visual viewport, above the phone keyboard. */
    fill?: "viewport" | "parent";
    /** Offer Temporary chat. Default true. */
    temporaryChats?: boolean;
    /** Offer "Share this chat" in the header's menu. */
    onShare?: (chat: {
        id: string;
        title: string;
        messages: ChatMessageData[];
    }) => void;
    /** The open chat, when the product keeps it in its URL; `null` = a new chat. */
    conversationId?: string | null;
    onConversationChange?: (id: string | null) => void;
    /** Device key that remembers the open chat across a reload; `null` = never. */
    rememberKey?: string | null;
    /** Your own list search (e.g. `@bitbaum/searchkit`); default: every word in the title. */
    search?: (list: ConversationSummary[], query: string) => ConversationSummary[];
    /** Product controls in the header: before the title, and before New chat. */
    headerStart?: ReactNode;
    headerEnd?: ReactNode;
    /** Dates in the list. Default: the browser's. */
    locale?: string;
    /** When the chat list stops being a drawer and stays open beside the chat. */
    railQuery?: string;
    labels?: Partial<ChatAppLabels>;
    className?: string;
    /** A message to start with, in a NEW chat, once the list has loaded — the
     *  home box handing its words and pictures to `/chat`. Used once per mount
     *  (StrictMode's double mount included); clear it from your URL or state
     *  yourself so a reload does not send it again. */
    initialMessage?: InitialMessage | null;
    /** Read this query parameter (e.g. `"q"`) into a new chat's box, then take
     *  it off the address. The words are only put in the box: a link can never
     *  send for someone unless `deepLinkAutoSend` is set too. */
    deepLinkParam?: string;
    /** Send the `deepLinkParam` words instead of filling the box. Off by default. */
    deepLinkAutoSend?: boolean;
    /** Stop keeps the half answer that had arrived. Default true; a transport
     *  can decide per turn with `turn.stopKeepsPartial(keep)`. */
    stopKeepsPartial?: boolean;
    /** The words for a failed turn whose error is not a `ChatTurnError`
     *  (return null for the thread's `failed` label). */
    failureMessage?: (error: unknown) => string | null | undefined;
    /** A temporary chat ended (left, page hidden, unmounted): delete what the
     *  server kept for it. Gets `turn.chatId`; called once per chat. */
    onTemporaryEnd?: (chatId: string) => void;
    /** The product's things shown on the person's message when it is sent
     *  from the box (the ones staged with `heldAttachments`). */
    chipsFor?: (turn: {
        text: string;
        attachments: Attachment[];
    }) => readonly MessageChip[] | null | undefined;
    /** In the chat list, under the search box: the product's own line. */
    historySlot?: ReactNode;
    /** In the chat list, instead of "No chats yet…" when there are none. */
    historyEmpty?: ReactNode;
};
/** The words a `?q=`-style link carries, and the address without them. Pure. */
export declare function takeDeepLink(href: string, param: string): {
    text: string;
    href: string;
} | null;
/**
 * The whole chat app, the way the Claude, ChatGPT and Grok phone apps are
 * laid out: the conversation edge to edge, a frosted header (Chats · title ·
 * New chat · More), the chat list in a drawer on a phone and a rail beside
 * the chat from a wide screen, and the composer floating at the bottom with
 * the microphone, Camera · Photos · Files and the queue.
 *
 * A product gives it two things — a `transport` that answers a turn, and a
 * `store` that keeps chats (or nothing: the device then keeps them) — plus
 * its words. Everything a person sees and does is the same in every product.
 */
export declare const ChatApp: import("react").ForwardRefExoticComponent<ChatAppProps & import("react").RefAttributes<ChatAppHandle>>;
//# sourceMappingURL=ChatApp.d.ts.map