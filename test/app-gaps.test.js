// What the first four products to adopt ChatApp could not do with it (0.19):
// each test is one gap a product had to work around in its own code.
// Behaviour that needs a running React (the send handle, Retry with the
// pictures, Stop dropping an unchecked half answer, StrictMode, a temporary
// chat ending) is driven in a real browser by test/browser-app.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { memoryConversationStore } from "../dist/index.js";
import {
  AttachMenu,
  ChatApp,
  ChatHistory,
  ChatMessage,
  ChatStarters,
  ChatThread,
  ChatTurnError,
  Composer,
  DEFAULT_CHAT_APP_LABELS,
  chatTurnFailure,
  starterParts,
  takeDeepLink,
} from "../dist/react/index.js";

test("send handle: ChatApp takes a ref (forwardRef) and still renders on the server", () => {
  const ref = { current: null };
  const html = renderToStaticMarkup(
    h(ChatApp, {
      ref,
      transport: async () => "ok",
      store: memoryConversationStore(),
      initialMessage: { text: "from the home box" },
      deepLinkParam: "q",
    }),
  );
  assert.match(html, /class="ck-input"/);
  // Nothing is sent or filled on the server: the arrival waits for the list.
  assert.doesNotMatch(html, /from the home box/);
});

test("deep link: the words and the address without them; nothing when absent", () => {
  assert.deepEqual(takeDeepLink("https://x.ch/chat?q=Hello%20there&tab=2#a", "q"), {
    text: "Hello there",
    href: "https://x.ch/chat?tab=2#a",
  });
  assert.equal(takeDeepLink("https://x.ch/chat?tab=2", "q"), null);
  assert.equal(takeDeepLink("not a url", "q"), null);
  assert.equal(takeDeepLink("https://x.ch/?q=" + "a".repeat(5000), "q").text.length, 4000);
  assert.equal(takeDeepLink("https://x.ch/?q=%20%20", "q").text, "", "blank is not a message");
});

test("failure: a ChatTurnError's words and kind travel; a raw error's never do", () => {
  assert.deepEqual(
    chatTurnFailure(new ChatTurnError("No model here reads pictures.", { kind: "no-vision" })),
    {
      message: "No model here reads pictures.",
      kind: "no-vision",
    },
  );
  assert.deepEqual(chatTurnFailure({ message: "Quota used up.", kind: "quota" }), {
    message: "Quota used up.",
    kind: "quota",
  });
  assert.deepEqual(
    chatTurnFailure(new TypeError("Failed to fetch")),
    {},
    "a raw error is not shown",
  );
  assert.deepEqual(
    chatTurnFailure(new TypeError("Failed to fetch"), () => "You are offline."),
    { message: "You are offline." },
  );
  const e = new ChatTurnError("x", { cause: new Error("inner") });
  assert.ok(e instanceof Error && e.name === "ChatTurnError" && e.cause instanceof Error);
});

test("failure: each failed bubble keeps its own reason", () => {
  const html = renderToStaticMarkup(
    h(ChatThread, {
      messages: [
        { id: "u1", role: "user", content: "one" },
        {
          id: "a1",
          role: "assistant",
          content: "",
          failed: true,
          failure: { message: "First reason." },
        },
        { id: "u2", role: "user", content: "two" },
        {
          id: "a2",
          role: "assistant",
          content: "",
          failed: true,
          failure: { message: "Second reason." },
        },
        { id: "u3", role: "user", content: "three" },
        { id: "a3", role: "assistant", content: "", failed: true },
      ],
      labels: { failed: "Default failure." },
    }),
  );
  assert.match(html, /First reason\./);
  assert.match(html, /Second reason\./);
  assert.match(html, /Default failure\./);
});

test("renderFooter knows which answer is the latest, and where each one is", () => {
  const seen = [];
  renderToStaticMarkup(
    h(ChatThread, {
      messages: [
        { id: "u1", role: "user", content: "a" },
        { id: "a1", role: "assistant", content: "one" },
        { id: "u2", role: "user", content: "b" },
        { id: "a2", role: "assistant", content: "two" },
      ],
      renderFooter: (m, info) => {
        if (m.role === "assistant") seen.push([m.id, info.isLatest, info.index]);
        return null;
      },
    }),
  );
  assert.deepEqual(seen, [
    ["a1", false, 1],
    ["a2", true, 3],
  ]);
});

test("starters: a label apart from what it sends, and the language it is in", () => {
  assert.deepEqual(starterParts("Plain"), { label: "Plain", prompt: "Plain" });
  assert.deepEqual(starterParts({ text: "Grüezi mitenand", lang: "gsw" }), {
    label: "Grüezi mitenand",
    prompt: "Grüezi mitenand",
    lang: "gsw",
  });
  assert.deepEqual(starterParts({ label: "Shorter", prompt: "Make it shorter." }), {
    label: "Shorter",
    prompt: "Make it shorter.",
    lang: undefined,
  });
  const html = renderToStaticMarkup(
    h(ChatStarters, { starters: ["Hi", { text: "Grüezi mitenand", lang: "gsw" }], onPick() {} }),
  );
  assert.match(html, /lang="gsw"[^>]*>Grüezi mitenand</);
  assert.equal((html.match(/lang=/g) ?? []).length, 1, "only the starter that has one");
});

test("chat list: the product's line under the search, and its own empty state", () => {
  const props = {
    conversations: [],
    state: "ready",
    activeId: null,
    busyIds: new Set(),
    onOpen() {},
    onNew() {},
    onRename() {},
    onRemove() {},
    onRetry() {},
    labels: DEFAULT_CHAT_APP_LABELS,
  };
  const html = renderToStaticMarkup(
    h(ChatHistory, {
      ...props,
      slot: h("p", null, "Only in this browser · Sign in to keep it"),
      empty: h("p", null, "Ask something and it is kept here."),
    }),
  );
  assert.match(html, /class="ck-history-slot"><p>Only in this browser/);
  assert.ok(
    html.indexOf("ck-history-search") < html.indexOf("ck-history-slot"),
    "under the search",
  );
  assert.match(html, /Ask something and it is kept here/);
  assert.doesNotMatch(html, /No chats yet/);
  const app = renderToStaticMarkup(
    h(ChatApp, {
      transport: async () => "ok",
      store: memoryConversationStore(),
      historySlot: "Sign in to keep it",
      railQuery: "all",
    }),
  );
  // The rail is decided after mount; on the server the list is not drawn yet.
  assert.match(app, /ck-app/);
});

test("attach sheet: the product's rows under Camera · Photos · Files, one anatomy", () => {
  const rows = [
    { id: "things", label: "Your things", detail: "Listings and notes", onPick() {} },
    { id: "doc", label: "A document", onPick() {} },
  ];
  const html = renderToStaticMarkup(
    h(Composer, { onSend() {}, placeholder: "Ask", attach: true, attachExtras: rows }),
  );
  assert.match(html, /data-ck-source="files"/);
  assert.equal((html.match(/class="ck-attach-extra"/g) ?? []).length, 2);
  assert.match(html, /data-ck-extra="things"/);
  assert.match(html, /Listings and notes/);
  assert.ok(
    html.indexOf("ck-attach-sources") < html.indexOf("ck-attach-extra"),
    "under the sources",
  );
  // With attachments off, the paperclip opens a sheet of only the rows.
  const only = renderToStaticMarkup(
    h(Composer, { onSend() {}, placeholder: "Ask", attach: false, attachExtras: rows }),
  );
  assert.doesNotMatch(only, /ck-attach-source/);
  assert.match(only, /ck-sheet-only/);
  assert.match(only, /aria-label="Attach a screenshot or file"/);
  const none = renderToStaticMarkup(
    h(Composer, { onSend() {}, placeholder: "Ask", attach: false }),
  );
  assert.doesNotMatch(none, /Attach a screenshot/, "no rows, no attachments: no paperclip");
  const menu = renderToStaticMarkup(h(AttachMenu, { onFiles() {}, rows }));
  assert.match(menu, /ck-attach-extra/);
});

test("sent bubble: the product's chips beside the pictures, a link when it has one", () => {
  const html = renderToStaticMarkup(
    h(ChatMessage, {
      message: {
        id: "u",
        role: "user",
        content: "What about these?",
        attachments: [{ kind: "text", name: "notes.txt" }],
        chips: [{ label: "My bike listing", href: "/listings/1" }, { label: "Budget note" }],
      },
    }),
  );
  assert.match(html, /notes\.txt/);
  assert.match(html, /<a href="\/listings\/1" class="ck-attach-file ck-turn-chip">/);
  assert.match(html, /Budget note/);
});
