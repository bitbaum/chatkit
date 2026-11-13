// The Messenger renders on the server, and its markup says what the screen
// must: who is an agent, whose message is whose, what was read. Rendered to a
// string; what needs a running browser is in test/browser-messenger.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ConversationList,
  MessageThread,
  Messenger,
  DEFAULT_MESSENGER_LABELS,
  messengerLabels,
} from "../dist/react/messenger.js";
import { Composer } from "../dist/react/index.js";
import { AttachMenu } from "../dist/react/attach.js";
import { ATTACH_SOURCE_INPUT, MESSAGE_FILES_ACCEPT, acceptFamilies } from "../dist/index.js";

const START = new Date("2026-11-01T00:00:00Z");
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
const msg = (id, authorId, body, at, extra = {}) => ({
  id,
  threadId: "c1",
  authorId,
  body,
  createdAt: new Date(at),
  ...extra,
});

const withCat = {
  id: "c1",
  createdAt: START,
  participants: [
    person("me", "Georgy"),
    person("maya", "Maya Keller", { lastReadAt: new Date("2026-11-10T10:05:00Z") }),
    catSeat,
  ],
};
const dm = {
  id: "c1",
  createdAt: START,
  participants: [person("me", "Georgy"), person("maya", "Maya Keller")],
};

const thread = (conversation, messages, extra = {}) =>
  renderToStaticMarkup(
    h(MessageThread, {
      conversation,
      viewerId: "me",
      messages,
      agents: [CAT],
      timeZone: "UTC",
      locale: "en-GB",
      ...extra,
    }),
  );

test("an agent's message carries its name, the Agent mark and whom it answered for", () => {
  const html = thread(withCat, [
    msg("1", "me", "@cat who is right?", "2026-11-10T10:00:00Z"),
    msg("2", "cat", "Maya is.", "2026-11-10T10:00:05Z", { onBehalfOf: "me" }),
  ]);
  assert.match(html, /ck-msgr-from-agent/);
  assert.match(
    html,
    /class="ck-speaker ck-speaker-agent">Cat<span class="ck-speaker-kind">Agent<\/span>/,
  );
  assert.match(html, /for Georgy/);
  assert.match(html, /ck-msgr-avatar-agent/, "an agent's face has its own shape");
});

test("a person is never marked as an agent, and is named once an agent is in the room", () => {
  const html = thread(withCat, [msg("1", "maya", "Penguins are fish.", "2026-11-10T10:00:00Z")]);
  assert.match(html, /class="ck-speaker">Maya Keller<\/span>/);
  assert.doesNotMatch(html, /ck-speaker-kind/);
  assert.doesNotMatch(html, /ck-msgr-from-agent/);
});

test("between two people nobody needs naming", () => {
  const html = thread(dm, [msg("1", "maya", "hello", "2026-11-10T10:00:00Z")]);
  assert.doesNotMatch(html, /ck-speaker/);
});

test("an agent's words are markdown; a person's are exactly what was typed", () => {
  const html = thread(withCat, [
    msg("1", "cat", "They are **birds**.", "2026-11-10T10:00:00Z"),
    msg("2", "maya", "They are **fish** <b>really</b>", "2026-11-10T10:10:00Z"),
  ]);
  assert.match(html, /<strong>birds<\/strong>/);
  assert.match(html, /They are \*\*fish\*\* &lt;b&gt;really&lt;\/b&gt;/);
});

test("a person's address is a link that opens elsewhere; a script address is not a link", () => {
  const html = thread(dm, [
    msg("1", "maya", "see https://example.org/x and javascript:alert(1)", "2026-11-10T10:00:00Z"),
  ]);
  assert.match(html, /<a[^>]*href="https:\/\/example\.org\/x"/);
  assert.doesNotMatch(html, /href="javascript:/);
});

test("the viewer's message says how far it got: sending, sent, read, not sent", () => {
  const read = thread(withCat, [msg("1", "me", "hi", "2026-11-10T10:00:00Z")]);
  assert.match(
    read,
    /aria-label="Read"/,
    "the only other PERSON has read it; the agent is not waited for",
  );
  const sent = thread(withCat, [msg("1", "me", "hi", "2026-11-10T11:00:00Z")]);
  assert.match(sent, /aria-label="Sent"/);
  const sending = thread(dm, [
    msg("t", "me", "hi", "2026-11-10T11:00:00Z", { clientId: "t", delivery: "sending" }),
  ]);
  assert.match(sending, /aria-label="Sending"/);
  const failed = thread(
    dm,
    [msg("t", "me", "hi", "2026-11-10T11:00:00Z", { clientId: "t", delivery: "failed" })],
    {
      onRetry: () => {},
      onDiscard: () => {},
    },
  );
  assert.match(failed, /Not sent\./);
  assert.match(failed, />Try again<\/button>/);
  assert.match(failed, />Delete<\/button>/);
});

test("pictures are tiles with their size known, a film is its still, a file is a download", () => {
  const html = thread(dm, [
    msg("1", "maya", "", "2026-11-10T10:00:00Z", {
      attachments: [
        {
          id: "a",
          kind: "image",
          name: "cat.jpg",
          mimeType: "image/jpeg",
          bytes: 1000,
          width: 1200,
          height: 900,
          url: "/a.jpg",
        },
      ],
    }),
    msg("2", "maya", "", "2026-11-10T10:10:00Z", {
      attachments: [
        {
          id: "b",
          kind: "video",
          name: "hike.mp4",
          mimeType: "video/mp4",
          bytes: 9_000_000,
          durationMs: 42_000,
          url: "/b.mp4",
          posterUrl: "/b.jpg",
        },
        {
          id: "c",
          kind: "file",
          name: "route.pdf",
          mimeType: "application/pdf",
          bytes: 184_320,
          url: "/c.pdf",
        },
      ],
    }),
  ]);
  assert.match(html, /<img src="\/a\.jpg"[^>]*width="288"[^>]*height="216"/);
  assert.match(html, /<img src="\/b\.jpg"/, "the film's still is drawn");
  assert.doesNotMatch(html, /<video/, "no film is loaded to draw a tile");
  assert.match(html, /0:42/);
  assert.match(html, /<a class="ck-msgr-file" href="\/c\.pdf" download="route\.pdf"/);
  assert.match(html, /180 KB/);
});

test("an agent that was asked is shown thinking, and then as not having answered", () => {
  const thinking = thread(withCat, [msg("1", "me", "@cat ?", "2026-11-10T10:00:00Z")], {
    awaited: [{ agentId: "cat", state: "thinking" }],
  });
  assert.match(thinking, /Cat is thinking…/);
  const quiet = thread(withCat, [msg("1", "me", "@cat ?", "2026-11-10T10:00:00Z")], {
    awaited: [{ agentId: "cat", state: "quiet" }],
    onDismissAgent: () => {},
  });
  assert.match(quiet, /Cat has not answered\. Ask again in a moment\./);
  assert.match(quiet, />Dismiss<\/button>/);
});

test("an empty conversation says so, and how to bring the agent in", () => {
  const html = thread(dm, []);
  assert.match(html, /No messages yet\. Say hello\./);
  assert.match(html, /Type @cat to bring Cat in\. Everyone here sees its answer\./);
});

test("the list: one row anatomy, an unread count a screen reader can hear, the agent on the face", () => {
  const html = renderToStaticMarkup(
    h(ConversationList, {
      viewerId: "me",
      agents: [CAT],
      selectedId: "c1",
      onSelect: () => {},
      onNew: () => {},
      timeZone: "UTC",
      locale: "en-GB",
      conversations: [
        {
          ...withCat,
          last: { body: "Maya is.", authorId: "cat", createdAt: new Date("2026-11-10T10:00:00Z") },
          unread: 2,
        },
      ],
    }),
  );
  assert.match(html, /<h1 class="ck-msgr-list-title">Messages<\/h1>/);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /Maya Keller/);
  assert.match(html, /aria-label="2 unread"/);
  assert.match(html, /ck-msgr-row-agent/);
  assert.match(html, />New<\/button>/);
});

test("the whole Messenger renders without a browser", () => {
  const transport = {
    conversations: async () => [],
    messages: async () => ({ messages: [], before: null }),
    send: async () => {
      throw new Error("not in this test");
    },
  };
  const html = renderToStaticMarkup(h(Messenger, { viewer: { id: "me" }, transport }));
  assert.match(html, /class="ck-msgr" data-pane="list"/);
  assert.match(html, /Messages/);
  assert.doesNotMatch(html, />New<\/button>/, "no people search, no New");
});

test("labels: a product overrides one word of a group and keeps the rest", () => {
  const labels = messengerLabels({ title: "Nachrichten", preview: { photo: "Foto" } });
  assert.equal(labels.title, "Nachrichten");
  assert.equal(labels.preview.photo, "Foto");
  assert.equal(labels.preview.video, DEFAULT_MESSENGER_LABELS.preview.video);
});

test("the inline composer is the same box with one more class; the default is unchanged", () => {
  // Where the microphone sits needs a browser that has one: see
  // test/browser-messenger.mjs.
  const html = renderToStaticMarkup(
    h(Composer, { onSend: () => {}, placeholder: "Message", layout: "inline" }),
  );
  assert.match(html, /class="ck-composer ck-composer-inline"/);
  assert.match(html, /<textarea[^>]*class="ck-input"/);
  const stacked = renderToStaticMarkup(h(Composer, { onSend: () => {}, placeholder: "Ask" }));
  assert.match(stacked, /class="ck-composer"/);
  assert.doesNotMatch(stacked, /ck-composer-inline/);
});

test("videos are their own source, and every source still asks for one family", () => {
  const html = renderToStaticMarkup(
    h(AttachMenu, {
      onFiles: () => {},
      sources: ["camera", "photos", "videos", "files"],
      accept: { files: MESSAGE_FILES_ACCEPT },
    }),
  );
  assert.match(
    html,
    /data-ck-source="videos"[^>]*accept="video\/\*"|accept="video\/\*"[^>]*data-ck-source="videos"/,
  );
  assert.match(html, />Videos</);
  assert.deepEqual(acceptFamilies(ATTACH_SOURCE_INPUT.videos.accept), ["video"]);
  assert.deepEqual(acceptFamilies(MESSAGE_FILES_ACCEPT), ["document"]);
  assert.ok(
    html.includes(MESSAGE_FILES_ACCEPT),
    "the Files source asks for a messenger's documents",
  );
});

test("an app that set its attach labels before Videos existed still gets a word for it", () => {
  const html = renderToStaticMarkup(
    h(AttachMenu, {
      onFiles: () => {},
      sources: ["videos"],
      rows: [{ id: "x", label: "Extra", onPick: () => {} }],
      labels: {
        attach: "Anhängen",
        title: "Hinzufügen",
        close: "Schliessen",
        sources: { camera: "Kamera", photos: "Fotos", files: "Dateien" },
      },
    }),
  );
  assert.match(html, />Videos</);
});

test("the messenger entry exports the type of an app's action", async () => {
  const { readFile } = await import("node:fs/promises");
  const types = await readFile(new URL("../dist/react/messenger.d.ts", import.meta.url), "utf8");
  assert.match(types, /MessengerComposerAction/);
});
