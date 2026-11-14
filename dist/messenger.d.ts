/**
 * Messenger: people talking to people, and to the agents among them.
 *
 * `ChatApp` is one person and a model. This is the other chat every product
 * ends up needing: a list of conversations, a thread between several people,
 * a box to write in, photos and files — and, since an agent is a member of a
 * conversation and not a feature of it, a thread where it is always plain
 * who is a person and who is not.
 *
 * This file is the framework-free half: the shapes an app's backend speaks
 * (`MessengerTransport`) and every decision about a thread that can be made
 * without a DOM — what is grouped, where a day begins, what a row of the list
 * says, what a link is. The rules about who may read, what is unread and what
 * may be attached are `@bitbaum/threadkit`'s, used here and not restated. The
 * screen is `@bitbaum/chatkit/messenger`.
 */
import { type Message, type Participant, type Thread } from "@bitbaum/threadkit";
import { type AttachmentKind, type AttachmentRefusal, type ThreadAttachment } from "./thread-rules.js";
/** Somebody in a conversation, as the screen needs them: a threadkit
 *  participant (who may read and write, how far they have read) with a face. */
export type MessengerParticipant = Participant & {
    /** The name readers see. */
    name: string;
    /** Without the "@". Shown under the name where it helps tell people apart. */
    handle?: string;
    avatarUrl?: string | null;
    online?: boolean;
};
/** Somebody who can be written to, before there is a conversation with them. */
export type MessengerPerson = {
    id: string;
    name: string;
    handle?: string;
    avatarUrl?: string | null;
    kind?: "person" | "agent";
};
/**
 * A file on a message, with where the browser loads it from.
 *
 * `url` is whatever an `<img>`, `<video>` or `<audio>` may be pointed at for
 * THIS reader: a route of the app that checks the reader and redirects to
 * storage, or a signed link. The package never builds one and never keeps one
 * past the page.
 */
export type MessengerAttachment = ThreadAttachment & {
    url: string;
    /** A still for a video, so a thread never loads a film to draw a tile. */
    posterUrl?: string;
    /** Where "Download" goes, when it is not `url`. */
    downloadUrl?: string;
};
/** The message another one answers, as much of it as a bubble shows. */
export type MessengerQuote = {
    id: string;
    authorId: string;
    /** Its words, cut short by `quoteOf`. Empty for a message of only files. */
    body: string;
    attachments?: readonly AttachmentKind[];
};
/** One emoji on a message, and who put it there. */
export type MessengerReaction = {
    emoji: string;
    actorIds: readonly string[];
};
/**
 * Something of value in a conversation: money asked for, money sent, a gift,
 * an offer. The app decides what exists (`kind` is its word) and writes every
 * line FOR THIS READER; the package draws them all in one shape, so a request
 * in one product looks like a request in the next.
 */
export type MessengerCard = {
    kind: string;
    /** "Payment request". */
    title: string;
    /** "CHF 20.00", already formatted. */
    amount?: string;
    note?: string;
    /** "Waiting", "Paid", "Declined". */
    status?: string;
    tone?: "neutral" | "pending" | "positive" | "negative";
    /** What this reader can do about it: "Pay" and where. */
    action?: {
        label: string;
        href: string;
    };
    /** The app's own fields, carried to the server on a draft. Never drawn. */
    data?: Record<string, unknown>;
};
export type MessengerMessage = Message & {
    attachments?: readonly MessengerAttachment[];
    replyTo?: MessengerQuote | null;
    reactions?: readonly MessengerReaction[];
    card?: MessengerCard | null;
    editedAt?: Date | null;
    /** The person an agent answered for: their id. Drawn as "Cat · for Georgy". */
    onBehalfOf?: string;
    /** Set by the screen, never by a server: a message of the viewer's that is
     *  on its way, or did not arrive. */
    delivery?: "sending" | "failed";
};
/** What the list knows about a conversation's newest message. */
export type MessengerLast = {
    /** The words; for a card with none, its title and amount ("Payment request · CHF 20"). */
    body: string;
    authorId: string;
    createdAt: Date;
    /** The kinds of the files on it, so a message of only a photo reads "Photo". */
    attachments?: readonly AttachmentKind[];
};
/** A conversation: a threadkit thread (`subject` is its name, when it has
 *  one) with the faces of its participants and what the list shows. */
export type MessengerConversation = Omit<Thread, "participants"> & {
    participants: readonly MessengerParticipant[];
    last?: MessengerLast | null;
    /** Messages the viewer has not read. The list shows it; opening clears it. */
    unread?: number;
};
/**
 * An agent people can bring into a conversation by naming it.
 *
 * `id` is the actor id its messages carry, so they are marked as an agent's
 * even before its participant row says `kind: "ai"`.
 */
export type MessengerAgent = {
    id: string;
    name: string;
    /** What is typed to call it: "@cat". Matched as a whole word. */
    mention: string;
    avatarUrl?: string | null;
    /** One line under its name where it is offered ("Everyone here sees its answer"). */
    hint?: string;
};
/** What a person wrote, on its way to the server. */
export type MessengerDraft = {
    /** Echo it on the stored message (`clientId`), so the bubble drawn at once
     *  becomes the stored one and is never shown twice. */
    clientId: string;
    body: string;
    /** Already uploaded (`transport.upload`): the server links them by id. */
    attachments: readonly MessengerAttachment[];
    /** The message this one answers. The server stores its id and re-reads it. */
    replyTo?: MessengerQuote;
    card?: MessengerCard;
};
/** What the browser knows about a file before it is uploaded. */
export type MessengerUpload = {
    conversationId: string;
    kind: AttachmentKind;
    name: string;
    mimeType: string;
    bytes: number;
    width?: number;
    height?: number;
    durationMs?: number;
    /** A JPEG still of a video's first frame, when the browser could make one. */
    poster?: Blob;
};
/** Something that happened elsewhere. The app pushes these from whatever it
 *  has — a websocket, server-sent events, a poll. */
export type MessengerEvent = {
    type: "message";
    message: MessengerMessage;
} | {
    type: "message-removed";
    conversationId: string;
    messageId: string;
}
/** The reactions on a message, whole, after somebody changed one. */
 | {
    type: "reactions";
    conversationId: string;
    messageId: string;
    reactions: readonly MessengerReaction[];
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
}
/** Something changed and the app cannot say what: load the list again. */
 | {
    type: "refresh";
} | {
    type: "connection";
    state: "online" | "reconnecting" | "offline";
};
/**
 * The app's backend, as the Messenger speaks to it. Only the first three are
 * required; everything else switches a feature on by being there — no
 * `upload`, no paperclip; no `edit`, no Edit.
 *
 * A method that fails throws. What the person is told is the package's
 * (`labels`), except an `Error` carrying `userMessage`, which is shown as is.
 */
export type MessengerTransport = {
    /** Every conversation of the viewer, any order. */
    conversations(options: {
        signal?: AbortSignal;
    }): Promise<MessengerConversation[]>;
    /**
     * One page of a conversation, oldest first. `before` is the cursor the last
     * call returned; answer `before: null` when there is nothing older.
     */
    messages(conversationId: string, options: {
        before?: string;
        signal?: AbortSignal;
    }): Promise<{
        messages: MessengerMessage[];
        before: string | null;
    }>;
    /** Store a message and return it as stored, carrying the draft's `clientId`. */
    send(conversationId: string, draft: MessengerDraft): Promise<MessengerMessage>;
    /** One conversation that is not in the list yet (a link to it was opened). */
    conversation?(id: string, options: {
        signal?: AbortSignal;
    }): Promise<MessengerConversation>;
    edit?(message: MessengerMessage, body: string): Promise<MessengerMessage>;
    remove?(message: MessengerMessage): Promise<void>;
    /**
     * The viewer put `emoji` on a message, or (`null`) took theirs off. One per
     * person per message: a second choice replaces the first. Without it, no
     * reactions.
     */
    react?(message: MessengerMessage, emoji: string | null): Promise<void>;
    /** The viewer has read the conversation up to `at`. */
    markRead?(conversationId: string, at: Date): Promise<void>;
    /** The viewer started or stopped typing. Fire-and-forget. */
    typing?(conversationId: string, typing: boolean): void;
    /**
     * Put a file's bytes in storage and say what it became. Call `progress`
     * with 0..1 as it goes; honour `signal` (the person removed it).
     */
    upload?(file: Blob, about: MessengerUpload, control: {
        progress: (fraction: number) => void;
        signal: AbortSignal;
    }): Promise<MessengerAttachment>;
    /** Bytes the viewer already has stored, for the quota. Omit and only the
     *  per-file limits are checked in the browser (the server still decides). */
    usage?(): Promise<{
        usedBytes: number;
    }>;
    /**
     * Listen for what happens elsewhere, for the list and for the open
     * conversation (`null` when none is open). Return how to stop.
     */
    subscribe?(scope: {
        conversationId: string | null;
    }, on: (event: MessengerEvent) => void): () => void;
    /** People the viewer can start a conversation with. Without it, no "New". */
    people?(query: string, options: {
        signal?: AbortSignal;
    }): Promise<MessengerPerson[]>;
    /**
     * Who to offer in "New" before anything is typed: the viewer's own agents,
     * the people they wrote to last. Without it the sheet opens on a hint and
     * waits for a name.
     */
    suggestions?(options: {
        signal?: AbortSignal;
    }): Promise<MessengerPerson[]>;
    /** The conversation with exactly these people, made if it does not exist. */
    open?(personIds: readonly string[]): Promise<MessengerConversation>;
    /** Take conversations off the viewer's list. Others keep theirs. */
    leave?(conversationIds: readonly string[]): Promise<void>;
};
/** An error whose words are meant for the person (a server's "You are sending
 *  too fast"). Anything else is reported in the package's own words. */
export declare class MessengerError extends Error {
    readonly userMessage: string;
    constructor(userMessage: string);
}
/** The sentence to show for a failure: the transport's own, if it meant one. */
export declare function failureText(error: unknown, fallback: string): string;
/** A date however JSON carried it. Invalid input becomes the epoch rather
 *  than an `Invalid Date` that breaks every comparison after it. */
export declare function toDate(value: string | number | Date | null | undefined): Date;
type Loose<T, DateKeys extends keyof T> = Omit<T, DateKeys> & {
    [K in DateKeys]?: T[K] | string | number | null;
};
/** A message as JSON delivers it: dates may be ISO strings. */
export type MessengerMessageJson = Loose<MessengerMessage, "createdAt" | "editedAt">;
/** Dates made real, so every comparison in the thread is between `Date`s. */
export declare function reviveMessage(raw: MessengerMessageJson): MessengerMessage;
type LooseParticipant = Loose<MessengerParticipant, "joinedAt" | "leftAt" | "lastReadAt" | "visibleFrom">;
/** A conversation as JSON delivers it: every date may be an ISO string. */
export type MessengerConversationJson = Omit<MessengerConversation, "createdAt" | "participants" | "last"> & {
    createdAt?: Date | string | number | null;
    participants: readonly LooseParticipant[];
    last?: (Omit<MessengerLast, "createdAt"> & {
        createdAt: Date | string | number;
    }) | null;
};
export declare function reviveConversation(raw: MessengerConversationJson): MessengerConversation;
export declare function participantOf(conversation: MessengerConversation | null | undefined, actorId: string): MessengerParticipant | undefined;
/**
 * Is this actor an agent? True when its participant row says so, or when it
 * is one of the product's named agents — an agent that has not answered yet
 * has no row, and one that has answered must never read as a person.
 */
export declare function isAgent(conversation: MessengerConversation | null | undefined, actorId: string, agents?: readonly MessengerAgent[]): boolean;
/** The agents that are in this conversation: named ones that hold a seat. */
export declare function agentsPresent(conversation: MessengerConversation, agents?: readonly MessengerAgent[]): MessengerParticipant[];
/**
 * The agent this conversation is with, when nobody else is in it: one person
 * and one agent. Every message there is for the agent, so nothing has to name
 * it. Undefined as soon as a second person or a second agent is here.
 */
export declare function soleAgent(conversation: MessengerConversation | null | undefined, viewerId: string, agents?: readonly MessengerAgent[]): MessengerParticipant | undefined;
/**
 * The tick under a message: sent, read by some, read by all.
 *
 * threadkit's `readState` wherever a person could read it. Where nobody
 * could (the message was written to agents only) the agents are its audience:
 * an agent has read a message once its own read mark is past it, which an app
 * moves when the agent answers. Without this a conversation with only an
 * agent stayed at "Sent" for ever, whatever was answered.
 */
export declare function receiptOf(conversation: MessengerConversation, message: MessengerMessage, agents?: readonly MessengerAgent[]): "none" | "some" | "all";
/** Everyone else who is a person and still here. */
export declare function otherPeople(conversation: MessengerConversation, viewerId: string, agents?: readonly MessengerAgent[]): MessengerParticipant[];
export type MessengerTitleLabels = {
    /** A conversation with nobody else in it. */
    self: string;
    /** "{names} and {n} more" — `{names}` and `{n}` are replaced. */
    more: string;
};
/**
 * What a conversation is called: its own name, else the other people in it —
 * never the viewer's own name, and never an agent's while a person is there
 * (a conversation with Maya that the Cat joined is still "Maya").
 */
export declare function conversationTitle(conversation: MessengerConversation, viewerId: string, labels: MessengerTitleLabels, agents?: readonly MessengerAgent[]): string;
/** More than one other voice: every message then says who wrote it. */
export declare function needsNames(conversation: MessengerConversation, viewerId: string): boolean;
/** Newest first; a tie keeps a stable order, so rows never swap on a refresh. */
export declare function sortByNewest(conversations: readonly MessengerConversation[]): MessengerConversation[];
/** Put one conversation into the list (new, or replacing its older self). */
export declare function upsertConversation(conversations: readonly MessengerConversation[], conversation: MessengerConversation): MessengerConversation[];
/** What a message does to its conversation's row: it becomes the newest, and
 *  counts as unread unless the viewer wrote it or is looking at it. */
export declare function withMessage(conversation: MessengerConversation, message: MessengerMessage, viewerId: string, seen: boolean): MessengerConversation;
/** Somebody read up to `at`: their high-water mark moves forward, never back. */
export declare function withRead(conversation: MessengerConversation, actorId: string, at: Date, viewerId: string): MessengerConversation;
/**
 * The list filtered by what was typed: every word must appear in the title,
 * a participant's name or handle, or the newest message. A product with a
 * typo-tolerant search passes its own (`search`).
 */
export declare function searchConversations(conversations: readonly MessengerConversation[], query: string, title: (c: MessengerConversation) => string): MessengerConversation[];
export type MessengerPreviewLabels = {
    /** Before the viewer's own newest message: "You: ". */
    you: string;
    photo: string;
    /** "{n} photos". */
    photos: string;
    video: string;
    audio: string;
    file: string;
    /** "{n} attachments". */
    attachments: string;
    /** A conversation nobody has written in yet. */
    empty: string;
};
/** What a message of only files is called in one line. */
export declare function attachmentSummary(kinds: readonly AttachmentKind[], labels: MessengerPreviewLabels): string;
/** The second line of a row in the list: the newest message, on one line. */
export declare function conversationPreview(conversation: MessengerConversation, viewerId: string, labels: MessengerPreviewLabels): string;
/** How much of a message its quote carries. */
export declare const QUOTE_MAX = 140;
/** A message as the one line another message quotes. */
export declare function quoteOf(message: MessengerMessage): MessengerQuote;
/** What a quote says in one line: its words, else what its files are, else
 *  the card's title. */
export declare function quoteText(quote: MessengerQuote, labels: MessengerPreviewLabels): string;
/** The emoji offered first. Six, because six fit one row of 44px targets on
 *  a 320px phone. */
export declare const QUICK_REACTIONS: readonly string[];
/** The emoji `actorId` has on a message, if any. */
export declare function reactionOf(reactions: readonly MessengerReaction[] | undefined, actorId: string): string | null;
/**
 * Reactions after `actorId` chose `emoji` (`null` takes theirs off). One per
 * person: the old one goes. Order is first-used first, so chips do not jump
 * about as counts change.
 */
export declare function withReaction(reactions: readonly MessengerReaction[] | undefined, actorId: string, emoji: string | null): MessengerReaction[];
/** Messages by one author this close together are drawn as one run. */
export declare const RUN_GAP_MS: number;
export type ThreadItem = {
    type: "day";
    key: string;
    date: Date;
}
/** Where what the viewer has not read begins. */
 | {
    type: "unread";
    key: string;
} | {
    type: "run";
    key: string;
    authorId: string;
    own: boolean;
    messages: MessengerMessage[];
};
/** `YYYY-MM-DD` of a moment in a time zone (the device's when none is given). */
export declare function dayKey(date: Date, timeZone?: string): string;
/**
 * A thread as it is drawn: a line where each day begins, a line where the
 * unread messages begin, and runs — consecutive messages by one author, close
 * in time, that share one name and one timestamp. Sixty bubbles each with
 * their own avatar and clock is what makes a conversation hard to read.
 *
 * `unreadFrom` is the viewer's read mark as it was WHEN THE THREAD WAS OPENED;
 * pass the same value on every call, so the line does not jump away the
 * moment the messages under it are read.
 */
export declare function threadItems(messages: readonly MessengerMessage[], options: {
    viewerId: string;
    timeZone?: string;
    unreadFrom?: Date | null;
    gapMs?: number;
}): ThreadItem[];
export type MessengerDayLabels = {
    today: string;
    yesterday: string;
};
/** "Today", "Yesterday", "Tuesday" within the week, else the date. */
export declare function dayLabel(date: Date, now: Date, labels: MessengerDayLabels, locale?: string, timeZone?: string): string;
/** A clock time for a message: "06:24". */
export declare function clockTime(date: Date, locale?: string, timeZone?: string): string;
/** When a conversation last spoke, for the list: a time today, else a short date. */
export declare function listTime(date: Date, now: Date, labels: MessengerDayLabels, locale?: string, timeZone?: string): string;
/** Put what arrived into what is shown: threadkit's merge (the stored row
 *  replaces the bubble drawn at once), kept here so the thread has one door. */
export declare function mergeThread(shown: readonly MessengerMessage[], arrived: readonly MessengerMessage[]): MessengerMessage[];
export type TextPart = {
    type: "text";
    text: string;
} | {
    type: "link";
    text: string;
    href: string;
};
/**
 * A person's message as text and links. People write addresses, not markdown:
 * an `http(s)` address (or a bare `www.`) becomes a link and everything else
 * stays exactly as typed. Nothing else is ever a link — not `javascript:`, not
 * a word with a dot in it.
 */
export declare function linkify(text: string): TextPart[];
/** The agents a message calls on, by their whole-word mention. */
export declare function mentionedAgents(text: string, agents: readonly MessengerAgent[]): MessengerAgent[];
/** The draft with the agent's mention in front — once, however often it is asked. */
export declare function withMention(draft: string, mention: string): string;
/** How long an agent may take before "is thinking" gives up and says so. */
export declare const AGENT_PATIENCE_MS = 90000;
export type MessengerTypingLabels = {
    /** "{name} is typing…" */
    one: string;
    /** "{a} and {b} are typing…" */
    two: string;
    several: string;
};
export declare function typingLabel(names: readonly string[], labels: MessengerTypingLabels): string;
/** "640 KB", "1.5 MB" — one decimal from a megabyte up, none below. */
export declare function formatBytes(bytes: number): string;
/** "0:42", "12:05", "1:02:03". */
export declare function formatDuration(ms: number): string;
export type MessengerRefusalLabels = {
    /** "{name} cannot be sent here." */
    type: string;
    /** "{name} is too large (max {max})." */
    size: string;
    /** "Up to {max} files in one message." */
    count: string;
    /** "Your storage is full ({used} of {quota})." */
    quota: string;
    /** "{name} is empty." */
    empty: string;
};
/** Why a file was refused, in words, with the number the person needs. */
export declare function refusalText(refusal: AttachmentRefusal, name: string, labels: MessengerRefusalLabels): string;
/** The size a picture is drawn at so a thread can lay it out before it loads:
 *  no wider than `maxWidth`, no taller than `maxHeight`, never enlarged. */
export declare function fitMedia(width: number | undefined, height: number | undefined, maxWidth: number, maxHeight: number): {
    width: number;
    height: number;
} | null;
/** Where the words a person has not sent yet are kept, per conversation. */
export type MessengerDrafts = {
    get(conversationId: string): string;
    set(conversationId: string, text: string): void;
};
/**
 * Drafts that survive switching conversations and a reload of the tab, and
 * nothing longer: `sessionStorage` when there is one, memory otherwise. A
 * half-written message is the person's; losing it to a tap on another row is
 * the kind of thing that is noticed once and remembered.
 */
export declare function sessionDrafts(prefix?: string): MessengerDrafts;
export {};
//# sourceMappingURL=messenger.d.ts.map