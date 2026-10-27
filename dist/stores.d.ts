/**
 * Where a ChatApp keeps its conversations. Storage is an ADAPTER: the screen
 * reads and writes through `ConversationStore` and never knows whether the
 * chats are on the device or on a server. Two reference adapters:
 *
 *   localConversationStore({ key })     the device — signed-out chats
 *   httpConversationStore({ baseUrl })  the product's server — signed-in chats
 */
import { type ConversationStore } from "./conversations.js";
type KeyValue = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/** Bumped when the stored shape changes; an older shape is read as empty
 *  rather than misread. */
export declare const LOCAL_STORE_VERSION = 1;
/** A store in memory: a temporary chat, a test, a page with no storage. */
export declare function memoryConversationStore(): ConversationStore;
/**
 * Conversations on the device. Never throws: storage that is missing, full,
 * blocked or holding something unreadable degrades to memory for this page,
 * so the chat still works and simply is not there after a reload.
 *
 * Layout (versioned): `<key>:v1` holds the list, `<key>:v1:<id>` each chat's
 * messages — so one long chat can be evicted without losing the others. When
 * the quota is reached the OLDEST chats are dropped until the write fits.
 */
export declare function localConversationStore({ key, storage, limit, }?: {
    /** Namespace on the device. One per product (and per signed-out person, if
     *  the device is shared and the product can tell them apart). */
    key?: string;
    /** Defaults to localStorage. `null` keeps everything in memory. */
    storage?: KeyValue | null;
    /** Most chats kept; the oldest go first. */
    limit?: number;
}): ConversationStore;
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
export declare function httpConversationStore({ baseUrl, headers, fetch: fetchImpl, serverWritesTurns, }: HttpConversationStoreOptions): ConversationStore;
export {};
//# sourceMappingURL=stores.d.ts.map