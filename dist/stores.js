/**
 * Where a ChatApp keeps its conversations. Storage is an ADAPTER: the screen
 * reads and writes through `ConversationStore` and never knows whether the
 * chats are on the device or on a server. Two reference adapters:
 *
 *   localConversationStore({ key })     the device — signed-out chats
 *   httpConversationStore({ baseUrl })  the product's server — signed-in chats
 */
import { newId, sortConversations, } from "./conversations.js";
/** Bumped when the stored shape changes; an older shape is read as empty
 *  rather than misread. */
export const LOCAL_STORE_VERSION = 1;
/** A store in memory: a temporary chat, a test, a page with no storage. */
export function memoryConversationStore() {
    return localConversationStore({ storage: null });
}
/** The page's localStorage, or null where touching it throws (Safari private
 *  mode on older versions, storage blocked by the browser's settings). */
function deviceStorage() {
    try {
        const s = globalThis.localStorage;
        if (!s)
            return null;
        const probe = "__ck_probe__";
        s.setItem(probe, "1");
        s.removeItem(probe);
        return s;
    }
    catch {
        return null;
    }
}
/** What is kept of a message on the device: everything but attachment
 *  payloads. A picture is kept by name — a screenshot would spend the whole
 *  quota, and a blob: URL is dead after a reload anyway. */
function forDevice(message) {
    if (!message.attachments?.length)
        return message;
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
export function localConversationStore({ key = "ck-chat", storage, limit = 200, } = {}) {
    const store = storage === undefined ? deviceStorage() : storage;
    const prefix = `${key}:v${LOCAL_STORE_VERSION}`;
    const indexKey = prefix;
    const chatKey = (id) => `${prefix}:${id}`;
    // The memory copy is the truth for this page; storage is a mirror of it.
    let index = null;
    const chats = new Map();
    const read = (k) => {
        if (!store)
            return null;
        try {
            const raw = store.getItem(k);
            return raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
    };
    // "quota" frees room by dropping old chats; "broken" (blocked, private
    // mode, a value that cannot be written) stops mirroring for this page.
    let mirror = store !== null;
    const write = (k, value) => {
        if (!store || !mirror)
            return "broken";
        try {
            store.setItem(k, JSON.stringify(value));
            return "ok";
        }
        catch (e) {
            const err = e;
            const quota = err?.name === "QuotaExceededError" ||
                err?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
                err?.code === 22 ||
                err?.code === 1014 ||
                /quota/i.test(String(err?.message ?? ""));
            if (quota)
                return "quota";
            mirror = false;
            return "broken";
        }
    };
    const drop = (k) => {
        try {
            store?.removeItem(k);
        }
        catch {
            /* nothing to do: the memory copy is already gone */
        }
    };
    const loadIndex = () => {
        if (index)
            return index;
        const raw = read(indexKey);
        index = Array.isArray(raw)
            ? raw.filter((c) => !!c &&
                typeof c.id === "string" &&
                typeof c.title === "string")
            : [];
        return index;
    };
    const loadChat = (id) => {
        const known = chats.get(id);
        if (known)
            return known;
        const raw = read(chatKey(id));
        const messages = Array.isArray(raw)
            ? raw.filter((m) => !!m && typeof m.id === "string" && "content" in m)
            : [];
        chats.set(id, messages);
        return messages;
    };
    /** Write, evicting the oldest other chats while the quota says no. */
    const persist = (keep) => {
        const list = sortConversations(loadIndex());
        while (list.length > limit) {
            const gone = list.pop();
            chats.delete(gone.id);
            drop(chatKey(gone.id));
        }
        index = list;
        const fits = () => {
            const listed = write(indexKey, list);
            if (listed !== "ok" || keep === null)
                return listed;
            return write(chatKey(keep), loadChat(keep));
        };
        for (let result = fits(); result === "quota"; result = fits()) {
            const victim = [...list].reverse().find((c) => c.id !== keep);
            if (!victim) {
                // Nothing left to give up: this chat stays in memory for the page.
                if (keep !== null)
                    drop(chatKey(keep));
                return;
            }
            list.splice(list.indexOf(victim), 1);
            chats.delete(victim.id);
            drop(chatKey(victim.id));
        }
    };
    const touch = (id, patch = {}) => {
        const list = loadIndex();
        const i = list.findIndex((c) => c.id === id);
        if (i < 0)
            return false;
        list[i] = { ...list[i], ...patch };
        return true;
    };
    return {
        async list() {
            return sortConversations(loadIndex()).map((c) => ({ ...c }));
        },
        async get(id) {
            const summary = loadIndex().find((c) => c.id === id);
            if (!summary)
                return null;
            const conversation = { ...summary, messages: [...loadChat(id)] };
            return conversation;
        },
        async create(init) {
            const summary = {
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
            if (!touch(id, { updatedAt: new Date().toISOString() }))
                return;
            loadChat(id).push(forDevice(message));
            persist(id);
        },
        async rename(id, title) {
            if (!touch(id, { title }))
                return;
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
export function httpConversationStore({ baseUrl, headers, fetch: fetchImpl, serverWritesTurns = false, }) {
    const base = baseUrl.replace(/\/+$/, "");
    const call = async (method, path, body) => {
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
    const json = async (res) => {
        try {
            const v = await res.json();
            return v && typeof v === "object" ? v : {};
        }
        catch {
            return {};
        }
    };
    const summary = (raw) => {
        const r = (raw ?? {});
        return {
            id: String(r.id ?? ""),
            title: typeof r.title === "string" ? r.title : "",
            updatedAt: typeof r.updatedAt === "string" || typeof r.updatedAt === "number"
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
                : Array.isArray(body?.conversations)
                    ? body.conversations
                    : [];
            return sortConversations(rows.map(summary).filter((c) => c.id));
        },
        async get(id) {
            const res = await call("GET", `/${enc(id)}`);
            if (res.status === 404)
                return null;
            const body = await json(res);
            const messages = Array.isArray(body.messages) ? body.messages : [];
            return { ...summary(body.conversation ?? { id }), messages };
        },
        async create(init) {
            const body = await json(await call("POST", "", { title: init?.title ?? "" }));
            return summary(body.conversation);
        },
        async append(id, message) {
            if (serverWritesTurns)
                return;
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
//# sourceMappingURL=stores.js.map