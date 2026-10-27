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

export type Conversation = ConversationSummary & { messages: StoredMessage[] };

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
  create(init?: { title?: string }): Promise<ConversationSummary>;
  append(id: string, message: StoredMessage): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  remove(id: string): Promise<void>;
}

/** An id that is unique enough for a client-made message or conversation,
 *  also where `crypto.randomUUID` is missing (plain http, old WebViews). */
export function newId(prefix = ""): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const core =
    typeof c?.randomUUID === "function"
      ? c.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${core}` : core;
}

/** The longest title derived from a message, in characters. */
export const TITLE_MAX = 48;

/**
 * What a chat is called before anyone names it: the first thing the person
 * said, as one line, without the markdown, cut at a word with an ellipsis.
 * `null` when there are no words (a message of only an attachment) — the
 * list then shows its "New chat" label rather than an empty row. The rule
 * is Heidi's `lib/domain/chat/title.ts`, (heidi repo), now the package's.
 */
export function deriveTitle(text: string, max = TITLE_MAX): string | null {
  const line = text
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~#>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!line) return null;
  if (line.length <= max) return line;
  const cut = line.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const head = space > max * 0.5 ? cut.slice(0, space) : cut;
  return `${head.replace(/[\s,.;:–—-]+$/, "")}…`;
}

function timeOf(at: string | number): number {
  const t = typeof at === "number" ? at : Date.parse(at);
  return Number.isFinite(t) ? t : 0;
}

/** Newest first; a row with an unreadable date sinks to the bottom. */
export function sortConversations<T extends ConversationSummary>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => timeOf(b.updatedAt) - timeOf(a.updatedAt));
}

export type ConversationGroupKey = "today" | "yesterday" | "earlier";
export type ConversationGroup<T extends ConversationSummary = ConversationSummary> = {
  key: ConversationGroupKey;
  items: T[];
};

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Which heading a row sits under, by the reader's own calendar day. */
export function conversationGroupOf(
  at: string | number,
  now: number = Date.now(),
): ConversationGroupKey {
  const t = timeOf(at);
  const today = startOfDay(now);
  if (t >= today) return "today";
  // The day before by the calendar, not "24 hours ago": a chat from 23:50
  // read at 00:10 is yesterday's.
  const yesterday = startOfDay(today - 1);
  if (t >= yesterday) return "yesterday";
  return "earlier";
}

/** The list under Today / Yesterday / Earlier, newest first, empty groups left out. */
export function groupConversations<T extends ConversationSummary>(
  list: readonly T[],
  now: number = Date.now(),
): ConversationGroup<T>[] {
  const order: ConversationGroupKey[] = ["today", "yesterday", "earlier"];
  const by = new Map<ConversationGroupKey, T[]>(order.map((k) => [k, []]));
  for (const c of sortConversations(list)) by.get(conversationGroupOf(c.updatedAt, now))!.push(c);
  return order.filter((k) => by.get(k)!.length > 0).map((key) => ({ key, items: by.get(key)! }));
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * The search box over the list: every word typed must appear in the title,
 * case and accents ignored ("zurich" finds "Zürich"). Order is kept. A
 * product that ranks with `@bitbaum/searchkit` passes its own to `ChatApp`'s
 * `search` — chatkit itself takes no dependency.
 */
export function filterConversations<T extends ConversationSummary>(
  list: readonly T[],
  query: string,
): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...list];
  return list.filter((c) => {
    const title = fold(c.title);
    return words.every((w) => title.includes(w));
  });
}

/**
 * The date on a row, the way the phone apps write it: the time today, the
 * weekday within the week, the date after that (with the year once it is not
 * this year's). In the reader's locale through `Intl`.
 */
export function formatConversationDate(
  at: string | number,
  now: number = Date.now(),
  locale?: string,
): string {
  const t = timeOf(at);
  if (!t) return "";
  const d = new Date(t);
  const today = startOfDay(now);
  if (t >= today) return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (t >= today - 6 * 86_400_000) return d.toLocaleDateString(locale, { weekday: "short" });
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Which chat a reload opens: the one asked for (a link, the URL), else the
 * one that was open, but only while it still exists — a chat deleted on
 * another device opens a new chat, never an error page.
 */
export function pickRestored(
  list: readonly ConversationSummary[],
  wanted: string | null | undefined,
  remembered: string | null | undefined,
): string | null {
  const ids = new Set(list.map((c) => c.id));
  if (wanted && ids.has(wanted)) return wanted;
  if (remembered && ids.has(remembered)) return remembered;
  return null;
}

/** Copy every conversation from one store into another — the signed-out
 *  chats into the account when someone signs in. Returns how many moved. */
export async function copyConversations(
  from: ConversationStore,
  to: ConversationStore,
): Promise<number> {
  let moved = 0;
  // Oldest first, so the newest chat is also the newest in the target.
  for (const summary of [...(await from.list())].reverse()) {
    const full = await from.get(summary.id);
    if (!full || full.messages.length === 0) continue;
    const created = await to.create({ title: full.title });
    for (const m of full.messages) await to.append(created.id, m);
    moved++;
  }
  return moved;
}
