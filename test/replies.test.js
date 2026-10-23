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

const BLOCK = '\n\n```quick_replies\n["Yes, do it", "Not now"]\n```';

test("replies: a heading the model writes over the replies is dropped, in any language", () => {
  for (const label of [
    "**Quick follow-up options**",
    "### Suggested replies",
    "**Mögliche Rückfragen:**",
    "_Mögliche Rückfragen:_",
    "## Быстрые ответы",
    "**Варианты ответа**:",
  ]) {
    const { text, replies } = extractReplies("Here is the answer.\n\n" + label + BLOCK);
    assert.equal(text, "Here is the answer.", label);
    assert.equal(replies.length, 2, label);
  }
});

test("replies: a rule with a heading above the replies is dropped too", () => {
  for (const tail of ["---\n\n**Quick replies**", "**Quick replies**\n\n---", "---"]) {
    assert.equal(extractReplies("Answer.\n\n" + tail + BLOCK).text, "Answer.", tail);
  }
});

test("replies: a bold sentence that concludes the answer is kept", () => {
  for (const kept of [
    "**China holds 99 %.**",
    "**This is a real conclusion with more than six words**",
  ]) {
    const answerText = "Gallium is refined, not mined.\n\n" + kept;
    assert.equal(extractReplies(answerText + BLOCK).text, answerText, kept);
  }
});

test("replies: a heading in the middle of an answer, or with no replies, is kept", () => {
  const mid = "## Plan\n\nStep one.";
  assert.equal(extractReplies(mid + BLOCK).text, mid);
  assert.equal(extractReplies("Intro.\n\n**Quick replies**").text, "Intro.\n\n**Quick replies**");
});

test("replies: while streaming, the heading over the replies never shows", () => {
  for (const partial of [
    "Answer.\n\n**Quick fo",
    "Answer.\n\n**Quick follow-up options**",
    "Answer.\n\n**Quick follow-up options**\n\n",
    "Answer.\n\n**Quick follow-up options**\n\n```",
    "Answer.\n\n**Quick follow-up options**\n\n```quick_rep",
    'Answer.\n\n---\n\n### Mögliche Rückfragen\n\n```quick_replies\n["Ja',
  ]) {
    assert.equal(extractReplies(partial, { streaming: true }).text, "Answer.", partial);
  }
  // A real section shows as soon as its first words arrive.
  const section = "Answer.\n\n## Plan\n\nStep one is";
  assert.equal(extractReplies(section, { streaming: true }).text, section);
});

test("replies: the instruction forbids a heading over the replies", () => {
  assert.match(REPLIES_INSTRUCTION, /Do not write any heading or label before it/);
});

test("replies: the instruction makes the model lead — every answer, best reply first", () => {
  assert.match(REPLIES_INSTRUCTION, /End every answer/);
  assert.match(REPLIES_INSTRUCTION, /FIRST/);
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
  assert.equal((html.match(/class="ck-reply(?: ck-reply-lead)?"/g) ?? []).length, 3);
  assert.equal(
    (html.match(/class="ck-reply ck-reply-lead"/g) ?? []).length,
    1,
    "the first reply is the lead — the recommended next step",
  );
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
