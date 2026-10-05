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
  fitWithin,
  dataUrlBytes,
  isTextFile,
  ATTACH_SOURCE_INPUT,
  DEFAULT_ATTACHMENT_NOTES,
  DEFAULT_ATTACHMENT_LIMITS,
  DEFAULT_DICTATION_MESSAGES,
  MAX_AUDIO_FILE_BYTES,
  audioFileName,
  isAudioFile,
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
  // An app that queues takes the next message while the turn still runs —
  // but never a disabled or blocked one.
  assert.equal(composerCanSend({ ...base, text: "hi", sending: true, queue: true }), true);
  assert.equal(
    composerCanSend({ ...base, text: "hi", sending: true, queue: true, disabled: true }),
    false,
  );
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

test("a link inside bold or italic is still a link", () => {
  const [strong] = parseInline("**[Chalco](/markets/chalco)**");
  assert.equal(strong.kind, "strong");
  assert.deepEqual(strong.children, [{ kind: "link", text: "Chalco", href: "/markets/chalco" }]);
  const [em] = parseInline("*see [ASML](https://www.asml.com)*");
  assert.equal(em.children.at(-1).kind, "link");
  const [plain] = parseInline("**just bold**");
  assert.deepEqual(plain.children, [{ kind: "text", text: "just bold" }]);
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

test("attach: an image is fitted on its longest edge, never enlarged, and 0 means leave it", () => {
  assert.deepEqual(fitWithin(1290, 2796, 1024), { width: 472, height: 1024, scaled: true });
  assert.deepEqual(fitWithin(2796, 1290, 1024), { width: 1024, height: 472, scaled: true });
  assert.deepEqual(fitWithin(800, 600, 1024), { width: 800, height: 600, scaled: false });
  assert.deepEqual(fitWithin(5000, 5000, 0), { width: 5000, height: 5000, scaled: false });
  // Off by default, so no product's pictures change size without asking.
  assert.equal(DEFAULT_ATTACHMENT_LIMITS.maxImageEdge, 0);
});

test("attach: bytes are measured from the data URL, header or not", () => {
  assert.equal(dataUrlBytes("data:image/jpeg;base64,AAAA"), 3);
  assert.equal(dataUrlBytes("AAAAAAAA"), 6);
});

test("attach: every reason a file did not attach is a sentence that names it", () => {
  const n = DEFAULT_ATTACHMENT_NOTES;
  for (const said of [
    n.wrongType("a.bmp"),
    n.imageTooLarge("a.png", 3),
    n.textTooLarge("a.txt", 100),
    n.unreadable("a.png"),
  ]) {
    assert.match(said, /a\.(bmp|png|txt)/);
  }
  assert.match(n.tooMany(5), /5/);
});

test("recordings: a file holding a recording is recognised by type, or by name when the picker gives none", () => {
  // Android's stock recorder hands over .m4a with an empty type (loki, 2026-10-03).
  assert.equal(isAudioFile({ type: "", name: "Meine Aufnahme 12.m4a" }), true);
  assert.equal(isAudioFile({ type: "audio/mp4", name: "Kivitendo.m4a" }), true);
  assert.equal(isAudioFile({ type: "audio/webm", name: "" }), true);
  assert.equal(isAudioFile({ type: "", name: "notes.MP3" }), true);
  assert.equal(isAudioFile({ type: "image/png", name: "shot.png" }), false);
  assert.equal(isAudioFile({ type: "text/plain", name: "a.txt" }), false);
  assert.equal(isAudioFile({ type: "", name: "report.pdf" }), false);
});

test("recordings: a file keeps its own name on the wire, a mic take gets one from its type", () => {
  // Whisper services read the container from the extension.
  assert.equal(audioFileName({ type: "", name: "Kivitendo.m4a" }), "Kivitendo.m4a");
  assert.equal(audioFileName({ type: "audio/mp4" }), "voice.m4a");
  assert.equal(audioFileName({ type: "audio/ogg" }), "voice.ogg");
  assert.equal(audioFileName({ type: "audio/webm;codecs=opus" }), "voice.webm");
  assert.equal(audioFileName({ type: "audio/mpeg" }), "voice.mp3");
});

test("recordings: too large is a sentence that names the limit, and the limit fits an hour-long memo", () => {
  // A one-hour phone memo is ~60 MB; a ten-hour one is refused before upload.
  assert.ok(MAX_AUDIO_FILE_BYTES >= 100 * 1024 * 1024);
  assert.match(DEFAULT_DICTATION_MESSAGES.fileTooLarge, /\d+ MB/);
  // The fallback never rescues it: the file is the same size on every path.
  assert.equal(fallbackCanRescue("fileTooLarge"), false);
});

test("attach: three sources, and never one mixed accept — that is what hid the screenshots", () => {
  assert.deepEqual(ATTACH_SOURCE_INPUT.camera, { accept: "image/*", capture: "environment" });
  assert.deepEqual(ATTACH_SOURCE_INPUT.photos, { accept: "image/*" });
  // No accept at all is what opens the phone's real document browser.
  assert.equal(ATTACH_SOURCE_INPUT.files.accept, undefined);
  for (const src of Object.values(ATTACH_SOURCE_INPUT)) {
    assert.ok(!src.accept || !src.accept.includes(","), "one type family per input");
  }
});

test("attach: Files takes anything, so text is decided after the pick", () => {
  assert.equal(isTextFile("notes.md", ""), true);
  assert.equal(isTextFile("trace.log", "application/octet-stream"), true);
  assert.equal(isTextFile("data.json", "application/json"), true);
  assert.equal(isTextFile("page.tsx", ""), true);
  assert.equal(isTextFile("a.txt", "text/plain"), true);
  // A PDF read as text is binary noise pasted into a prompt.
  assert.equal(isTextFile("invoice.pdf", "application/pdf"), false);
  assert.equal(isTextFile("photo.heic", "image/heic"), false);
  assert.equal(isTextFile("archive.zip", ""), false);
  assert.match(DEFAULT_ATTACHMENT_NOTES.wrongType("invoice.pdf"), /image .*or a text file/);
});
