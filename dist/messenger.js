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
import { mergeMessages } from "@bitbaum/threadkit";
import { mentionMatcher, } from "./thread-rules.js";
/** An error whose words are meant for the person (a server's "You are sending
 *  too fast"). Anything else is reported in the package's own words. */
export class MessengerError extends Error {
    userMessage;
    constructor(userMessage) {
        super(userMessage);
        this.name = "MessengerError";
        this.userMessage = userMessage;
    }
}
/** The sentence to show for a failure: the transport's own, if it meant one. */
export function failureText(error, fallback) {
    const said = error?.userMessage;
    return typeof said === "string" && said.trim() ? said : fallback;
}
// ── Reading what a server sent ──────────────────────────────────────────────
/** A date however JSON carried it. Invalid input becomes the epoch rather
 *  than an `Invalid Date` that breaks every comparison after it. */
export function toDate(value) {
    if (value instanceof Date)
        return Number.isNaN(value.getTime()) ? new Date(0) : value;
    if (value === null || value === undefined)
        return new Date(0);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}
/** Dates made real, so every comparison in the thread is between `Date`s. */
export function reviveMessage(raw) {
    const { createdAt, editedAt, ...rest } = raw;
    const message = { ...rest, createdAt: toDate(createdAt) };
    if (editedAt)
        message.editedAt = toDate(editedAt);
    return message;
}
export function reviveConversation(raw) {
    return {
        ...raw,
        createdAt: toDate(raw.createdAt),
        last: raw.last ? { ...raw.last, createdAt: toDate(raw.last.createdAt) } : (raw.last ?? null),
        participants: raw.participants.map((p) => {
            const { joinedAt, leftAt, lastReadAt, visibleFrom, ...rest } = p;
            const participant = { ...rest, joinedAt: toDate(joinedAt) };
            return {
                ...participant,
                ...(leftAt ? { leftAt: toDate(leftAt) } : {}),
                ...(lastReadAt ? { lastReadAt: toDate(lastReadAt) } : {}),
                ...(visibleFrom === "thread-start"
                    ? { visibleFrom: "thread-start" }
                    : visibleFrom
                        ? { visibleFrom: toDate(visibleFrom) }
                        : {}),
            };
        }),
    };
}
// ── Who is who ──────────────────────────────────────────────────────────────
export function participantOf(conversation, actorId) {
    return conversation?.participants.find((p) => p.actorId === actorId);
}
/**
 * Is this actor an agent? True when its participant row says so, or when it
 * is one of the product's named agents — an agent that has not answered yet
 * has no row, and one that has answered must never read as a person.
 */
export function isAgent(conversation, actorId, agents = []) {
    if (agents.some((a) => a.id === actorId))
        return true;
    const p = participantOf(conversation, actorId);
    return p !== undefined && p.kind !== "human";
}
/** The agents that are in this conversation: named ones that hold a seat. */
export function agentsPresent(conversation, agents = []) {
    return conversation.participants.filter((p) => !p.leftAt && (p.kind !== "human" || agents.some((a) => a.id === p.actorId)));
}
/** Everyone else who is a person and still here. */
export function otherPeople(conversation, viewerId, agents = []) {
    return conversation.participants.filter((p) => p.actorId !== viewerId && !p.leftAt && !isAgent(conversation, p.actorId, agents));
}
/**
 * What a conversation is called: its own name, else the other people in it —
 * never the viewer's own name, and never an agent's while a person is there
 * (a conversation with Maya that the Cat joined is still "Maya").
 */
export function conversationTitle(conversation, viewerId, labels, agents = []) {
    const named = conversation.subject?.trim();
    if (named)
        return named;
    const people = otherPeople(conversation, viewerId, agents);
    const shown = people.length > 0 ? people : agentsPresent(conversation, agents);
    const names = shown.map((p) => p.name.trim() || p.handle || "").filter(Boolean);
    if (names.length === 0)
        return labels.self;
    if (names.length <= 3)
        return names.join(", ");
    return labels.more
        .replace("{names}", names.slice(0, 2).join(", "))
        .replace("{n}", String(names.length - 2));
}
/** More than one other voice: every message then says who wrote it. */
export function needsNames(conversation, viewerId) {
    return conversation.participants.filter((p) => p.actorId !== viewerId && !p.leftAt).length > 1;
}
// ── The list ────────────────────────────────────────────────────────────────
function lastAt(c) {
    return (c.last?.createdAt ?? c.createdAt).getTime();
}
/** Newest first; a tie keeps a stable order, so rows never swap on a refresh. */
export function sortByNewest(conversations) {
    return [...conversations].sort((a, b) => lastAt(b) - lastAt(a) || (a.id < b.id ? -1 : 1));
}
/** Put one conversation into the list (new, or replacing its older self). */
export function upsertConversation(conversations, conversation) {
    return sortByNewest([...conversations.filter((c) => c.id !== conversation.id), conversation]);
}
/** What a message does to its conversation's row: it becomes the newest, and
 *  counts as unread unless the viewer wrote it or is looking at it. */
export function withMessage(conversation, message, viewerId, seen) {
    const newest = !conversation.last || message.createdAt >= conversation.last.createdAt;
    const own = message.authorId === viewerId;
    return {
        ...conversation,
        last: newest
            ? {
                body: message.body,
                authorId: message.authorId,
                createdAt: message.createdAt,
                attachments: message.attachments?.map((a) => a.kind),
            }
            : conversation.last,
        unread: seen ? 0 : own ? conversation.unread : (conversation.unread ?? 0) + 1,
    };
}
/** Somebody read up to `at`: their high-water mark moves forward, never back. */
export function withRead(conversation, actorId, at, viewerId) {
    return {
        ...conversation,
        unread: actorId === viewerId ? 0 : conversation.unread,
        participants: conversation.participants.map((p) => p.actorId === actorId && (!p.lastReadAt || p.lastReadAt < at) ? { ...p, lastReadAt: at } : p),
    };
}
/** Fold accents and case, so "zoe" finds "Zoë". */
function fold(text) {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
/**
 * The list filtered by what was typed: every word must appear in the title,
 * a participant's name or handle, or the newest message. A product with a
 * typo-tolerant search passes its own (`search`).
 */
export function searchConversations(conversations, query, title) {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0)
        return [...conversations];
    return conversations.filter((c) => {
        const hay = fold([
            title(c),
            ...c.participants.flatMap((p) => [p.name, p.handle ?? ""]),
            c.last?.body ?? "",
        ].join(" "));
        return words.every((w) => hay.includes(w));
    });
}
/** What a message of only files is called in one line. */
export function attachmentSummary(kinds, labels) {
    if (kinds.length === 0)
        return "";
    if (kinds.every((k) => k === "image")) {
        return kinds.length === 1 ? labels.photo : labels.photos.replace("{n}", String(kinds.length));
    }
    if (kinds.length === 1) {
        return kinds[0] === "video" ? labels.video : kinds[0] === "audio" ? labels.audio : labels.file;
    }
    return labels.attachments.replace("{n}", String(kinds.length));
}
/** The second line of a row in the list: the newest message, on one line. */
export function conversationPreview(conversation, viewerId, labels) {
    const last = conversation.last;
    if (!last)
        return labels.empty;
    const words = last.body.replace(/\s+/g, " ").trim();
    const said = words || attachmentSummary(last.attachments ?? [], labels);
    if (!said)
        return labels.empty;
    return last.authorId === viewerId ? `${labels.you}${said}` : said;
}
// ── Replies and reactions ───────────────────────────────────────────────────
/** How much of a message its quote carries. */
export const QUOTE_MAX = 140;
/** A message as the one line another message quotes. */
export function quoteOf(message) {
    const words = message.body.replace(/\s+/g, " ").trim();
    const kinds = (message.attachments ?? []).map((a) => a.kind);
    return {
        id: message.id,
        authorId: message.authorId,
        body: words.length > QUOTE_MAX ? `${words.slice(0, QUOTE_MAX - 1).trimEnd()}…` : words,
        ...(kinds.length > 0 ? { attachments: kinds } : {}),
    };
}
/** What a quote says in one line: its words, else what its files are, else
 *  the card's title. */
export function quoteText(quote, labels) {
    return quote.body || attachmentSummary(quote.attachments ?? [], labels) || labels.empty;
}
/** The emoji offered first. Six, because six fit one row of 44px targets on
 *  a 320px phone. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
/** The emoji `actorId` has on a message, if any. */
export function reactionOf(reactions, actorId) {
    return reactions?.find((r) => r.actorIds.includes(actorId))?.emoji ?? null;
}
/**
 * Reactions after `actorId` chose `emoji` (`null` takes theirs off). One per
 * person: the old one goes. Order is first-used first, so chips do not jump
 * about as counts change.
 */
export function withReaction(reactions, actorId, emoji) {
    const without = (reactions ?? [])
        .map((r) => ({ emoji: r.emoji, actorIds: r.actorIds.filter((a) => a !== actorId) }))
        .filter((r) => r.actorIds.length > 0 || r.emoji === emoji);
    if (emoji === null)
        return without.filter((r) => r.actorIds.length > 0);
    const at = without.findIndex((r) => r.emoji === emoji);
    if (at === -1)
        return [...without, { emoji, actorIds: [actorId] }];
    return without.map((r, i) => (i === at ? { emoji, actorIds: [...r.actorIds, actorId] } : r));
}
// ── The thread ──────────────────────────────────────────────────────────────
/** Messages by one author this close together are drawn as one run. */
export const RUN_GAP_MS = 5 * 60 * 1000;
/** `YYYY-MM-DD` of a moment in a time zone (the device's when none is given). */
export function dayKey(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
}
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
export function threadItems(messages, options) {
    const { viewerId, timeZone, unreadFrom, gapMs = RUN_GAP_MS } = options;
    const items = [];
    let day = "";
    let unreadDrawn = false;
    let run = null;
    for (const message of messages) {
        const key = dayKey(message.createdAt, timeZone);
        if (key !== day) {
            day = key;
            run = null;
            items.push({ type: "day", key: `day-${key}`, date: message.createdAt });
        }
        if (!unreadDrawn &&
            unreadFrom &&
            message.authorId !== viewerId &&
            message.createdAt > unreadFrom) {
            unreadDrawn = true;
            run = null;
            // Nothing above it means the whole thread is new: a line would only
            // say "everything", which the thread already does.
            if (items.some((i) => i.type === "run"))
                items.push({ type: "unread", key: "unread" });
        }
        const previous = run?.messages[run.messages.length - 1];
        const joins = run !== null &&
            previous !== undefined &&
            run.authorId === message.authorId &&
            (previous.onBehalfOf ?? "") === (message.onBehalfOf ?? "") &&
            message.createdAt.getTime() - previous.createdAt.getTime() <= gapMs;
        if (joins && run) {
            run.messages.push(message);
        }
        else {
            run = {
                type: "run",
                key: `run-${message.id}`,
                authorId: message.authorId,
                own: message.authorId === viewerId,
                messages: [message],
            };
            items.push(run);
        }
    }
    return items;
}
/** "Today", "Yesterday", "Tuesday" within the week, else the date. */
export function dayLabel(date, now, labels, locale, timeZone) {
    const key = dayKey(date, timeZone);
    if (key === dayKey(now, timeZone))
        return labels.today;
    if (key === dayKey(new Date(now.getTime() - 86_400_000), timeZone))
        return labels.yesterday;
    const age = now.getTime() - date.getTime();
    if (age > 0 && age < 6 * 86_400_000) {
        return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone }).format(date);
    }
    const sameYear = key.slice(0, 4) === dayKey(now, timeZone).slice(0, 4);
    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        ...(sameYear ? {} : { year: "numeric" }),
        timeZone,
    }).format(date);
}
/** A clock time for a message: "06:24". */
export function clockTime(date, locale, timeZone) {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(date);
}
/** When a conversation last spoke, for the list: a time today, else a short date. */
export function listTime(date, now, labels, locale, timeZone) {
    const key = dayKey(date, timeZone);
    if (key === dayKey(now, timeZone))
        return clockTime(date, locale, timeZone);
    if (key === dayKey(new Date(now.getTime() - 86_400_000), timeZone))
        return labels.yesterday;
    const age = now.getTime() - date.getTime();
    if (age > 0 && age < 6 * 86_400_000) {
        return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone }).format(date);
    }
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone }).format(date);
}
/** Put what arrived into what is shown: threadkit's merge (the stored row
 *  replaces the bubble drawn at once), kept here so the thread has one door. */
export function mergeThread(shown, arrived) {
    // threadkit hands back the objects it was given, in order; before 0.1.2 its
    // signature says only `Message`.
    return mergeMessages(shown, arrived);
}
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
/** Punctuation that ends a sentence, not an address. */
const TRAILING = /[.,!?;:'"…]+$/;
/**
 * A person's message as text and links. People write addresses, not markdown:
 * an `http(s)` address (or a bare `www.`) becomes a link and everything else
 * stays exactly as typed. Nothing else is ever a link — not `javascript:`, not
 * a word with a dot in it.
 */
export function linkify(text) {
    const parts = [];
    let at = 0;
    for (const match of text.matchAll(URL_PATTERN)) {
        let found = match[0];
        const start = match.index ?? 0;
        const trail = TRAILING.exec(found);
        if (trail)
            found = found.slice(0, -trail[0].length);
        // A closing bracket belongs to the sentence unless the address opened one.
        while (found.endsWith(")") && !found.includes("("))
            found = found.slice(0, -1);
        if (found.length < 5)
            continue;
        if (start > at)
            parts.push({ type: "text", text: text.slice(at, start) });
        parts.push({
            type: "link",
            text: found,
            href: /^https?:\/\//i.test(found) ? found : `https://${found}`,
        });
        at = start + found.length;
    }
    if (at < text.length)
        parts.push({ type: "text", text: text.slice(at) });
    return parts;
}
// ── Agents ──────────────────────────────────────────────────────────────────
/** The agents a message calls on, by their whole-word mention. */
export function mentionedAgents(text, agents) {
    return agents.filter((agent) => mentionMatcher([agent.mention])(text));
}
/** The draft with the agent's mention in front — once, however often it is asked. */
export function withMention(draft, mention) {
    if (mentionMatcher([mention])(draft))
        return draft;
    const rest = draft.replace(/^\s+/, "");
    return rest ? `${mention} ${rest}` : `${mention} `;
}
/** How long an agent may take before "is thinking" gives up and says so. */
export const AGENT_PATIENCE_MS = 90_000;
export function typingLabel(names, labels) {
    if (names.length === 0)
        return "";
    if (names.length === 1)
        return labels.one.replace("{name}", names[0]);
    if (names.length === 2)
        return labels.two.replace("{a}", names[0]).replace("{b}", names[1]);
    return labels.several;
}
// ── Files ───────────────────────────────────────────────────────────────────
/** "640 KB", "1.5 MB" — one decimal from a megabyte up, none below. */
export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0)
        return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024)
        return `${Math.max(1, Math.round(kb))} KB`;
    const mb = kb / 1024;
    if (mb < 1024)
        return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
}
/** "0:42", "12:05", "1:02:03". */
export function formatDuration(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
/** Why a file was refused, in words, with the number the person needs. */
export function refusalText(refusal, name, labels) {
    switch (refusal.reason) {
        case "type":
            return labels.type.replace("{name}", name);
        case "empty":
            return labels.empty.replace("{name}", name);
        case "size":
            return labels.size.replace("{name}", name).replace("{max}", formatBytes(refusal.maxBytes));
        case "count":
            return labels.count.replace("{max}", String(refusal.maxPerMessage));
        case "quota":
            return labels.quota
                .replace("{used}", formatBytes(refusal.usedBytes))
                .replace("{quota}", formatBytes(refusal.quotaBytes));
    }
}
/** The size a picture is drawn at so a thread can lay it out before it loads:
 *  no wider than `maxWidth`, no taller than `maxHeight`, never enlarged. */
export function fitMedia(width, height, maxWidth, maxHeight) {
    if (!width || !height || width <= 0 || height <= 0)
        return null;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}
/**
 * Drafts that survive switching conversations and a reload of the tab, and
 * nothing longer: `sessionStorage` when there is one, memory otherwise. A
 * half-written message is the person's; losing it to a tap on another row is
 * the kind of thing that is noticed once and remembered.
 */
export function sessionDrafts(prefix = "ck-msgr-draft:") {
    const memory = new Map();
    const store = () => {
        try {
            return typeof sessionStorage === "undefined" ? null : sessionStorage;
        }
        catch {
            return null;
        }
    };
    return {
        get(conversationId) {
            const kept = memory.get(conversationId);
            if (kept !== undefined)
                return kept;
            try {
                return store()?.getItem(prefix + conversationId) ?? "";
            }
            catch {
                return "";
            }
        },
        set(conversationId, text) {
            memory.set(conversationId, text);
            try {
                if (text)
                    store()?.setItem(prefix + conversationId, text);
                else
                    store()?.removeItem(prefix + conversationId);
            }
            catch {
                // A full or forbidden store keeps the draft in memory only.
            }
        },
    };
}
//# sourceMappingURL=messenger.js.map