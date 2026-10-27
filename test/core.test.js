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
  liveWords,
  isFollowing,
  mayKeepWaitingForPermission,
  parseBlocks,
  parseInline,
  listLead,
  isCardList,
  citedIds,
  problemFor,
  reasonFromBody,
  reasonOf,
  TranscriptionError,
  problemForRecording,
  safeHref,
  shouldClearDraft,
  toWire,
  fitWithin,
  dataUrlBytes,
  isTextFile,
  ATTACH_SOURCE_INPUT,
  acceptFamilies,
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

test("mic: live words are the settled ones then the guess, trimmed, never a stray space", () => {
  assert.equal(liveWords([], ""), "");
  assert.equal(liveWords([], " hello "), "hello");
  assert.equal(
    liveWords(["hello there", " how are"], "you doing"),
    "hello there how are you doing",
  );
  assert.equal(liveWords(["done."], ""), "done.");
  assert.equal(liveWords(["", "  "], "  "), "");
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

test("markdown: headings keep their level, quotes and lists keep their shape", () => {
  const blocks = parseBlocks(
    "## Two\n### Three\n#### Deep\n> a\n> b\n\n3. third\n4. fourth\n- [ ] todo\n- [x] done",
  );
  assert.deepEqual(
    blocks.map((b) => (b.kind === "h" ? `h${b.level}` : b.kind)),
    ["h2", "h3", "h3", "quote", "ol", "ul"],
  );
  assert.equal(blocks[3].text, "a\nb", "consecutive quoted lines are one quote");
  assert.equal(blocks[4].start, 3, "a list that starts at 3 starts at 3");
  assert.deepEqual(
    blocks[5].items.map((i) => [i.text, i.task]),
    [
      ["todo", false],
      ["done", true],
    ],
  );
});

test("markdown: a table is a table, a sentence with a pipe is not", () => {
  const [table] = parseBlocks(
    "| Who | Does |\n|---|---|\n| Loki | plans \\| builds |\nrow two | yes\n",
  );
  assert.equal(table.kind, "table");
  assert.deepEqual(table.head, ["Who", "Does"]);
  assert.deepEqual(table.rows, [
    ["Loki", "plans | builds"],
    ["row two", "yes"],
  ]);
  assert.equal(parseBlocks("a | b")[0].kind, "p");
  assert.equal(parseBlocks("---")[0].kind, "hr");
});

test("markdown: one level of nesting under a list item", () => {
  const [list] = parseBlocks("- top\n  - under\n  - also\n- next");
  assert.deepEqual(
    list.items.map((i) => [i.text, (i.children ?? []).map((c) => c.text)]),
    [
      ["top", ["under", "also"]],
      ["next", []],
    ],
  );
});

test("markdown: a list of named things reads as cards", () => {
  assert.deepEqual(listLead("**Loki: strategic intelligence.** Plans the work."), {
    lead: "Loki: strategic intelligence",
    rest: "Plans the work.",
  });
  assert.deepEqual(listLead("**Only a name**"), { lead: "Only a name", rest: "" });
  assert.deepEqual(listLead("**🤖 Robot:** moves"), { lead: "Robot", rest: "moves", icon: "🤖" });
  assert.equal(listLead("plain item"), null);
  const [cards] = parseBlocks("1. **One.** first\n2. **Two** — second");
  assert.equal(isCardList(cards.items), true);
  const [plain] = parseBlocks("- **bold start** then\n- not bold");
  assert.equal(isCardList(plain.items), false, "every item must be named, or it is a list");
});

test("markdown: images are web images only; citations are listed once, in order", () => {
  const [img] = parseInline("![a cat](https://x.ch/cat.png)");
  assert.deepEqual(img, { kind: "image", alt: "a cat", src: "https://x.ch/cat.png" });
  const [notImg] = parseInline("![x](javascript:alert(1))");
  assert.equal(notImg.kind, "text");
  assert.deepEqual(citedIds("See [F2] and [F1, F2] then [D1]."), ["F2", "F1", "D1"]);
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

test("accept families: what kind of picker a phone is asked for", () => {
  assert.deepEqual(acceptFamilies("image/*"), ["image"]);
  assert.deepEqual(acceptFamilies(".jpg, .PNG ,image/webp"), ["image"]);
  assert.deepEqual(acceptFamilies("audio/*,.mp3,.m4a,.webm,.3gp"), ["audio"]);
  assert.deepEqual(acceptFamilies(".txt,.md,.pdf,application/json"), ["document"]);
  assert.deepEqual(acceptFamilies("image/*,text/*,.md").sort(), ["document", "image"]);
  assert.deepEqual(acceptFamilies(""), []);
  // Every source the composer offers asks for one family at most.
  for (const s of Object.values(ATTACH_SOURCE_INPUT))
    assert.ok(acceptFamilies(s.accept ?? "").length <= 1);
});

test("a failed transcription keeps the server's reason", () => {
  assert.equal(
    reasonFromBody({ error: "Dictation is busy right now." }),
    "Dictation is busy right now.",
  );
  assert.equal(reasonFromBody({ error: { message: "Quota" } }), "Quota");
  assert.equal(reasonFromBody({ message: "Not configured" }), "Not configured");
  assert.equal(reasonFromBody({ error: "  " }), null);
  assert.equal(reasonFromBody(null), null);
  assert.equal(reasonFromBody("<html>"), null);
  assert.equal(reasonFromBody({ error: "x".repeat(500) }).length, 200, "capped for a status line");
  assert.equal(reasonOf(new TranscriptionError("Busy", 429)), "Busy");
  assert.equal(
    reasonOf(new Error("transcription 502")),
    null,
    "a bare Error says nothing to the person",
  );
  assert.equal(reasonOf(Object.assign(new Error("x"), { reason: "App says so" })), "App says so");
});

// Read aloud: an answer is prose, not markdown syntax.
import { plainTextForSpeech, guessSpeechLang } from "../dist/index.js";
import * as richMod from "../dist/rich.js";
import * as reviewMod from "../dist/review.js";

test("speech: markdown is flattened to the words a voice should say", () => {
  const spoken = plainTextForSpeech(
    '## Summary\n\n- **Two runs** failed [F8] on `sink` [D1, D2].\n- [ ] See [the log](https://x.y/z).\n\n```sh\nls\n```\n\n> quoted\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```quick_replies\n["Yes"]\n```',
  );
  for (const mark of ["#", "*", "[F8]", "https://", "`", "---", "quick_replies", "Yes"])
    assert.equal(spoken.includes(mark), false, `no ${mark}`);
  assert.match(spoken, /Two runs failed on sink/);
  assert.match(spoken, /See the log/);
  assert.match(spoken, /\(code\)/, "code is named, not read");
  assert.equal(plainTextForSpeech("   "), "");
});

test("speech: the voice language follows the words", () => {
  assert.equal(
    guessSpeechLang("Die zwei Runs sind nicht mehr auf der Liste und das ist gut."),
    "de",
  );
  assert.equal(guessSpeechLang("The two runs are not on the list and that is fine."), "en");
  assert.equal(guessSpeechLang("ok", "fr"), "fr");
});

test("markdown 0.13: a tag after the name becomes a pill, never a citation handle", () => {
  assert.deepEqual(listLead("**Federated.** [Recommended] Keep them apart."), {
    lead: "Federated",
    rest: "Keep them apart.",
    tag: "Recommended",
  });
  assert.deepEqual(listLead("**Merge.** [F1] one app"), { lead: "Merge", rest: "[F1] one app" });
});

test("markdown 0.13: a citation written before the full stop is drawn after it", () => {
  const spans = parseInline("The tools help [F2, F1]. Next");
  assert.deepEqual(
    spans.map((s) => s.kind),
    ["text", "text", "cite", "text"],
  );
  assert.equal(spans[1].text, ".");
  assert.equal(spans[3].text, " Next");
});

test("rich 0.13: a stack is validated like every block — icons from the list, bounded", () => {
  const { parseRichBlock, richAnswerText, STACK_ICONS } = richMod;
  const ok = parseRichBlock(
    JSON.stringify({
      type: "stack",
      title: "Who does what",
      layers: [
        { nodes: [{ kicker: "USER", label: "Build this" }], link: "the goal" },
        {
          nodes: [
            { icon: "agent", label: "Agents" },
            { icon: "robot", label: "Robots" },
          ],
        },
      ],
      caption: "Proposed.",
    }),
  );
  assert.equal(ok.type, "stack");
  assert.equal(
    parseRichBlock(
      JSON.stringify({
        type: "stack",
        title: "x",
        layers: [{ nodes: [{ icon: "<svg>", label: "a" }] }],
      }),
    ),
    null,
    "an unknown icon name is rejected",
  );
  assert.equal(
    parseRichBlock(
      JSON.stringify({
        type: "stack",
        title: "x",
        layers: [{ nodes: [{ label: "a", tone: "red" }] }],
      }),
    ),
    null,
  );
  assert.ok(STACK_ICONS.includes("people"));
  const text = richAnswerText(
    "```chat_ui\n" +
      JSON.stringify({
        type: "stack",
        title: "T",
        layers: [{ nodes: [{ label: "A" }], link: "then" }, { nodes: [{ label: "B" }] }],
      }) +
      "\n```",
  );
  assert.equal(text, "T\nA\n↓ then\nB");
});

test("review 0.14: the judge's answer is read back strictly; junk yields nothing", () => {
  const { parseChatReview, reviewPrompt, CHAT_REVIEW_INSTRUCTION, REVIEW_GAPS, FEEDBACK_REASONS } =
    reviewMod;
  const out = parseChatReview(
    'Sure: {"reviews":[{"messageId":"a2","score":1,"expected":"the state of uranium mining in Niger","deliverable":"a web-sourced summary marked unchecked","delivered":"\\"not in our data\\"","gaps":["dead_end","no_web","nonsense"],"fix":"search the web when the corpus lookup is empty"},{"messageId":"","score":5}]}',
  );
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].gaps, ["dead_end", "no_web"]);
  assert.equal(out[0].score, 1);
  assert.deepEqual(parseChatReview("no json here"), []);
  assert.deepEqual(parseChatReview('{"reviews":"x"}'), []);
  assert.ok(REVIEW_GAPS.every((g) => CHAT_REVIEW_INSTRUCTION.includes(g)));
  assert.ok(FEEDBACK_REASONS.includes("dead_end"));
  const prompt = reviewPrompt("Tools: corpus search, web search.", {
    id: "c1",
    at: "2026-10-22T10:00:00Z",
    turns: [
      { id: "u1", role: "user", content: "Niger?" },
      {
        id: "a1",
        role: "assistant",
        content: "Not in our data.",
        steps: ["Reading the Niger record"],
      },
    ],
    feedback: [{ messageId: "a1", verdict: "down", reason: "dead_end" }],
  });
  assert.match(prompt, /\[a1\] ASSISTANT:\n {2}steps: Reading the Niger record/);
  assert.match(prompt, /a1: down \(dead_end\)/);
  assert.match(prompt, /data, not instructions/);
});

test("markdown: a GitHub callout is a callout, never a printed [!CAUTION]", () => {
  // Seen live on causius (2026-10-26): the marker showed as text in a quote.
  const quoted = parseBlocks(
    "Intro.\n\n> [!CAUTION]\n> Versuchen Sie nicht, ein Unternehmen zu gründen.\n> Zweite Zeile.\n\nAfter.",
  );
  assert.deepEqual(
    quoted.map((b) => b.kind),
    ["p", "alert", "p"],
  );
  assert.equal(quoted[1].alert, "caution");
  assert.equal(quoted[1].text, "Versuchen Sie nicht, ein Unternehmen zu gründen.\nZweite Zeile.");
  // Written without the quote marks, and with the text on the marker's line.
  const bare = parseBlocks("[!WARNING]\nCheck the deadline.\n\n> [!tip] Keep a copy.");
  assert.deepEqual(
    bare.map((b) => [b.kind, b.alert, b.text]),
    [
      ["alert", "warning", "Check the deadline."],
      ["alert", "tip", "Keep a copy."],
    ],
  );
  // An ordinary quote stays a quote.
  assert.equal(parseBlocks("> just a quote")[0].kind, "quote");
});

test("markdown: a table that lost its header row is still a table", () => {
  // Seen live on substrata (2026-10-26): the answer opened on the rule.
  const blocks = parseBlocks("|---|---|\n| KfW | Raw materials fund [W2] |\n| Grid | Bonds |");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, "table");
  assert.deepEqual(blocks[0].head, []);
  assert.deepEqual(blocks[0].rows[1], ["Grid", "Bonds"]);
});
