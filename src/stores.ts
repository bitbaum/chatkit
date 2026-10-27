/**
 * Where a ChatApp keeps its conversations. Storage is an ADAPTER: the screen
 * reads and writes through `ConversationStore` and never knows whether the
 * chats are on the device or on a server. Two reference adapters:
 *
 *   localConversationStore({ key })     the device — signed-out chats
 *   httpConversationStore({ baseUrl })  the product's server — signed-in chats
 */
import {
  newId,
  sortConversations,
  type Conversation,
  type ConversationStore,
  type ConversationSummary,
  type StoredMessage,
} from "./conversations.js";

type KeyValue = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Bumped when the stored shape changes; an older shape is read as empty
 *  rather than misread. */
export const LOCAL_STORE_VERSION = 1;

/** A store in memory: a temporary chat, a test, a page with no storage. */
export function memoryConversationStore(): ConversationStore {
  return localConversationStore({ storage: null });
}

/** The page's localStorage, or null where touching it throws (Safari private
 *  mode on older versions, storage blocked by the browser's settings). */
function deviceStorage(): KeyValue | null {
  try {
    const s = (globalThis as { localStorage?: KeyValue }).localStorage;
    if (!s) return null;
    const probe = "__ck_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** What is kept of a message on the device: everything but attachment
 *  payloads. A picture is kept by name — a screenshot would spend the whole
 *  quota, and a blob: URL is dead after a reload anyway. */
function forDevice(message: StoredMessage): StoredMessage {
  if (!message.attachments?.length) return message;
  return {
    ...message,
    attachments: message.attachments.map(({ kind, name }) => ({ kind, name })),
  };
}

/**
 * Conversations on the device. Never throws: storage that is missing, full,
 * blocked or holding something unreadable degrades to memory for this page,
 * so the chat still works and simply is not there after a reload.
 *
 * Layout (versioned): `<key>:v1` holds the list, `<key>:v1:<id>` each chat's
 * messages — so one long chat can be evicted without losing the others. When
 * the quota is reached the OLDEST chats are dropped until the write fits.
 */
export function localConversationStore({
  key = "ck-chat",
  storage,
  limit = 200,
}: {
  /** Namespace on the device. One per product (and per signed-out person, if
   *  the device is shared and the product can tell them apart). */
  key?: string;
  /** Defaults to localStorage. `null` keeps everything in memory. */
  storage?: KeyValue | null;
  /** Most chats kept; the oldest go first. */
  limit?: number;
} = {}): ConversationStore {
  const store = storage === undefined ? deviceStorage() : storage;
  const prefix = `${key}:v${LOCAL_STORE_VERSION}`;
  const indexKey = prefix;
  const chatKey = (id: string) => `${prefix}:${id}`;
  // The memory copy is the truth for this page; storage is a mirror of it.
  let index: ConversationSummary[] | null = null;
  const chats = new Map<string, StoredMessage[]>();

  const read = <T>(k: string): T | null => {
    if (!store) return null;
    try {
      const raw = store.getItem(k);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };
  // "quota" frees room by dropping old chats; "broken" (blocked, private
  // mode, a value that cannot be written) stops mirroring for this page.
  let mirror = store !== null;
  const write = (k: string, value: unknown): "ok" | "quota" | "broken" => {
    if (!store || !mirror) return "broken";
    try {
      store.setItem(k, JSON.stringify(value));
      return "ok";
    } catch (e) {
      const err = e as { name?: string; code?: number; message?: string };
      const quota =
        err?.name === "QuotaExceededError" ||
        err?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        err?.code === 22 ||
        err?.code === 1014 ||
        /quota/i.test(String(err?.message ?? ""));
      if (quota) return "quota";
      mirror = false;
      return "broken";
    }
  };
  const drop = (k: string) => {
    try {
      store?.removeItem(k);
    } catch {
      /* nothing to do: the memory copy is already gone */
    }
  };

  const loadIndex = (): ConversationSummary[] => {
    if (index) return index;
    const raw = read<unknown>(indexKey);
    index = Array.isArray(raw)
      ? raw.filter(
          (c): c is ConversationSummary =>
            !!c &&
            typeof (c as ConversationSummary).id === "string" &&
            typeof (c as ConversationSummary).title === "string",
        )
      : [];
    return index;
  };
  const loadChat = (id: string): StoredMessage[] => {
    const known = chats.get(id);
    if (known) return known;
    const raw = read<unknown>(chatKey(id));
    const messages = Array.isArray(raw)
      ? raw.filter(
          (m): m is StoredMessage =>
            !!m && typeof (m as StoredMessage).id === "string" && "content" in (m as object),
        )
      : [];
    chats.set(id, messages);
    return messages;
  };

  /** Write, evicting the oldest other chats while the quota says no. */
  const persist = (keep: string | null) => {
    const list = sortConversations(loadIndex());
    while (list.length > limit) {
      const gone = list.pop()!;
      chats.delete(gone.id);
      drop(chatKey(gone.id));
    }
    index = list;
    const fits = () => {
      const listed = write(indexKey, list);
      if (listed !== "ok" || keep === null) return listed;
      return write(chatKey(keep), loadChat(keep));
    };
    for (let result = fits(); result === "quota"; result = fits()) {
      const victim = [...list].reverse().find((c) => c.id !== keep);
      if (!victim) {
        // Nothing left to give up: this chat stays in memory for the page.
        if (keep !== null) drop(chatKey(keep));
        return;
      }
      list.splice(list.indexOf(victim), 1);
      chats.delete(victim.id);
      drop(chatKey(victim.id));
    }
  };

  const touch = (id: string, patch: Partial<ConversationSummary> = {}) => {
    const list = loadIndex();
    const i = list.findIndex((c) => c.id === id);
    if (i < 0) return false;
    list[i] = { ...list[i], ...patch };
    return true;
  };

  return {
    async list() {
      return sortConversations(loadIndex()).map((c) => ({ ...c }));
    },
    async get(id) {
      const summary = loadIndex().find((c) => c.id === id);
      if (!summary) return null;
      const conversation: Conversation = { ...summary, messages: [...loadChat(id)] };
      return conversation;
    },
    async create(init) {
      const summary: ConversationSummary = {
        id: newId(),
        title: init?.title ?? "",
        updatedAt: new Date().toISOString(),
      };
      loadIndex().unshift(summary);
      chats.set(summary.id, []);
      persist(summary.id);
      return { ...summary };
    },
    async append(id, message) {
      if (!touch(id, { updatedAt: new Date().toISOString() })) return;
      loadChat(id).push(forDevice(message));
      persist(id);
    },
    async rename(id, title) {
      if (!touch(id, { title })) return;
      persist(null);
    },
    async remove(id) {
      index = loadIndex().filter((c) => c.id !== id);
      chats.delete(id);
      drop(chatKey(id));
      persist(null);
    },
  };
}

export type HttpConversationStoreOptions = {
  /** The collection, e.g. "/api/conversations". */
  baseUrl: string;
  /** Headers on every request (an auth token), or a function returning them. */
  headers?: Record<string, string> | (() => Record<string, string>);
  /** Defaults to the global fetch. */
  fetch?: typeof fetch;
  /**
   * The product's own chat route already writes every turn (Heidi's
   * `/messages`, Loki's `/api/loki`): then `append` sends nothing, so a turn
   * is never stored twice.
   */
  serverWritesTurns?: boolean;
};

/**
 * Conversations on the product's server, over this REST shape (Heidi's
 * `/api/conversations`, generalised):
 *
 *   GET    {base}                 → { conversations: [{ id, title, updatedAt }] }
 *   POST   {base}       { title } → { conversation: { id, title, updatedAt } }
 *   GET    {base}/{id}            → { conversation, messages: [...] }   404 = gone
 *   POST   {base}/{id}/messages { message } → 2xx
 *   PATCH  {base}/{id}  { title } → 2xx
 *   DELETE {base}/{id}            → 2xx
 *
 * A failed request throws an Error naming the call; ChatApp shows it in words.
 */
export function httpConversationStore({
  baseUrl,
  headers,
  fetch: fetchImpl,
  serverWritesTurns = false,
}: HttpConversationStoreOptions): ConversationStore {
  const base = baseUrl.replace(/\/+$/, "");
  const call = async (method: string, path: string, body?: unknown): Promise<Response> => {
    const f = fetchImpl ?? globalThis.fetch;
    const extra = typeof headers === "function" ? headers() : (headers ?? {});
    const res = await f(`${base}${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok && !(method === "GET" && res.status === 404)) {
      throw new Error(`${method} ${base}${path} answered ${res.status}`);
    }
    return res;
  };
  const json = async (res: Response): Promise<Record<string, unknown>> => {
    try {
      const v = await res.json();
      return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };
  const summary = (raw: unknown): ConversationSummary => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      title: typeof r.title === "string" ? r.title : "",
      updatedAt:
        typeof r.updatedAt === "string" || typeof r.updatedAt === "number"
          ? r.updatedAt
          : new Date().toISOString(),
    };
  };
  const enc = encodeURIComponent;

  return {
    async list() {
      const res = await call("GET", "");
      const body = await res.json().catch(() => null);
      const rows = Array.isArray(body)
        ? body
        : Array.isArray((body as { conversations?: unknown })?.conversations)
          ? (body as { conversations: unknown[] }).conversations
          : [];
      return sortConversations(rows.map(summary).filter((c) => c.id));
    },
    async get(id) {
      const res = await call("GET", `/${enc(id)}`);
      if (res.status === 404) return null;
      const body = await json(res);
      const messages = Array.isArray(body.messages) ? (body.messages as StoredMessage[]) : [];
      return { ...summary(body.conversation ?? { id }), messages };
    },
    async create(init) {
      const body = await json(await call("POST", "", { title: init?.title ?? "" }));
      return summary(body.conversation);
    },
    async append(id, message) {
      if (serverWritesTurns) return;
      await call("POST", `/${enc(id)}/messages`, { message });
    },
    async rename(id, title) {
      await call("PATCH", `/${enc(id)}`, { title });
    },
    async remove(id) {
      await call("DELETE", `/${enc(id)}`);
    },
  };
}
