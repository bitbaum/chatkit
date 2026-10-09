// Suggested replies: the format is one contract between a model and every
// chat in the fleet, so the parser is tested on what models actually write.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { extractReplies, REPLIES_INSTRUCTION, REPLIES_FENCE } from "../dist/index.js";
import { ChatThread, ChatReplies } from "../dist/react/index.js";

const answer =
  'Want me to set it up?\n\n```quick_replies\n["Yes, do it", "Show me first", "Not now"]\n```';

test("replies: the block is taken out of the answer and returned as buttons", () => {
  const { text, replies } = extractReplies(answer);
  assert.equal(text, "Want me to set it up?");
  assert.deepEqual(replies, ["Yes, do it", "Show me first", "Not now"]);
});

test("replies: an answer without a block is untouched", () => {
  assert.deepEqual(extractReplies("Done."), { text: "Done.", replies: [] });
});

test("replies: while streaming, a half-written block is hidden, never shown as JSON", () => {
  for (const partial of [
    "Want me to set it up?\n```quick_re",
    'Want me to set it up?\n```quick_replies\n["Yes, do',
    "Want me to set it up?\n```q",
  ]) {
    assert.equal(extractReplies(partial).text, "Want me to set it up?", partial);
  }
});

test("replies: an ordinary code block is never mistaken for one", () => {
  const code = "Run this:\n```sh\npnpm i\n```";
  assert.equal(extractReplies(code).text, code);
  assert.equal(extractReplies("Run this:\n```").text, "Run this:\n```");
});

test("replies: capped, deduplicated, and sentences dropped", () => {
  const long = "x".repeat(80);
  const { replies } = extractReplies(
    '```quick_replies\n["A", "a", "B", "' + long + '", "C", "D", "E", 3]\n```',
  );
  assert.deepEqual(replies, ["A", "B", "C", "D"]);
});

test("replies: one per line is accepted when the model skips the JSON", () => {
  const { replies } = extractReplies('```quick_replies\n- Yes\n- "No"\n```');
  assert.deepEqual(replies, ["Yes", "No"]);
});

test("replies: malformed JSON yields no buttons and no raw text", () => {
  const { text, replies } = extractReplies('Ok.\n```quick_replies\n{"a": 1}\n```');
  assert.equal(text, "Ok.");
  assert.deepEqual(replies, []);
});

test("replies: the instruction teaches the same fence the parser reads", () => {
  assert.match(REPLIES_INSTRUCTION, new RegExp("```" + REPLIES_FENCE));
  const example = REPLIES_INSTRUCTION.slice(REPLIES_INSTRUCTION.indexOf("```"));
  assert.ok(extractReplies("x\n" + example.split("\nRules")[0]).replies.length >= 2);
});

test("thread: replies show under the LATEST answer only, as buttons, with the block stripped", () => {
  const html = renderToStaticMarkup(
    h(ChatThread, {
      messages: [
        { id: "1", role: "assistant", content: 'Old.\n```quick_replies\n["Stale"]\n```' },
        { id: "2", role: "user", content: "hi" },
        { id: "3", role: "assistant", content: answer },
      ],
      onReply: () => {},
    }),
  );
  assert.doesNotMatch(html, /quick_replies/);
  assert.doesNotMatch(html, /Stale/, "an older answer's replies are gone");
  assert.equal((html.match(/class="ck-reply"/g) ?? []).length, 3);
  assert.match(html, /role="group" aria-label="Suggested replies"/);
});

test("thread: no buttons while a turn is in flight, and none without onReply", () => {
  const messages = [{ id: "1", role: "assistant", content: answer }];
  const live = renderToStaticMarkup(
    h(ChatThread, { messages, onReply: () => {}, live: { text: "Thinking" } }),
  );
  assert.doesNotMatch(live, /ck-reply"/);
  const none = renderToStaticMarkup(h(ChatThread, { messages }));
  assert.doesNotMatch(none, /ck-reply"/);
  assert.doesNotMatch(
    none,
    /quick_replies/,
    "the block is stripped even when no app asked for buttons",
  );
});

test("thread: explicit replies win over a block in the content", () => {
  const html = renderToStaticMarkup(
    h(ChatThread, {
      messages: [{ id: "1", role: "assistant", content: answer, replies: ["Mine"] }],
      onReply: () => {},
    }),
  );
  assert.match(html, />Mine</);
  assert.doesNotMatch(html, />Not now</);
});

test("ChatReplies: renders nothing for no replies (no empty group to announce)", () => {
  assert.equal(renderToStaticMarkup(h(ChatReplies, { replies: [], onPick: () => {} })), "");
});
