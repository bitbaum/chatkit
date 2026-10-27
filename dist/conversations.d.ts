/**
 * Conversations: the list a chat app keeps, and the decisions about it that
 * every product used to make on its own — what a chat is called, how the
 * list is grouped and searched, which chat a reload reopens. Pure, so each
 * rule is tested without a DOM. `ChatApp` (`@bitbaum/chatkit/react`) is the
 * screen built on them; `stores.ts` holds where they are kept.
 */
/** One row of the chat list. `updatedAt` is an ISO date (or ms since epoch). */
export type ConversationSummary = {
    id: string;
    title: string;
    updatedAt: string | number;
};
/** A file that went with a message, as the thread shows it afterwards. */
export type MessageAttachment = {
    kind: "image" | "text";
    name: string;
    /** A picture to draw (a data: or blob: URL). Not kept by the device store. */
    previewUrl?: string;
};
/**
 * A message as a store keeps it. Structurally the thread's `ChatMessageData`:
 * whatever else a product puts on a message (citations, thinking, a speaker)
 * travels through untouched.
 */
export type StoredMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    attachments?: readonly MessageAttachment[];
    [field: string]: unknown;
};
export type Conversation = ConversationSummary & {
    messages: StoredMessage[];
};
/**
 * Where conversations live. The app picks: `localConversationStore` keeps them
 * on the device (signed out), `httpConversationStore` on the product's server
 * (signed in), or the product writes its own — six methods.
 */
export interface ConversationStore {
    /** Every conversation, newest first. */
    list(): Promise<ConversationSummary[]>;
    /** One conversation with its messages, or null when it is gone. */
    get(id: string): Promise<Conversation | null>;
    create(init?: {
        title?: string;
    }): Promise<ConversationSummary>;
    append(id: string, message: StoredMessage): Promise<void>;
    rename(id: string, title: string): Promise<void>;
    remove(id: string): Promise<void>;
}
/** An id that is unique enough for a client-made message or conversation,
 *  also where `crypto.randomUUID` is missing (plain http, old WebViews). */
export declare function newId(prefix?: string): string;
/** The longest title derived from a message, in characters. */
export declare const TITLE_MAX = 48;
/**
 * What a chat is called before anyone names it: the first thing the person
 * said, as one line, without the markdown, cut at a word with an ellipsis.
 * `null` when there are no words (a message of only an attachment) — the
 * list then shows its "New chat" label rather than an empty row. The rule
 * is Heidi's `lib/domain/chat/title.ts`, (heidi repo), now the package's.
 */
export declare function deriveTitle(text: string, max?: number): string | null;
/** Newest first; a row with an unreadable date sinks to the bottom. */
export declare function sortConversations<T extends ConversationSummary>(list: readonly T[]): T[];
export type ConversationGroupKey = "today" | "yesterday" | "earlier";
export type ConversationGroup<T extends ConversationSummary = ConversationSummary> = {
    key: ConversationGroupKey;
    items: T[];
};
/** Which heading a row sits under, by the reader's own calendar day. */
export declare function conversationGroupOf(at: string | number, now?: number): ConversationGroupKey;
/** The list under Today / Yesterday / Earlier, newest first, empty groups left out. */
export declare function groupConversations<T extends ConversationSummary>(list: readonly T[], now?: number): ConversationGroup<T>[];
/**
 * The search box over the list: every word typed must appear in the title,
 * case and accents ignored ("zurich" finds "Zürich"). Order is kept. A
 * product that ranks with `@bitbaum/searchkit` passes its own to `ChatApp`'s
 * `search` — chatkit itself takes no dependency.
 */
export declare function filterConversations<T extends ConversationSummary>(list: readonly T[], query: string): T[];
/**
 * The date on a row, the way the phone apps write it: the time today, the
 * weekday within the week, the date after that (with the year once it is not
 * this year's). In the reader's locale through `Intl`.
 */
export declare function formatConversationDate(at: string | number, now?: number, locale?: string): string;
/**
 * Which chat a reload opens: the one asked for (a link, the URL), else the
 * one that was open, but only while it still exists — a chat deleted on
 * another device opens a new chat, never an error page.
 */
export declare function pickRestored(list: readonly ConversationSummary[], wanted: string | null | undefined, remembered: string | null | undefined): string | null;
/** Copy every conversation from one store into another — the signed-out
 *  chats into the account when someone signs in. Returns how many moved. */
export declare function copyConversations(from: ConversationStore, to: ConversationStore): Promise<number>;
//# sourceMappingURL=conversations.d.ts.map