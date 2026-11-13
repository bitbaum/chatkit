// Messages waiting their turn, and the question nothing answered.
//
// Measured on Loki's chat, 2026-11-13: three quick messages in a new chat
// became three conversations; two queued messages vanished on reload; a
// question whose answer died with the page showed nothing under it, forever.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  parseStoredQueue,
  queuedFor,
  serializeQueue,
  storableQueue,
  takeQueuedFor,
  unansweredTurn,
} from "../dist/index.js";
import { ChatThread } from "../dist/react/index.js";

const q = (id, conversationId, text, attachments = []) => ({
  id,
  conversationId,
  text,
  attachments,
});

test("the next queued message is taken for the conversation whose turn landed", () => {
  const queue = [q(1, "a", "A1"), q(2, "b", "B1"), q(3, "a", "A2")];
  const first = takeQueuedFor(queue, "a");
  assert.equal(first.next.text, "A1");
  assert.deepEqual(
    first.rest.map((x) => x.text),
    ["B1", "A2"],
  );
  assert.equal(takeQueuedFor(first.rest, "a").next.text, "A2");
  const none = takeQueuedFor(queue, "c");
  assert.equal(none.next, null);
  assert.deepEqual(none.rest, queue);
  assert.deepEqual(
    queuedFor(queue, "a").map((x) => x.text),
    ["A1", "A2"],
  );
  assert.deepEqual(queuedFor(queue, null), []);
});

test("a reload keeps the words, not a message that carries files", () => {
  const queue = [q(1, "a", "words"), q("x", "a", "with a file", [{ name: "x.pdf" }])];
  assert.deepEqual(
    storableQueue(queue).map((x) => x.text),
    ["words"],
  );
  assert.deepEqual(parseStoredQueue(serializeQueue(queue)), [q(1, "a", "words")]);
});

test("a damaged store costs the queue, never the chat", () => {
  for (const raw of [null, undefined, "", "not json", '{"a":1}', "[1,null]"])
    assert.deepEqual(parseStoredQueue(raw), []);
  assert.deepEqual(
    parseStoredQueue(
      JSON.stringify([
        { id: {}, conversationId: "a", text: "t" },
        { id: 1, text: "t" },
        { id: 2, conversationId: "", text: "t" },
        { id: 3, conversationId: "a" },
        { id: "ok", conversationId: "a", text: "kept" },
      ]),
    ).map((x) => x.text),
    ["kept"],
  );
});

test("a question nothing is answering is found; one on its way is not", () => {
  const idle = { sending: false };
  const user = { id: "m1", role: "user", content: " How do tides work? " };
  const answer = { id: "m2", role: "assistant", content: "The moon." };
  assert.deepEqual(unansweredTurn([user], idle), { id: "m1", text: "How do tides work?" });
  assert.equal(unansweredTurn([user, answer], idle), null);
  assert.equal(unansweredTurn([], idle), null);
  assert.equal(unansweredTurn([user], { sending: true }), null);
  assert.equal(unansweredTurn([user], { sending: false, loading: true }), null);
  assert.equal(unansweredTurn([user], { sending: false, queued: 1 }), null);
  assert.equal(unansweredTurn([{ ...user, pending: true }], idle), null);
  assert.equal(unansweredTurn([{ ...user, failed: true }], idle), null);
  assert.equal(unansweredTurn([{ ...user, content: "   " }], idle), null);
});

test("the thread says a question was not answered and offers to ask again", () => {
  const messages = [{ id: "m1", role: "user", content: "How do tides work?" }];
  const html = renderToStaticMarkup(
    h(ChatThread, { messages, unanswered: true, onRetry: () => {} }),
  );
  assert.match(html, /class="ck-unanswered"/);
  assert.match(html, /This was not answered/);
  assert.match(html, /Try again/);
  // Not while an answer is being written, and not without the flag.
  const live = renderToStaticMarkup(
    h(ChatThread, { messages, unanswered: true, live: { text: "The", status: "writing" } }),
  );
  assert.doesNotMatch(live, /ck-unanswered/);
  assert.doesNotMatch(renderToStaticMarkup(h(ChatThread, { messages })), /ck-unanswered/);
});
