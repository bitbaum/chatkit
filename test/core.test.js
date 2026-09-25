// The decisions every chat must make the same way. Each case is a bug that
// already shipped somewhere in the fleet.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendTranscript,
  composerCanSend,
  composerOutgoingText,
  deadRecogniserStillTrusted,
  fallbackCanRescue,
  formatElapsed,
  isFollowing,
  mayKeepWaitingForPermission,
  parseBlocks,
  parseInline,
  problemFor,
  problemForRecording,
  safeHref,
  shouldClearDraft,
  toWire,
  DEAD_RECOGNISER_TTL_MS,
  PERMISSION_WAIT_MS,
} from "../dist/index.js";

test("send: empty text cannot send; a screenshot alone only where the app said what it means", () => {
  const base = { attachmentCount: 0, sending: false, disabled: false, blocked: false };
  assert.equal(composerCanSend({ ...base, text: "   " }), false);
  assert.equal(composerCanSend({ ...base, text: "hi" }), true);
  assert.equal(composerCanSend({ ...base, text: "", attachmentCount: 1 }), false);
  assert.equal(
    composerCanSend({ ...base, text: "", attachmentCount: 1, attachmentOnlyText: "See image" }),
    true,
  );
  assert.equal(composerCanSend({ ...base, text: "hi", sending: true }), false);
  assert.equal(composerOutgoingText("", 1, "See image"), "See image");
  assert.equal(composerOutgoingText("  hi  ", 0), "hi");
});

test("a failed send keeps the draft", () => {
  assert.equal(shouldClearDraft(false), false);
  assert.equal(shouldClearDraft(undefined), true);
  assert.equal(shouldClearDraft(true), true);
});

test("dictated words join the draft with one space", () => {
  assert.equal(appendTranscript("", " hello "), "hello");
  assert.equal(appendTranscript("I want", "to earn"), "I want to earn");
  assert.equal(appendTranscript("I want  ", "to earn"), "I want to earn");
  assert.equal(appendTranscript("keep", "  "), "keep");
  assert.equal(formatElapsed(75.9), "1:15");
  assert.equal(formatElapsed(-3), "0:00");
});

test("mic: only 'unavailable' is rescued by recording; mic and silence are real answers", () => {
  assert.equal(fallbackCanRescue("unavailable"), true);
  assert.equal(fallbackCanRescue("mic"), false);
  assert.equal(fallbackCanRescue("silence"), false);
  assert.equal(problemFor("not-allowed"), "mic");
  assert.equal(problemFor("no-speech"), "silence");
  assert.equal(problemFor("network"), "unavailable");
  assert.equal(problemFor("something-new"), "unavailable", "unknown is never nothing");
  assert.equal(problemFor("aborted"), null);
  assert.equal(problemForRecording({ name: "NotAllowedError" }), "mic");
  assert.equal(problemForRecording({ name: "NotFoundError" }), "mic");
  assert.equal(problemForRecording(new Error("x")), "unavailable");
});

test("mic: a pending permission never holds the fallback forever (heidi: 22 s, nothing)", () => {
  assert.equal(mayKeepWaitingForPermission(0, true), true);
  assert.equal(mayKeepWaitingForPermission(PERMISSION_WAIT_MS, true), false);
  assert.equal(mayKeepWaitingForPermission(10, false), false);
});

test("mic: a dead recogniser is remembered for a while, not forever, not from the future", () => {
  const now = 1_000_000_000_000;
  assert.equal(deadRecogniserStillTrusted(null, now), false);
  assert.equal(deadRecogniserStillTrusted(now - 1000, now), true);
  assert.equal(deadRecogniserStillTrusted(now - DEAD_RECOGNISER_TTL_MS, now), false);
  assert.equal(deadRecogniserStillTrusted(now + 5000, now), false);
  assert.equal(deadRecogniserStillTrusted(Number.NaN, now), false);
});

test("scroll: follow only while at the bottom", () => {
  assert.equal(isFollowing({ scrollHeight: 1000, scrollTop: 900, clientHeight: 90 }), true);
  assert.equal(isFollowing({ scrollHeight: 1000, scrollTop: 200, clientHeight: 90 }), false);
});

test("markdown: no literal ** or > leaks; lists, code and headings parse", () => {
  const blocks = parseBlocks(
    "# Title\nSome **bold** text\n\n- one\n- two\n1. first\n> quoted\n```js\nconst a = 1;\n```",
  );
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["h", "p", "ul", "ol", "quote", "code"],
  );
  const inline = parseInline("Some **bold** and *em* and `code` [site](https://x.ch) [F1]");
  assert.deepEqual(
    inline.filter((s) => s.kind !== "text").map((s) => s.kind),
    ["strong", "em", "code", "link", "cite"],
  );
  assert.ok(!inline.some((s) => s.kind === "text" && s.text.includes("**")));
});

test("markdown: a streaming, unclosed code fence still renders as code", () => {
  const blocks = parseBlocks("Here:\n```\nnpm i");
  assert.equal(blocks.at(-1).kind, "code");
});

test("links: javascript: from a model is text, never a link", () => {
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("//evil.example"), null);
  assert.equal(safeHref("/work/"), "/work/");
  assert.equal(safeHref("https://orangecat.ch"), "https://orangecat.ch/");
  const spans = parseInline("[click](javascript:alert(1))");
  assert.ok(spans.every((s) => s.kind !== "link"));
});

test("bare https URLs in an answer become links, without trailing punctuation", () => {
  const spans = parseInline("See https://heidi.orangecat.ch.");
  const link = spans.find((s) => s.kind === "link");
  assert.equal(link?.href, "https://heidi.orangecat.ch/");
});

test("attachments: the wire never carries a preview URL", () => {
  const wire = toWire([
    { kind: "image", name: "a.png", mimeType: "image/png", dataBase64: "AA", previewUrl: "blob:x" },
  ]);
  assert.equal("previewUrl" in wire[0], false);
});
