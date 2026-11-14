// The Messenger's decisions, without a DOM: what a thread groups, what the
// list says, what an arriving message does to the state. The screen is
// checked in test/browser-messenger.mjs; these are the rules it draws from.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MessengerError,
  attachmentSummary,
  conversationPreview,
  conversationTitle,
  dayLabel,
  failureText,
  fitMedia,
  formatBytes,
  formatDuration,
  initialMessengerState,
  isAgent,
  linkify,
  listTime,
  mentionedAgents,
  messengerReducer,
  needsNames,
  readMarkToSend,
  receiptOf,
  refusalText,
  reviveConversation,
  reviveMessage,
  searchConversations,
  sessionDrafts,
  soleAgent,
  threadItems,
  typingLabel,
  withMention,
} from "../dist/index.js";

const T = (iso) => new Date(iso);
const START = T("2026-11-01T00:00:00Z");
const person = (actorId, name, extra = {}) => ({
  actorId,
  kind: "human",
  name,
  joinedAt: START,
  visibleFrom: "thread-start",
  ...extra,
});
const CAT = { id: "cat", name: "Cat", mention: "@cat" };
const catSeat = {
  actorId: "cat",
  kind: "ai",
  name: "Cat",
  joinedAt: START,
  visibleFrom: "thread-start",
};
const dm = (extra = {}) => ({
  id: "c1",
  createdAt: START,
  participants: [person("me", "Georgy"), person("maya", "Maya Keller", { handle: "maya" })],
  ...extra,
});
const msg = (id, authorId, body, at, extra = {}) => ({
  id,
  threadId: "c1",
  authorId,
  body,
  createdAt: T(at),
  ...extra,
});
const TITLES = { self: "Notes to self", more: "{names} and {n} more" };
const PREVIEW = {
  you: "You: ",
  photo: "Photo",
  photos: "{n} photos",
  video: "Video",
  audio: "Audio",
  file: "File",
  attachments: "{n} attachments",
  empty: "No messages yet",
};

// ── who is who ──

test("an agent is an agent by its seat or by the product naming it, never a person", () => {
  const joined = dm({ participants: [...dm().participants, catSeat] });
  assert.equal(isAgent(joined, "cat"), true, "its participant row says so");
  assert.equal(isAgent(dm(), "cat", [CAT]), true, "named by the product before it has a seat");
  assert.equal(isAgent(joined, "maya", [CAT]), false);
});

test("a conversation with a person is called by the person, also after an agent joins", () => {
  assert.equal(conversationTitle(dm(), "me", TITLES), "Maya Keller");
  const joined = dm({ participants: [...dm().participants, catSeat] });
  assert.equal(conversationTitle(joined, "me", TITLES, [CAT]), "Maya Keller");
  assert.equal(conversationTitle(dm({ subject: "Weekend hike" }), "me", TITLES), "Weekend hike");
});

test("alone with an agent the conversation is the agent's; alone, it is notes to self", () => {
  const withCat = dm({ participants: [person("me", "Georgy"), catSeat] });
  assert.equal(conversationTitle(withCat, "me", TITLES, [CAT]), "Cat");
  assert.equal(
    conversationTitle(dm({ participants: [person("me", "G")] }), "me", TITLES),
    "Notes to self",
  );
});

test("many people are named up to three, then counted", () => {
  const many = dm({
    participants: [
      person("me", "G"),
      person("a", "Ada"),
      person("b", "Ben"),
      person("c", "Cy"),
      person("d", "Dee"),
    ],
  });
  assert.equal(conversationTitle(many, "me", TITLES), "Ada, Ben and 2 more");
});

test("names are shown once more than one other voice is present — an agent counts", () => {
  assert.equal(needsNames(dm(), "me"), false, "two people: it is plain who wrote what");
  assert.equal(needsNames(dm({ participants: [...dm().participants, catSeat] }), "me"), true);
});

// ── the list ──

test("a row's second line is the newest message, the viewer's own marked", () => {
  const last = { body: "See  you\nthere", authorId: "maya", createdAt: START };
  assert.equal(conversationPreview(dm({ last }), "me", PREVIEW), "See you there");
  assert.equal(
    conversationPreview(dm({ last: { ...last, authorId: "me" } }), "me", PREVIEW),
    "You: See you there",
  );
  assert.equal(conversationPreview(dm({ last: null }), "me", PREVIEW), "No messages yet");
});

test("a message of only files is named by what it carries", () => {
  assert.equal(attachmentSummary(["image"], PREVIEW), "Photo");
  assert.equal(attachmentSummary(["image", "image", "image"], PREVIEW), "3 photos");
  assert.equal(attachmentSummary(["video"], PREVIEW), "Video");
  assert.equal(attachmentSummary(["image", "file"], PREVIEW), "2 attachments");
  const last = { body: "", authorId: "me", createdAt: START, attachments: ["image", "image"] };
  assert.equal(conversationPreview(dm({ last }), "me", PREVIEW), "You: 2 photos");
});

test("search finds every word in names and the newest message, accents ignored", () => {
  const list = [
    dm({ id: "a", participants: [person("me", "G"), person("z", "Zoë Brandt")] }),
    dm({ id: "b", last: { body: "the invoice is paid", authorId: "maya", createdAt: START } }),
  ];
  const title = (c) => conversationTitle(c, "me", TITLES);
  assert.deepEqual(
    searchConversations(list, "zoe", title).map((c) => c.id),
    ["a"],
  );
  assert.deepEqual(
    searchConversations(list, "maya invoice", title).map((c) => c.id),
    ["b"],
  );
  assert.equal(searchConversations(list, "   ", title).length, 2);
});

// ── the thread ──

test("messages by one author close in time are one run; five minutes apart are two", () => {
  const items = threadItems(
    [
      msg("1", "maya", "a", "2026-11-10T10:00:00Z"),
      msg("2", "maya", "b", "2026-11-10T10:04:00Z"),
      msg("3", "maya", "c", "2026-11-10T10:10:00Z"),
      msg("4", "me", "d", "2026-11-10T10:10:30Z"),
    ],
    { viewerId: "me", timeZone: "UTC" },
  );
  assert.deepEqual(
    items.map((i) => (i.type === "run" ? i.messages.map((m) => m.id).join("+") : i.type)),
    ["day", "1+2", "3", "4"],
  );
  assert.equal(items[3].own, true);
});

test("a new day starts a new run and gets its line — in the reader's time zone", () => {
  const messages = [
    msg("1", "maya", "late", "2026-11-10T22:59:00Z"),
    msg("2", "maya", "later", "2026-11-10T23:01:00Z"),
  ];
  const utc = threadItems(messages, { viewerId: "me", timeZone: "UTC" });
  assert.equal(utc.filter((i) => i.type === "day").length, 1);
  const zurich = threadItems(messages, { viewerId: "me", timeZone: "Europe/Zurich" });
  assert.equal(
    zurich.filter((i) => i.type === "day").length,
    2,
    "midnight in Zürich falls between them",
  );
});

test("the New line sits before the first message the viewer had not read", () => {
  const messages = [
    msg("1", "maya", "old", "2026-11-10T10:00:00Z"),
    msg("2", "me", "mine", "2026-11-10T10:30:00Z"),
    msg("3", "maya", "new", "2026-11-10T11:00:00Z"),
    msg("4", "maya", "newer", "2026-11-10T11:01:00Z"),
  ];
  const items = threadItems(messages, {
    viewerId: "me",
    timeZone: "UTC",
    unreadFrom: T("2026-11-10T10:15:00Z"),
  });
  const kinds = items.map((i) => (i.type === "run" ? i.messages[0].id : i.type));
  assert.deepEqual(kinds, ["day", "1", "2", "unread", "3"]);
});

test("a thread that is entirely new gets no New line: there is nothing above it", () => {
  const items = threadItems([msg("1", "maya", "hello", "2026-11-10T10:00:00Z")], {
    viewerId: "me",
    timeZone: "UTC",
    unreadFrom: T("2026-11-01T00:00:00Z"),
  });
  assert.equal(
    items.some((i) => i.type === "unread"),
    false,
  );
});

test("an agent's answers to two different people are two runs", () => {
  const items = threadItems(
    [
      msg("1", "cat", "for you", "2026-11-10T10:00:00Z", { onBehalfOf: "me" }),
      msg("2", "cat", "for her", "2026-11-10T10:01:00Z", { onBehalfOf: "maya" }),
    ],
    { viewerId: "me", timeZone: "UTC" },
  );
  assert.equal(items.filter((i) => i.type === "run").length, 2);
});

test("days read Today, Yesterday, a weekday, then a date", () => {
  const now = T("2026-11-12T12:00:00Z");
  const days = { today: "Today", yesterday: "Yesterday" };
  assert.equal(dayLabel(T("2026-11-12T01:00:00Z"), now, days, "en-GB", "UTC"), "Today");
  assert.equal(dayLabel(T("2026-11-11T23:00:00Z"), now, days, "en-GB", "UTC"), "Yesterday");
  assert.equal(dayLabel(T("2026-11-09T12:00:00Z"), now, days, "en-GB", "UTC"), "Monday");
  assert.equal(dayLabel(T("2026-10-01T12:00:00Z"), now, days, "en-GB", "UTC"), "1 October");
  assert.equal(dayLabel(T("2025-10-01T12:00:00Z"), now, days, "en-GB", "UTC"), "1 October 2025");
  assert.equal(listTime(T("2026-11-12T06:24:00Z"), now, days, "en-GB", "UTC"), "06:24");
  assert.equal(listTime(T("2026-11-11T06:24:00Z"), now, days, "en-GB", "UTC"), "Yesterday");
});

// ── words in a bubble ──

test("an address becomes a link; nothing else does", () => {
  assert.deepEqual(linkify("see https://example.org/a?b=1."), [
    { type: "text", text: "see " },
    { type: "link", text: "https://example.org/a?b=1", href: "https://example.org/a?b=1" },
    { type: "text", text: "." },
  ]);
  assert.equal(linkify("www.example.org")[0].href, "https://www.example.org");
  assert.deepEqual(linkify("javascript:alert(1) and e.g. this"), [
    { type: "text", text: "javascript:alert(1) and e.g. this" },
  ]);
  assert.equal(linkify("(https://example.org/x)")[1].text, "https://example.org/x");
  assert.equal(
    linkify("https://en.wikipedia.org/wiki/Penguin_(bird)")[0].text,
    "https://en.wikipedia.org/wiki/Penguin_(bird)",
    "a bracket the address opened belongs to it",
  );
});

// ── agents ──

test("an agent is called by its whole mention, and the mention is added once", () => {
  assert.deepEqual(
    mentionedAgents("@cat who is right?", [CAT]).map((a) => a.id),
    ["cat"],
  );
  assert.deepEqual(mentionedAgents("see the @catalogue", [CAT]), []);
  assert.equal(withMention("who is right?", "@cat"), "@cat who is right?");
  assert.equal(withMention("", "@cat"), "@cat ");
  assert.equal(withMention("hey @cat", "@cat"), "hey @cat");
});

test("typing is one name, two names, or several", () => {
  const labels = {
    one: "{name} is typing…",
    two: "{a} and {b} are typing…",
    several: "Several people are typing…",
  };
  assert.equal(typingLabel([], labels), "");
  assert.equal(typingLabel(["Maya"], labels), "Maya is typing…");
  assert.equal(typingLabel(["Maya", "Ben"], labels), "Maya and Ben are typing…");
  assert.equal(typingLabel(["a", "b", "c"], labels), "Several people are typing…");
});

// ── files ──

test("sizes and lengths read the way a person says them", () => {
  assert.equal(formatBytes(900), "1 KB");
  assert.equal(formatBytes(640 * 1024), "640 KB");
  assert.equal(formatBytes(1.5 * 1024 * 1024), "1.5 MB");
  assert.equal(formatBytes(50 * 1024 * 1024), "50 MB");
  assert.equal(formatDuration(42_000), "0:42");
  assert.equal(formatDuration(725_000), "12:05");
  assert.equal(formatDuration(3_723_000), "1:02:03");
});

test("a refusal says the number the person needs", () => {
  const labels = {
    type: "{name} cannot be sent here.",
    size: "{name} is too large (max {max}).",
    count: "Up to {max} files in one message.",
    quota: "Your storage is full ({used} of {quota}).",
    empty: "{name} is empty.",
  };
  assert.equal(
    refusalText({ ok: false, reason: "type" }, "a.exe", labels),
    "a.exe cannot be sent here.",
  );
  assert.equal(
    refusalText(
      { ok: false, reason: "size", kind: "video", maxBytes: 50 * 1024 * 1024 },
      "film.mp4",
      labels,
    ),
    "film.mp4 is too large (max 50 MB).",
  );
  assert.equal(
    refusalText({ ok: false, reason: "count", maxPerMessage: 10 }, "x", labels),
    "Up to 10 files in one message.",
  );
  assert.match(
    refusalText(
      { ok: false, reason: "quota", quotaBytes: 1024 ** 3, usedBytes: 1023 * 1024 * 1024 },
      "x",
      labels,
    ),
    /1023 MB of 1\.0 GB/,
  );
});

test("a picture's box is known before it loads, and never enlarged", () => {
  assert.deepEqual(fitMedia(1200, 900, 288, 360), { width: 288, height: 216 });
  assert.deepEqual(fitMedia(900, 1200, 288, 360), { width: 270, height: 360 });
  assert.deepEqual(fitMedia(100, 80, 288, 360), { width: 100, height: 80 });
  assert.equal(fitMedia(undefined, 80, 288, 360), null);
});

// ── reading what a server sent ──

test("dates sent as text become dates, and a broken one never becomes Invalid Date", () => {
  const m = reviveMessage({
    id: "1",
    threadId: "c1",
    authorId: "a",
    body: "x",
    createdAt: "2026-11-10T10:00:00Z",
    editedAt: null,
  });
  assert.ok(m.createdAt instanceof Date);
  assert.equal(m.editedAt, undefined);
  assert.equal(
    reviveMessage({
      id: "1",
      threadId: "c",
      authorId: "a",
      body: "",
      createdAt: "nonsense",
    }).createdAt.getTime(),
    0,
  );
  const c = reviveConversation({
    id: "c1",
    createdAt: "2026-11-01T00:00:00Z",
    participants: [
      {
        actorId: "me",
        kind: "human",
        name: "G",
        joinedAt: "2026-11-01T00:00:00Z",
        lastReadAt: "2026-11-02T00:00:00Z",
        visibleFrom: "thread-start",
      },
    ],
    last: { body: "x", authorId: "me", createdAt: "2026-11-03T00:00:00Z" },
  });
  assert.ok(c.participants[0].lastReadAt instanceof Date);
  assert.equal(c.participants[0].visibleFrom, "thread-start");
  assert.ok(c.last.createdAt instanceof Date);
});

test("a transport's own words reach the person; anything else gets the package's", () => {
  assert.equal(
    failureText(new MessengerError("You are sending too fast."), "fallback"),
    "You are sending too fast.",
  );
  assert.equal(failureText(new Error("ECONNRESET"), "fallback"), "fallback");
  assert.equal(failureText(null, "fallback"), "fallback");
});

test("a draft is kept per conversation", () => {
  const drafts = sessionDrafts();
  drafts.set("a", "half a thought");
  assert.equal(drafts.get("a"), "half a thought");
  assert.equal(drafts.get("b"), "");
  drafts.set("a", "");
  assert.equal(drafts.get("a"), "");
});

// ── the state ──

const ready = (conversations = [dm()]) =>
  messengerReducer(initialMessengerState("me"), { type: "list-loaded", conversations });
const opened = (state, id = "c1", messages = []) =>
  messengerReducer(messengerReducer(state, { type: "open", id }), {
    type: "thread-loaded",
    id,
    messages,
    before: null,
  });

test("a message that arrives twice — sent, stored, pushed — is shown once", () => {
  let s = opened(ready());
  const optimistic = msg("tmp-1", "me", "hello", "2026-11-10T10:00:00Z", {
    clientId: "tmp-1",
    delivery: "sending",
  });
  s = messengerReducer(s, { type: "message", message: optimistic, seen: true });
  assert.equal(s.threads.c1.messages[0].delivery, "sending");
  const stored = msg("srv-9", "me", "hello", "2026-11-10T10:00:01Z", { clientId: "tmp-1" });
  s = messengerReducer(s, { type: "message", message: stored, seen: true });
  s = messengerReducer(s, { type: "message", message: stored, seen: true });
  assert.equal(s.threads.c1.messages.length, 1);
  assert.equal(s.threads.c1.messages[0].id, "srv-9");
  assert.equal(s.threads.c1.messages[0].delivery, undefined);
});

test("a send that fails keeps the message, marked, and nobody is awaited", () => {
  let s = opened(ready());
  const optimistic = msg("tmp-1", "me", "@cat hello", "2026-11-10T10:00:00Z", {
    clientId: "tmp-1",
    delivery: "sending",
  });
  s = messengerReducer(s, { type: "message", message: optimistic, seen: true, agents: [CAT] });
  assert.deepEqual(s.awaited.c1, [{ agentId: "cat", state: "thinking" }]);
  s = messengerReducer(s, { type: "send-failed", conversationId: "c1", clientId: "tmp-1" });
  assert.equal(s.threads.c1.messages[0].delivery, "failed");
  assert.deepEqual(s.awaited.c1, []);
});

test("a message elsewhere raises that row's count and moves it to the top; looking at it does not", () => {
  const other = dm({
    id: "c2",
    participants: [person("me", "G"), person("ben", "Ben")],
    last: { body: "old", authorId: "ben", createdAt: T("2026-11-01T00:00:00Z") },
  });
  let s = ready([
    dm({ last: { body: "x", authorId: "maya", createdAt: T("2026-11-09T00:00:00Z") } }),
    other,
  ]);
  assert.equal(s.conversations[0].id, "c1");
  s = messengerReducer(s, {
    type: "message",
    message: { ...msg("9", "ben", "hi", "2026-11-10T10:00:00Z"), threadId: "c2" },
    seen: false,
  });
  assert.equal(s.conversations[0].id, "c2");
  assert.equal(s.conversations[0].unread, 1);
  assert.equal(s.conversations[0].last.body, "hi");
  s = messengerReducer(s, {
    type: "message",
    message: { ...msg("10", "ben", "there?", "2026-11-10T10:01:00Z"), threadId: "c2" },
    seen: true,
  });
  assert.equal(s.conversations[0].unread, 0, "a message the viewer is looking at is read");
});

test("the viewer's own message never counts as unread", () => {
  let s = ready();
  s = messengerReducer(s, {
    type: "message",
    message: msg("1", "me", "from my other phone", "2026-11-10T10:00:00Z"),
    seen: false,
  });
  assert.equal(s.conversations[0].unread ?? 0, 0);
});

test("naming an agent starts the wait; its answer ends it; an agent naming an agent does not start one", () => {
  let s = opened(ready());
  s = messengerReducer(s, {
    type: "message",
    message: msg("1", "maya", "@cat who is right?", "2026-11-10T10:00:00Z"),
    seen: true,
    agents: [CAT],
  });
  assert.deepEqual(s.awaited.c1, [{ agentId: "cat", state: "thinking" }]);
  s = messengerReducer(s, { type: "agent-quiet", conversationId: "c1", agentId: "cat" });
  assert.equal(s.awaited.c1[0].state, "quiet");
  s = messengerReducer(s, {
    type: "message",
    message: msg("2", "cat", "Maya. Ask @cat again any time.", "2026-11-10T10:00:05Z"),
    seen: true,
    agents: [CAT],
  });
  assert.deepEqual(s.awaited.c1, []);
});

test("a read mark moves forward only, and the viewer's own clears the badge", () => {
  let s = ready([dm({ unread: 3 })]);
  s = messengerReducer(s, {
    type: "read",
    conversationId: "c1",
    actorId: "maya",
    at: T("2026-11-10T10:00:00Z"),
  });
  s = messengerReducer(s, {
    type: "read",
    conversationId: "c1",
    actorId: "maya",
    at: T("2026-11-09T10:00:00Z"),
  });
  const maya = s.conversations[0].participants.find((p) => p.actorId === "maya");
  assert.equal(maya.lastReadAt.toISOString(), "2026-11-10T10:00:00.000Z");
  assert.equal(s.conversations[0].unread, 3);
  s = messengerReducer(s, {
    type: "read",
    conversationId: "c1",
    actorId: "me",
    at: T("2026-11-10T11:00:00Z"),
  });
  assert.equal(s.conversations[0].unread, 0);
});

test("the New line stays where it was drawn while the thread is open", () => {
  let s = ready([
    dm({
      participants: [
        person("me", "G", { lastReadAt: T("2026-11-10T09:00:00Z") }),
        person("maya", "Maya"),
      ],
    }),
  ]);
  s = opened(s);
  assert.equal(s.threads.c1.unreadFrom.toISOString(), "2026-11-10T09:00:00.000Z");
  s = messengerReducer(s, {
    type: "read",
    conversationId: "c1",
    actorId: "me",
    at: T("2026-11-10T12:00:00Z"),
  });
  assert.equal(s.threads.c1.unreadFrom.toISOString(), "2026-11-10T09:00:00.000Z");
});

test("a refresh that shares nothing with what is shown replaces it, keeping unsent messages", () => {
  let s = opened(ready(), "c1", [msg("1", "maya", "old", "2026-11-01T10:00:00Z")]);
  s = messengerReducer(s, {
    type: "message",
    message: msg("tmp-2", "me", "unsent", "2026-11-10T09:00:00Z", {
      clientId: "tmp-2",
      delivery: "failed",
    }),
    seen: true,
  });
  s = messengerReducer(s, {
    type: "thread-loaded",
    id: "c1",
    messages: [msg("50", "maya", "much later", "2026-11-10T10:00:00Z")],
    before: "50",
  });
  assert.deepEqual(
    s.threads.c1.messages.map((m) => m.id),
    ["tmp-2", "50"],
  );
  assert.equal(s.threads.c1.before, "50", "the page before it can still be loaded");
});

test("a refresh that joins what is shown keeps how far back the reader went", () => {
  let s = opened(ready(), "c1", [
    msg("1", "maya", "a", "2026-11-01T10:00:00Z"),
    msg("2", "maya", "b", "2026-11-02T10:00:00Z"),
  ]);
  s = messengerReducer(s, {
    type: "thread-loaded",
    id: "c1",
    messages: [
      msg("2", "maya", "b", "2026-11-02T10:00:00Z"),
      msg("3", "maya", "c", "2026-11-03T10:00:00Z"),
    ],
    before: "2",
  });
  assert.deepEqual(
    s.threads.c1.messages.map((m) => m.id),
    ["1", "2", "3"],
  );
  assert.equal(s.threads.c1.before, null);
});

test("a list that fails to refresh keeps what is on screen; typing never names the viewer", () => {
  let s = ready();
  s = messengerReducer(s, { type: "list-failed" });
  assert.equal(s.status, "ready");
  assert.equal(
    messengerReducer(initialMessengerState("me"), { type: "list-failed" }).status,
    "failed",
  );
  s = messengerReducer(s, { type: "typing", conversationId: "c1", actorId: "me", typing: true });
  assert.deepEqual(s.typing.c1 ?? [], []);
  s = messengerReducer(s, { type: "typing", conversationId: "c1", actorId: "maya", typing: true });
  assert.deepEqual(s.typing.c1, ["maya"]);
  s = messengerReducer(s, {
    type: "message",
    message: msg("1", "maya", "done", "2026-11-10T10:00:00Z"),
    seen: true,
  });
  assert.deepEqual(s.typing.c1, [], "a message ends its author's typing");
});

test("the read mark is sent only for somebody else's newer message", () => {
  const c = dm({
    participants: [
      person("me", "G", { lastReadAt: T("2026-11-10T10:00:00Z") }),
      person("maya", "M"),
    ],
  });
  assert.equal(readMarkToSend(c, [msg("1", "maya", "old", "2026-11-10T09:00:00Z")], "me"), null);
  assert.equal(readMarkToSend(c, [msg("1", "me", "mine", "2026-11-10T11:00:00Z")], "me"), null);
  assert.equal(
    readMarkToSend(c, [msg("1", "maya", "new", "2026-11-10T11:00:00Z")], "me").toISOString(),
    "2026-11-10T11:00:00.000Z",
  );
});

test("leaving a conversation closes it and forgets its thread", () => {
  let s = opened(ready());
  s = messengerReducer(s, { type: "conversation-removed", conversationId: "c1" });
  assert.equal(s.openId, null);
  assert.equal(s.conversations.length, 0);
  assert.equal(s.threads.c1, undefined);
});

// ── replies, reactions, cards ──

test("a quote carries one line of the message it answers", async () => {
  const { quoteOf, quoteText, QUOTE_MAX } = await import("../dist/index.js");
  const at = new Date("2026-11-13T10:00:00Z");
  const long = quoteOf({
    id: "a",
    threadId: "t",
    authorId: "maya",
    body: `first line\nsecond   line ${"x".repeat(200)}`,
    createdAt: at,
  });
  assert.equal(long.id, "a");
  assert.equal(long.authorId, "maya");
  assert.ok(long.body.startsWith("first line second line"));
  assert.ok(long.body.length <= QUOTE_MAX && long.body.endsWith("…"));

  const photo = quoteOf({
    id: "b",
    threadId: "t",
    authorId: "maya",
    body: "",
    createdAt: at,
    attachments: [
      { id: "f", kind: "image", name: "a.jpg", mimeType: "image/jpeg", bytes: 1, url: "/a" },
    ],
  });
  const labels = {
    you: "You: ",
    photo: "Photo",
    photos: "{n} photos",
    video: "Video",
    audio: "Audio",
    file: "File",
    attachments: "{n} attachments",
    empty: "No messages yet",
  };
  assert.equal(quoteText(photo, labels), "Photo");
  assert.equal(quoteText(long, labels), long.body);
});

test("one reaction per person: a second choice replaces the first, the same one takes it off", async () => {
  const { withReaction, reactionOf } = await import("../dist/index.js");
  let r = withReaction(undefined, "me", "👍");
  assert.deepEqual(r, [{ emoji: "👍", actorIds: ["me"] }]);
  r = withReaction(r, "maya", "👍");
  r = withReaction(r, "ben", "❤️");
  assert.deepEqual(r, [
    { emoji: "👍", actorIds: ["me", "maya"] },
    { emoji: "❤️", actorIds: ["ben"] },
  ]);
  r = withReaction(r, "me", "❤️");
  assert.deepEqual(r, [
    { emoji: "👍", actorIds: ["maya"] },
    { emoji: "❤️", actorIds: ["ben", "me"] },
  ]);
  assert.equal(reactionOf(r, "me"), "❤️");
  r = withReaction(r, "maya", null);
  assert.deepEqual(r, [{ emoji: "❤️", actorIds: ["ben", "me"] }]);
  assert.equal(reactionOf(r, "maya"), null);
});

test("a reactions event replaces the reactions of that message only", () => {
  const at = new Date("2026-11-13T10:00:00Z");
  let state = initialMessengerState("me");
  state = messengerReducer(state, {
    type: "list-loaded",
    conversations: [{ id: "t", createdAt: at, participants: [] }],
  });
  state = messengerReducer(state, { type: "open", id: "t" });
  state = messengerReducer(state, {
    type: "thread-loaded",
    id: "t",
    before: null,
    messages: [
      { id: "a", threadId: "t", authorId: "maya", body: "one", createdAt: at },
      { id: "b", threadId: "t", authorId: "maya", body: "two", createdAt: at },
    ],
  });
  state = messengerReducer(state, {
    type: "reactions",
    conversationId: "t",
    messageId: "b",
    reactions: [{ emoji: "👍", actorIds: ["me"] }],
  });
  const [a, b] = state.threads.t.messages;
  assert.equal(a.reactions, undefined);
  assert.deepEqual(b.reactions, [{ emoji: "👍", actorIds: ["me"] }]);
});

test("a voice message is recorded in what the browser can record, and named so it can be found", async () => {
  const { voiceMimeType, voiceFileName } = await import("../dist/react/messenger.js");
  assert.equal(
    voiceMimeType(() => true),
    "audio/webm;codecs=opus",
  );
  assert.equal(
    voiceMimeType((t) => t === "audio/mp4"),
    "audio/mp4",
  );
  assert.equal(
    voiceMimeType(() => false),
    null,
  );
  const at = new Date(2026, 10, 13, 20, 4);
  assert.equal(voiceFileName(at, "audio/webm;codecs=opus"), "voice-2026-11-13-2004.webm");
  assert.equal(voiceFileName(at, "audio/mp4"), "voice-2026-11-13-2004.m4a");
});

// ── Alone with an agent ─────────────────────────────────────────────────────

const catDm = (extra = {}) => ({
  id: "c1",
  createdAt: START,
  participants: [person("me", "Georgy"), { ...catSeat, ...extra }],
});

test("alone with an agent: it is the sole agent; with a second person, or a person only, nobody is", () => {
  assert.equal(soleAgent(catDm(), "me", [CAT])?.actorId, "cat");
  assert.equal(soleAgent(catDm(), "me")?.actorId, "cat", "its seat says it is an agent");
  assert.equal(soleAgent(dm(), "me", [CAT]), undefined);
  assert.equal(
    soleAgent({ ...dm(), participants: [...dm().participants, catSeat] }, "me", [CAT]),
    undefined,
  );
  assert.equal(soleAgent(undefined, "me", [CAT]), undefined);
});

test("alone with an agent, a message starts the wait without naming it; files alone do not", () => {
  let s = opened(ready([catDm()]));
  s = messengerReducer(s, {
    type: "message",
    message: msg("1", "me", "hello", "2026-11-10T10:00:00Z"),
    seen: true,
    agents: [CAT],
  });
  assert.deepEqual(s.awaited.c1, [{ agentId: "cat", state: "thinking" }]);
  s = messengerReducer(s, {
    type: "message",
    message: msg("2", "cat", "Hello.", "2026-11-10T10:00:05Z"),
    seen: true,
    agents: [CAT],
  });
  assert.deepEqual(s.awaited.c1, []);
  s = messengerReducer(s, {
    type: "message",
    message: msg("3", "me", "", "2026-11-10T10:01:00Z"),
    seen: true,
    agents: [CAT],
  });
  assert.deepEqual(s.awaited.c1, []);
  // With a person in the room an unnamed agent is not waited for.
  let t = opened(ready([{ ...dm(), participants: [...dm().participants, catSeat] }]));
  t = messengerReducer(t, {
    type: "message",
    message: msg("1", "me", "hello", "2026-11-10T10:00:00Z"),
    seen: true,
    agents: [CAT],
  });
  assert.deepEqual(t.awaited.c1, []);
});

test("a message to an agent alone is read once the agent's read mark is past it", () => {
  const sent = msg("1", "me", "hello", "2026-11-10T10:00:00Z");
  assert.equal(receiptOf(catDm(), sent, [CAT]), "none");
  assert.equal(receiptOf(catDm({ lastReadAt: T("2026-11-10T09:00:00Z") }), sent, [CAT]), "none");
  assert.equal(receiptOf(catDm({ lastReadAt: T("2026-11-10T10:00:05Z") }), sent, [CAT]), "all");
  // Where a person can read it, the person decides and the agent is not waited for.
  const withMaya = (readAt) => ({
    ...dm(),
    participants: [
      person("me", "Georgy"),
      person("maya", "Maya Keller", readAt ? { lastReadAt: T(readAt) } : {}),
      { ...catSeat, lastReadAt: T("2026-11-10T10:00:05Z") },
    ],
  });
  assert.equal(receiptOf(withMaya(null), sent, [CAT]), "none");
  assert.equal(receiptOf(withMaya("2026-11-10T10:00:05Z"), sent, [CAT]), "all");
  // Notes to self: nobody to read it.
  assert.equal(receiptOf({ ...dm(), participants: [person("me", "Georgy")] }, sent), "none");
});
