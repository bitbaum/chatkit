import { type ReactNode } from "react";
import type { ConversationStore, ConversationSummary } from "../conversations.js";
import type { Speaker } from "../speech.js";
import type { AnswerFeedback } from "../review.js";
import { type ChatMessageData, type Starter, type ThreadLabels } from "./Thread.js";
import { type ComposerProps } from "./Composer.js";
import type { RenderLink } from "./Markdown.js";
import type { RichRenderers } from "./renderers.js";
import { type ChatAppProblem, type ChatTransport } from "./use-chat-app.js";
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
    composer?: Partial<Omit<ComposerProps, "onSend" | "sending" | "onStop" | "queue">>;
    /** Thread options, passed to ChatThread. */
    thread?: {
        renderLink?: RenderLink;
        renderFooter?: (m: ChatMessageData) => ReactNode;
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
};
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
export declare function ChatApp({ transport, store: givenStore, placeholder, name, makeTitle, starters, startersTitle, empty, composer, thread, footnote, fill, temporaryChats, onShare, conversationId, onConversationChange, rememberKey, search, headerStart, headerEnd, locale, railQuery, labels: labelOverrides, className, }: ChatAppProps): import("react").JSX.Element;
//# sourceMappingURL=ChatApp.d.ts.map