// The chat list and where it is kept — the part of a chat app every product
// used to write for itself, each a little differently.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  conversationGroupOf,
  copyConversations,
  deriveTitle,
  filterConversations,
  formatConversationDate,
  groupConversations,
  httpConversationStore,
  localConversationStore,
  memoryConversationStore,
  pickRestored,
  sortConversations,
  LOCAL_STORE_VERSION,
} from "../dist/index.js";
import {
  ChatApp,
  ChatHistory,
  DEFAULT_CHAT_APP_LABELS,
  isTemporaryId,
} from "../dist/react/index.js";

const at = (y, m, d, hh = 12, mm = 0) => new Date(y, m - 1, d, hh, mm).getTime();
const NOW = at(2026, 10, 27, 0, 10);

test("title: the first line, without markdown, cut at a word", () => {
  assert.equal(
    deriveTitle("  How do I **get paid** in Bitcoin?\nsecond line"),
    "How do I get paid in Bitcoin? second line",
  );
  assert.equal(deriveTitle("# Plan\n\n- one"), "Plan - one");
  assert.equal(deriveTitle("see [the docs](https://x.y) now"), "see the docs now");
  assert.equal(deriveTitle("```js\nconst x = 1\n```"), null, "only code: no words to name it by");
  assert.equal(deriveTitle("   "), null);
  const long = deriveTitle(
    "Which suppliers of gallium in China could replace the ones that stopped exporting last year",
  );
  assert.ok(long.length <= 48, long);
  assert.ok(long.endsWith("…"));
  assert.ok(!/\s…$/.test(long), "no space before the ellipsis");
  assert.ok(long.startsWith("Which suppliers of gallium"), "cut at a word, not mid-word");
});

test("groups: today / yesterday / earlier by the calendar day, newest first", () => {
  const list = [
    { id: "a", title: "old", updatedAt: new Date(at(2026, 9, 1)).toISOString() },
    { id: "b", title: "late last night", updatedAt: at(2026, 10, 26, 23, 50) },
    { id: "c", title: "just now", updatedAt: at(2026, 10, 27, 0, 5) },
    { id: "d", title: "two days", updatedAt: at(2026, 10, 25, 9) },
    { id: "e", title: "earlier today", updatedAt: at(2026, 10, 27, 0, 1) },
  ];
  assert.equal(
    conversationGroupOf(at(2026, 10, 26, 23, 50), NOW),
    "yesterday",
    "20 minutes ago, but yesterday",
  );
  const groups = groupConversations(list, NOW);
  assert.deepEqual(
    groups.map((g) => [g.key, g.items.map((c) => c.id)]),
    [
      ["today", ["c", "e"]],
      ["yesterday", ["b"]],
      ["earlier", ["d", "a"]],
    ],
  );
  assert.deepEqual(groupConversations([], NOW), [], "no empty headings");
  assert.deepEqual(
    sortConversations([{ id: "x", title: "", updatedAt: "garbage" }, list[2]]).map((c) => c.id),
    ["c", "x"],
    "an unreadable date sinks",
  );
});

test("search: every word, case and accents ignored, order kept", () => {
  const list = [
    { id: "1", title: "Trip to Zürich", updatedAt: 3 },
    { id: "2", title: "Zurich rent", updatedAt: 2 },
    { id: "3", title: "Paris", updatedAt: 1 },
  ];
  assert.deepEqual(
    filterConversations(list, "zurich").map((c) => c.id),
    ["1", "2"],
  );
  assert.deepEqual(
    filterConversations(list, "TRIP zür").map((c) => c.id),
    ["1"],
  );
  assert.deepEqual(
    filterConversations(list, "  ").map((c) => c.id),
    ["1", "2", "3"],
  );
  assert.deepEqual(filterConversations(list, "berlin"), []);
});

test("dates: the time today, the weekday this week, the date after", () => {
  const today = formatConversationDate(at(2026, 10, 27, 0, 5), NOW, "en-GB");
  assert.match(today, /^00:05$/);
  assert.equal(formatConversationDate(at(2026, 10, 24), NOW, "en-GB"), "Sat");
  assert.equal(formatConversationDate(at(2026, 3, 2), NOW, "en-GB"), "2 Mar");
  assert.equal(formatConversationDate(at(2025, 3, 2), NOW, "en-GB"), "2 Mar 2025");
  assert.equal(formatConversationDate("nonsense", NOW), "");
});

test("restore: the chat asked for, else the one that was open, only while it exists", () => {
  const list = [
    { id: "a", title: "", updatedAt: 1 },
    { id: "b", title: "", updatedAt: 2 },
  ];
  assert.equal(pickRestored(list, "b", "a"), "b");
  assert.equal(pickRestored(list, "gone", "a"), "a");
  assert.equal(pickRestored(list, null, "deleted-elsewhere"), null);
  assert.equal(pickRestored([], undefined, "a"), null);
});

/** A localStorage that behaves, with a byte quota. */
function fakeStorage(quota = Infinity) {
  const data = new Map();
  const size = () => [...data].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      const before = data.get(k);
      data.set(k, String(v));
      if (size() > quota) {
        if (before === undefined) data.delete(k);
        else data.set(k, before);
        const e = new Error("QuotaExceededError");
        e.name = "QuotaExceededError";
        throw e;
      }
    },
    removeItem: (k) => data.delete(k),
  };
}
const throwing = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("SecurityError");
  },
  removeItem() {
    throw new Error("SecurityError");
  },
};

test("local store: create, append, rename, remove — and it survives a reload", async () => {
  const storage = fakeStorage();
  const store = localConversationStore({ key: "t", storage });
  const c = await store.create({ title: "First" });
  await store.append(c.id, { id: "m1", role: "user", content: "hi" });
  await store.append(c.id, {
    id: "m2",
    role: "user",
    content: "see",
    attachments: [{ kind: "image", name: "shot.png", previewUrl: "data:image/png;base64,AAAA" }],
  });
  const second = await store.create();
  await store.rename(second.id, "Second");

  const reloaded = localConversationStore({ key: "t", storage });
  const list = await reloaded.list();
  assert.deepEqual(list.map((x) => x.title).sort(), ["First", "Second"]);
  const full = await reloaded.get(c.id);
  assert.equal(full.messages.length, 2);
  assert.deepEqual(
    full.messages[1].attachments,
    [{ kind: "image", name: "shot.png" }],
    "a picture is kept by name",
  );
  assert.ok(storage.data.has(`t:v${LOCAL_STORE_VERSION}`), "the key carries its version");

  await reloaded.remove(c.id);
  assert.equal(await reloaded.get(c.id), null);
  assert.equal((await localConversationStore({ key: "t", storage }).list()).length, 1);
});

test("local store: unreadable or foreign data reads as empty, never throws", async () => {
  const storage = fakeStorage();
  storage.setItem(`x:v${LOCAL_STORE_VERSION}`, "{not json");
  const store = localConversationStore({ key: "x", storage });
  assert.deepEqual(await store.list(), []);
  storage.setItem(
    `y:v${LOCAL_STORE_VERSION}`,
    JSON.stringify([{ id: 3 }, null, { id: "ok", title: "Fine", updatedAt: 1 }]),
  );
  assert.deepEqual(
    (await localConversationStore({ key: "y", storage }).list()).map((c) => c.id),
    ["ok"],
  );
});

test("local store: storage that throws (private mode, blocked) still works for the page", async () => {
  const store = localConversationStore({ key: "p", storage: throwing });
  const c = await store.create({ title: "In memory" });
  await store.append(c.id, { id: "m", role: "user", content: "still here" });
  await store.rename(c.id, "Renamed");
  assert.equal((await store.get(c.id)).messages[0].content, "still here");
  assert.equal((await store.list())[0].title, "Renamed");
  await store.remove(c.id);
  assert.deepEqual(await store.list(), []);
  const memory = memoryConversationStore();
  assert.equal((await memory.create({ title: "m" })).title, "m");
});

test("local store: a full quota drops the oldest chats, never the one being written", async () => {
  const storage = fakeStorage(2600);
  const store = localConversationStore({ key: "q", storage });
  const ids = [];
  for (let i = 0; i < 8; i++) {
    const c = await store.create({ title: `Chat ${i}` });
    ids.push(c.id);
    await store.append(c.id, { id: `m${i}`, role: "user", content: "x".repeat(300) });
    await new Promise((r) => setTimeout(r, 2));
  }
  const kept = await localConversationStore({ key: "q", storage }).list();
  assert.ok(kept.length >= 1 && kept.length < 8, `some evicted (${kept.length} kept)`);
  assert.equal(kept[0].id, ids[7], "the newest chat is kept");
  assert.ok(!kept.some((c) => c.id === ids[0]), "the oldest went first");
  const huge = await store.create({ title: "huge" });
  await store.append(huge.id, { id: "big", role: "user", content: "y".repeat(10_000) });
  assert.equal(
    (await store.get(huge.id)).messages[0].id,
    "big",
    "too big for the device: still in memory",
  );
});

test("local store: at most `limit` chats", async () => {
  const store = localConversationStore({ key: "l", storage: fakeStorage(), limit: 3 });
  for (let i = 0; i < 5; i++) await store.create({ title: String(i) });
  assert.equal((await store.list()).length, 3);
});

test("http store: the documented REST shape", async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push(`${init.method} ${url}${init.body ? ` ${init.body}` : ""}`);
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (init.method === "GET" && url === "/api/conversations")
      return json({
        conversations: [
          { id: "a", title: "A", updatedAt: "2026-10-01T00:00:00Z" },
          { id: "b", title: "B", updatedAt: "2026-10-02T00:00:00Z" },
        ],
      });
    if (init.method === "GET" && url === "/api/conversations/a")
      return json({
        conversation: { id: "a", title: "A", updatedAt: 1 },
        messages: [{ id: "m", role: "user", content: "hi" }],
      });
    if (init.method === "GET") return new Response("", { status: 404 });
    if (init.method === "POST" && url === "/api/conversations")
      return json({ conversation: { id: "new", title: "T", updatedAt: 2 } }, 201);
    if (url.endsWith("/boom")) return new Response("", { status: 500 });
    return json({ ok: true });
  };
  const store = httpConversationStore({
    baseUrl: "/api/conversations/",
    fetch,
    headers: () => ({ "x-k": "1" }),
  });
  assert.deepEqual(
    (await store.list()).map((c) => c.id),
    ["b", "a"],
    "newest first",
  );
  assert.equal((await store.get("a")).messages[0].content, "hi");
  assert.equal(await store.get("gone"), null);
  assert.equal((await store.create({ title: "T" })).id, "new");
  await store.append("a", { id: "m2", role: "assistant", content: "yo" });
  await store.rename("a", "Renamed");
  await store.remove("a");
  await assert.rejects(store.remove("boom"), /DELETE \/api\/conversations\/boom answered 500/);
  assert.deepEqual(calls.slice(3), [
    'POST /api/conversations {"title":"T"}',
    'POST /api/conversations/a/messages {"message":{"id":"m2","role":"assistant","content":"yo"}}',
    'PATCH /api/conversations/a {"title":"Renamed"}',
    "DELETE /api/conversations/a",
    "DELETE /api/conversations/boom",
  ]);
  const quiet = httpConversationStore({ baseUrl: "/api/c", fetch, serverWritesTurns: true });
  const before = calls.length;
  await quiet.append("a", { id: "x", role: "user", content: "" });
  assert.equal(calls.length, before, "a server that writes its own turns gets no second copy");
});

test("copy: the device's chats into the account, newest stays newest", async () => {
  const from = memoryConversationStore();
  const a = await from.create({ title: "older" });
  await from.append(a.id, { id: "1", role: "user", content: "a" });
  await new Promise((r) => setTimeout(r, 2));
  const b = await from.create({ title: "newer" });
  await from.append(b.id, { id: "2", role: "user", content: "b" });
  await from.create({ title: "empty" });
  const to = memoryConversationStore();
  assert.equal(await copyConversations(from, to), 2, "an empty chat is not copied");
  await new Promise((r) => setTimeout(r, 2));
  assert.deepEqual(
    (await to.list()).map((c) => c.title),
    ["newer", "older"],
  );
});

test("ChatApp renders on the server: header, composer with Camera · Photos · Files", () => {
  const html = renderToStaticMarkup(
    h(ChatApp, { transport: async () => "ok", store: memoryConversationStore(), name: "Loki" }),
  );
  assert.match(html, /aria-label="Open your chats"/);
  assert.match(html, /aria-label="New chat"/);
  assert.match(html, /aria-label="More for this chat"/);
  assert.match(html, /data-ck-source="camera"/, "attachments on by default");
  assert.match(html, />Loki</);
  assert.ok(isTemporaryId("tmp-1") && !isTemporaryId("abc"));
});

test("chat list: one anatomy per row, groups, the search, an honest empty state", () => {
  const list = [
    { id: "a", title: "Gallium", updatedAt: Date.now() },
    { id: "b", title: "", updatedAt: Date.now() - 86_400_000 * 3 },
  ];
  const props = {
    conversations: list,
    state: "ready",
    activeId: "a",
    busyIds: new Set(["b"]),
    onOpen() {},
    onNew() {},
    onRename() {},
    onRemove() {},
    onRetry() {},
    labels: DEFAULT_CHAT_APP_LABELS,
  };
  const html = renderToStaticMarkup(h(ChatHistory, props));
  assert.match(html, />Today</);
  assert.match(html, />Earlier</);
  assert.equal((html.match(/class="ck-history-more"/g) ?? []).length, 2, "one … per row");
  assert.match(html, /aria-current="page"/);
  assert.match(html, />New chat</, "an untitled chat says so");
  assert.match(html, />Answering…</, "a busy chat says it is answering");
  assert.match(html, /type="search"/);
  const empty = renderToStaticMarkup(h(ChatHistory, { ...props, conversations: [] }));
  assert.match(empty, /No chats yet/);
  const failed = renderToStaticMarkup(h(ChatHistory, { ...props, state: "error" }));
  assert.match(failed, /Try again/);
});
