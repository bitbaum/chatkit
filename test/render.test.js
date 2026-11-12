// The components render on the server (Next RSC/SSR) and carry the parts the
// standard requires. Rendered to a string: a chat that cannot even render
// without a browser is a chat that breaks every Next page it is put on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as reactMod from "../dist/react/index.js";
const {
  Composer,
  ChatThread,
  ChatStarters,
  Markdown,
  DictationField,
  CommentThread,
  CommentRefused,
  commentFailure,
} = reactMod;
import { AttachMenu, ATTACH_SOURCE_INPUT, shrinkImage } from "../dist/react/attach.js";

test("composer: textarea, send, and 16px guaranteed by the stylesheet", () => {
  const html = renderToStaticMarkup(h(Composer, { onSend: () => {}, placeholder: "Ask" }));
  assert.match(html, /<textarea[^>]*class="ck-input"/);
  assert.match(html, /aria-label="Send"/);
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(
    css,
    /\.ck-input\s*\{[^}]*font-size:\s*max\(16px/,
    "input must be >= 16px (iOS zoom)",
  );
  assert.match(css, /\.ck-md\s*\{[^}]*font-size:\s*var\(--ck-text\)/);
  assert.match(css, /--ck-text:\s*1rem/);
});

test("composer: the paperclip carries one input per source, not one mixed input", () => {
  const html = renderToStaticMarkup(
    h(Composer, { onSend: () => {}, placeholder: "Ask", attach: true }),
  );
  assert.match(html, /<input[^>]*data-ck-source="camera"[^>]*>/);
  assert.match(
    html,
    /<input[^>]*accept="image\/\*"[^>]*capture="environment"|capture="environment"[^>]*accept="image\/\*"/,
  );
  assert.match(html, /<input[^>]*data-ck-source="photos"/);
  const files = /<input[^>]*data-ck-source="files"[^>]*>/.exec(html)?.[0] ?? "";
  assert.ok(files, "a Files input");
  assert.match(
    files,
    /accept="application\/pdf,text\/\*/,
    "Files asks for documents: the real document browser",
  );
  assert.match(html, /aria-haspopup="dialog"/);
});

test("composer: an attachment the APP holds can be sent with no words", () => {
  const send = (props) =>
    renderToStaticMarkup(h(Composer, { onSend: () => {}, placeholder: "Ask", ...props }));
  const sendButton = (html) => /<button[^>]*aria-label="Send"[^>]*>/.exec(html)?.[0] ?? "";
  // Nothing typed, nothing held: nothing to send.
  assert.match(sendButton(send({ attachmentOnlyText: "See attached" })), /disabled/);
  // The app holds one (a reference, a staged photo): it is a message.
  assert.doesNotMatch(
    sendButton(send({ attachmentOnlyText: "See attached", heldAttachments: 1 })),
    /disabled/,
  );
  // Held, but the app never said what such a message means: still not one.
  assert.match(sendButton(send({ heldAttachments: 1 })), /disabled/);
});

test("composer: labels are translatable (heidi is not in English)", () => {
  const html = renderToStaticMarkup(
    h(Composer, { onSend: () => {}, placeholder: "Frag", labels: { send: "Senden" } }),
  );
  assert.match(html, /aria-label="Senden"/);
});

test("thread: names who speaks once two agents answer, and offers retry on the last answer", () => {
  const html = renderToStaticMarkup(
    h(ChatThread, {
      messages: [
        { id: "1", role: "user", content: "I want to earn" },
        {
          id: "2",
          role: "assistant",
          content: "Use **OrangeCat**.",
          speaker: { name: "Cat", id: "cat" },
        },
        {
          id: "3",
          role: "assistant",
          content: "I can build it.",
          speaker: { name: "Loki", id: "loki" },
        },
      ],
      onRetry: () => {},
    }),
  );
  assert.match(html, /ck-speaker">Cat</);
  assert.match(html, /ck-speaker">Loki</);
  assert.match(html, /<strong>OrangeCat<\/strong>/);
  assert.equal((html.match(/Try again/g) ?? []).length, 1, "retry only on the last answer");
  assert.match(html, /ck-from-cat/);
});

test("thread: an agent is marked as an agent and says whom it works for", () => {
  const html = renderToStaticMarkup(
    h(ChatThread, {
      messages: [
        { id: "1", role: "user", content: "Fix the sign-up" },
        {
          id: "2",
          role: "assistant",
          content: "On it.",
          speaker: { name: "Loki", id: "loki", kind: "agent", onBehalfOf: "Georgy" },
        },
        {
          id: "3",
          role: "assistant",
          content: "I reviewed it.",
          speaker: { name: "Mia", id: "mia", kind: "person" },
        },
      ],
      labels: { agent: "Agent", onBehalfOf: "für {name}" },
    }),
  );
  assert.match(
    html,
    /ck-speaker ck-speaker-agent">Loki<span class="ck-speaker-kind">Agent<\/span>/,
  );
  assert.match(html, /ck-speaker-for"> · für Georgy</);
  assert.match(html, /ck-speaker">Mia</, "a person gets no agent mark");
  assert.equal((html.match(/ck-speaker-kind/g) ?? []).length, 1);
});

test("thread: a failed turn says so, with retry — never silence", () => {
  const html = renderToStaticMarkup(
    h(ChatThread, {
      messages: [
        { id: "1", role: "user", content: "hi" },
        { id: "2", role: "assistant", content: "", failed: true },
      ],
      onRetry: () => {},
    }),
  );
  assert.match(html, /ck-failed/);
  assert.match(html, /ck-turn-pinned/, "a failed turn never hides its Retry behind a hover");
  assert.match(html, /Try again/);
});

test("thread: empty shows the starters, live shows stop", () => {
  const empty = renderToStaticMarkup(
    h(ChatThread, {
      messages: [],
      empty: h(ChatStarters, { starters: ["What can you build?"], onPick: () => {} }),
    }),
  );
  assert.match(empty, /What can you build\?/);
  const live = renderToStaticMarkup(
    h(ChatThread, {
      messages: [{ id: "1", role: "user", content: "x" }],
      live: {},
      onStop: () => {},
    }),
  );
  assert.match(live, /ck-stop/);
});

test("markdown never renders model text as HTML", () => {
  const html = renderToStaticMarkup(h(Markdown, { text: "<img src=x onerror=alert(1)> **ok**" }));
  assert.ok(!html.includes("<img"), "raw HTML must be escaped");
  assert.match(html, /&lt;img/);
});

test("attach entry: usable without the composer, sources can be narrowed", () => {
  assert.equal(typeof shrinkImage, "function");
  assert.ok(ATTACH_SOURCE_INPUT.files);
  const html = renderToStaticMarkup(
    h(AttachMenu, { onFiles: () => {}, sources: ["camera", "photos"], trigger: "Add photo" }),
  );
  assert.match(html, /data-ck-source="camera"/);
  assert.match(html, /data-ck-source="photos"/);
  assert.doesNotMatch(html, /data-ck-source="files"/, "an image uploader offers no Files");
  assert.match(html, /class="ck-attach-trigger"[^>]*>Add photo</);
});

test("markdown: cards, a table and the sources row render as such, never as HTML", () => {
  const html = renderToStaticMarkup(
    h(Markdown, {
      text: "1. **Federated.** Keep them apart [F1].\n2. **Merge.** One app.\n\n| A | B |\n|---|---|\n| 1 | 2 |",
      citations: { F1: { label: "Fleet AGENTS.md", detail: "read today", href: "https://x.ch" } },
    }),
  );
  assert.match(html, /class="ck-cards ck-cards-numbered"/);
  assert.match(html, /class="ck-card-title"><span>Federated</);
  assert.match(html, /<table class="ck-table">/);
  assert.match(html, /<th><span>A<\/span><\/th>/);
  assert.match(html, /class="ck-sources"/);
  assert.match(html, /href="https:\/\/x.ch"[^>]*class="ck-source"/);
  assert.doesNotMatch(html, /\*\*/);
});

test("answer actions: copy on every answer; listen and share only where they work", () => {
  const { AnswerActions } = reactMod;
  const html = renderToStaticMarkup(h(AnswerActions, { text: "Hello **there**" }));
  assert.match(html, /aria-label="Copy"/);
  // No voice and no share sheet on a server: neither button is rendered dead.
  assert.doesNotMatch(html, /Listen/);
  assert.doesNotMatch(html, /Share/);
  const withVoice = renderToStaticMarkup(
    h(AnswerActions, {
      text: "Hello",
      onRetry: () => {},
      speaker: { speak: async () => {}, cancel() {} },
    }),
  );
  assert.match(withVoice, /aria-label="Listen"/);
  assert.match(withVoice, /Try again/);
});

test("markdown: sources are chips on a server render, and each record keeps its link", () => {
  const html = renderToStaticMarkup(
    h(Markdown, {
      text: "Checked [F1] and [F2].",
      citations: {
        F1: { label: "Homepage", detail: "Fetched today", href: "https://x.y/" },
        F2: { label: "Notes", detail: "A note" },
      },
    }),
  );
  assert.match(html, /class="ck-sources"/);
  assert.match(html, /href="https:\/\/x.y\/"/);
  assert.match(html, /Notes/);
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.ck-source-list/, "the sheet's list is styled");
  assert.match(
    css,
    /\.ck-input::placeholder\s*\{[^}]*white-space:\s*nowrap/,
    "one-line placeholder",
  );
});

test("0.13: thought line, option tag, citation chip, stack figure and external links render", () => {
  const { ThinkingRow } = reactMod;
  const html = renderToStaticMarkup(
    h(ChatThread, {
      messages: [
        { id: "u", role: "user", content: "Options?" },
        {
          id: "a",
          role: "assistant",
          thinking: { durationMs: 218_000, steps: [{ label: "Read the map" }] },
          citations: {
            F1: { label: "Fleet AGENTS.md", detail: "x", href: "https://x.ch" },
            F2: { label: "ISO", detail: "y" },
          },
          content:
            "1. **Federated.** [Recommended] Apart [F1, F2].\n2. **Merge.** One app.\n\nSee [NVIDIA](https://developer.nvidia.com).\n\n```chat_ui\n" +
            JSON.stringify({
              type: "stack",
              title: "Who",
              layers: [
                { nodes: [{ kicker: "USER", label: "Build" }], link: "goal", both: true },
                {
                  nodes: [
                    { icon: "agent", label: "Agents" },
                    { icon: "robot", label: "Robots" },
                  ],
                },
              ],
              caption: "Proposed.",
            }) +
            "\n```",
        },
      ],
    }),
  );
  assert.match(
    html,
    /<details class="ck-thinking"><summary class="ck-thinking-title">Thought for 3m 38s/,
  );
  assert.match(html, /class="ck-card-tag">Recommended</);
  assert.match(
    html,
    /class="ck-cite"[^>]*href="https:\/\/x.ch"[^>]*><span class="ck-cite-label">Fleet AGENTS.md<\/span><span class="ck-cite-more">\+1</,
  );
  assert.match(
    html,
    /Apart<\/span><span>\.<\/span><span><a class="ck-cite"/,
    "the chip follows the full stop",
  );
  assert.match(html, /class="ck-link ck-link-out"[^>]*target="_blank"/);
  assert.match(html, /class="ck-stack-kicker">USER</);
  assert.match(html, /class="ck-stack-icon"/);
  assert.match(html, /class="ck-stack-arrow"[^>]*>⇅</);
  assert.match(html, /class="ck-stack-caption">Proposed\.</);
  assert.doesNotMatch(html, /<svg>/, "the icon name never becomes markup");
  const live = renderToStaticMarkup(
    h(ThinkingRow, {
      thinking: { steps: [{ label: "Searching" }, { label: "Reading" }] },
      live: true,
    }),
  );
  assert.match(live, /ck-thinking-live/);
  assert.match(live, /class="ck-thinking-now"><span>Reading</);
});

test("0.14: thumbs render only with onFeedback, and every label is translatable", () => {
  const withIt = renderToStaticMarkup(
    h(ChatThread, {
      messages: [{ id: "a", role: "assistant", content: "Hi" }],
      onFeedback: () => {},
      labels: { good: "Gut", bad: "Schlecht" },
    }),
  );
  assert.match(withIt, /aria-label="Gut"/);
  assert.match(withIt, /aria-label="Schlecht"/);
  assert.match(withIt, /class="ck-feedback-reason"[^>]*>It gave up instead of looking</);
  const without = renderToStaticMarkup(
    h(ChatThread, { messages: [{ id: "a", role: "assistant", content: "Hi" }] }),
  );
  assert.doesNotMatch(without, /ck-feedback/);
});

test("a callout renders as one labelled panel in the product's words", () => {
  const html = renderToStaticMarkup(
    h(Markdown, {
      text: "> [!CAUTION]\n> Nicht unterschreiben.",
      alertLabels: { caution: "Achtung" },
    }),
  );
  assert.ok(html.includes('class="ck-alert ck-alert-caution"'));
  assert.ok(html.includes("Achtung"));
  assert.ok(!html.includes("[!CAUTION]"));
});

test("a table with no header row still shows its cells", () => {
  const html = renderToStaticMarkup(
    h(Markdown, { text: "|---|---|\n| KfW | Raw materials fund |" }),
  );
  assert.ok(!html.includes("<thead"));
  assert.equal((html.match(/<td>/g) ?? []).length, 2);
  assert.ok(html.includes("KfW") && html.includes("Raw materials fund"));
});

test("a thread passes the product's word for a callout to every answer", () => {
  const html = renderToStaticMarkup(
    h(ChatThread, {
      messages: [{ id: "a", role: "assistant", content: "> [!WARNING]\n> Frist beachten." }],
      labels: { alerts: { warning: "Warnung" } },
    }),
  );
  assert.ok(html.includes("Warnung"));
  assert.ok(!html.includes("[!WARNING]"));
});

test("screen: the footnote may hold block content — it is not wrapped in a paragraph", () => {
  const { ChatScreen } = reactMod;
  const html = renderToStaticMarkup(
    h(ChatScreen, {
      composer: h("div", null, "composer"),
      footnote: h(
        "span",
        null,
        "one line",
        h("p", { className: "aside" }, "a paragraph"),
        h("form"),
      ),
      children: h("div", null, "thread"),
    }),
  );
  assert.match(html, /<div class="ck-screen-footnote">/);
  assert.doesNotMatch(html, /<p class="ck-screen-footnote"/);
  // A <p> may not contain a <p> or a <form>: a browser closes the outer one while
  // parsing, and React then hydrates a different tree (error #418).
  const footnote = /<div class="ck-screen-footnote">([\s\S]*?)<\/div><\/div><\/div>/.exec(html);
  assert.ok(footnote, "the footnote is the last block of the dock");
});

test("markdown: any product's handle is a chip; with no sources it stays words", () => {
  const citations = { L1: { label: "SteG Art. 61", detail: "Steuersatz", href: "/law/x#art_61" } };
  const cited = renderToStaticMarkup(h(Markdown, { text: "It is 12.5 % [L1].", citations }));
  assert.match(cited, /class="ck-cite"[^>]*href="\/law\/x#art_61"/);
  assert.doesNotMatch(cited, /\[L1\]/);
  const unknown = renderToStaticMarkup(h(Markdown, { text: "It is 12.5 % [L9].", citations }));
  assert.doesNotMatch(unknown, /L9/, "a dangling handle in a grounded answer is dropped");
  const prose = renderToStaticMarkup(h(Markdown, { text: "Put the total in cell [A1]." }));
  assert.match(prose, /\[A1\]/, "without sources, a bracketed code is just words");
});

test("DictationField: a labelled text area by default, an input when one line, and it renders on the server", () => {
  const area = renderToStaticMarkup(
    h(DictationField, {
      value: "hi",
      onValueChange: () => {},
      label: "Note",
      placeholder: "Write",
    }),
  );
  assert.match(area, /<label[^>]*class="ck-field-label"[^>]*>Note<\/label>/);
  assert.match(area, /<textarea[^>]*class="ck-field-input"[^>]*>hi<\/textarea>/);
  const label = /<label[^>]*for="([^"]+)"/.exec(area)?.[1];
  assert.ok(label && area.includes(`id="${label}"`), "the label points at the field");
  const line = renderToStaticMarkup(
    h(DictationField, { value: "", onValueChange: () => {}, ariaLabel: "Title", multiline: false }),
  );
  assert.match(
    line,
    /<input[^>]*type="text"[^>]*class="ck-field-input"|class="ck-field-input"[^>]*type="text"/,
  );
  assert.match(line, /ck-field-single/);
  assert.match(line, /aria-label="Title"/);
});

test("DictationField: Improve is offered only when there is text and a way to improve it", () => {
  const run = async () => "x";
  const withText = renderToStaticMarkup(
    h(DictationField, {
      value: "some text",
      onValueChange: () => {},
      ariaLabel: "n",
      improve: { run },
    }),
  );
  assert.match(withText, /class="ck-field-improve"/);
  const empty = renderToStaticMarkup(
    h(DictationField, { value: "", onValueChange: () => {}, ariaLabel: "n", improve: { run } }),
  );
  assert.doesNotMatch(empty, /ck-field-improve/);
  const none = renderToStaticMarkup(
    h(DictationField, { value: "some text", onValueChange: () => {}, ariaLabel: "n" }),
  );
  assert.doesNotMatch(none, /ck-field-improve/);
});

test("DictationField: a form's field — name, autofocus and the app's own attributes", () => {
  const html = renderToStaticMarkup(
    h(DictationField, {
      value: "hi",
      onValueChange: () => {},
      label: "Note",
      id: "note",
      name: "note",
      autoFocus: true,
      inputProps: {
        spellCheck: false,
        autoCapitalize: "sentences",
        minLength: 3,
        "data-testid": "note-box",
        // Managed props win: the app cannot take the field's id, class or label wiring.
        id: "stolen",
        className: "mine",
        // Not in the type (16px text is the package's), but a JS caller can pass it.
        style: { fontSize: "8px" },
        "aria-describedby": "app-note",
      },
      hint: "At least 3 characters",
    }),
  );
  const area = /<textarea[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(area, /name="note"/);
  assert.match(area, /autofocus=""/i);
  assert.match(area, /spellcheck="false"/i);
  assert.match(area, /autocapitalize="sentences"/i);
  assert.match(area, /minlength="3"/i);
  assert.match(area, /data-testid="note-box"/);
  assert.match(area, /id="note"/, "the managed id wins over inputProps.id");
  assert.doesNotMatch(area, /stolen|class="mine"|style=/);
  assert.match(area, /class="ck-field-input"/);
  assert.match(area, /aria-describedby="app-note note-hint"/, "an app's description is joined");
  assert.match(html, /<div id="note-hint" class="ck-field-hint">At least 3 characters<\/div>/);
  assert.doesNotMatch(area, /aria-invalid/, "no error, no aria-invalid");
  assert.doesNotMatch(html, /ck-field-invalid|ck-field-error/);
  const plain = renderToStaticMarkup(
    h(DictationField, { value: "", onValueChange: () => {}, ariaLabel: "Plain" }),
  );
  assert.doesNotMatch(plain, /aria-describedby|aria-invalid|readonly|name=|autofocus/i);
});

test("DictationField: read-only shows the text with no microphone and no Improve", () => {
  const html = renderToStaticMarkup(
    h(DictationField, {
      value: "settled",
      onValueChange: () => {},
      ariaLabel: "Note",
      readOnly: true,
      improve: { run: async () => "x" },
      voice: { transcribeUrl: "/api/transcribe" },
    }),
  );
  assert.match(html, /<textarea[^>]*readonly=""/i);
  assert.doesNotMatch(html, /ck-mic|ck-field-improve/);
});

test("DictationField: an error is said under the field and wired to it", () => {
  const html = renderToStaticMarkup(
    h(DictationField, {
      value: "",
      onValueChange: () => {},
      label: "Title",
      id: "title",
      multiline: false,
      error: "A title is needed.",
      hint: "One line",
    }),
  );
  const input = /<input[^>]*class="ck-field-input"[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(input, /aria-invalid="true"/, "error implies invalid");
  assert.match(html, /class="ck-field-wrap ck-field-invalid"/);
  assert.match(
    html,
    /<p id="title-error" class="ck-field-error" role="alert">A title is needed\.<\/p>/,
  );
  const ids = /aria-describedby="([^"]+)"/.exec(input)?.[1].split(" ") ?? [];
  assert.deepEqual(ids, ["title-error", "title-hint"]);
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `${id} exists in the markup`);
  const flagged = renderToStaticMarkup(
    h(DictationField, { value: "", onValueChange: () => {}, ariaLabel: "x", invalid: true }),
  );
  assert.match(flagged, /aria-invalid="true"/);
  assert.doesNotMatch(
    flagged,
    /ck-field-error|aria-describedby/,
    "invalid alone adds no empty error",
  );
  // A host's `error={msg ?? ""}` or `error={n && msg}` on a valid field: no
  // danger frame and no "invalid" with nothing said.
  for (const empty of ["", 0]) {
    const quiet = renderToStaticMarkup(
      h(DictationField, { value: "", onValueChange: () => {}, ariaLabel: "x", error: empty }),
    );
    assert.doesNotMatch(
      quiet,
      /ck-field-invalid|aria-invalid|ck-field-error|aria-describedby/,
      `error=${JSON.stringify(empty)} is no error`,
    );
  }
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(
    css,
    /\.ck-field-invalid > \.ck-field-frame > \.ck-field[^{]*\{[^}]*var\(--ck-danger\)/,
  );
});

test("CommentThread: count heading, oldest first, text not markup, and a way to sign in", () => {
  const comments = [
    { id: "1", author: "Ana", body: "<b>first</b>", createdAt: "2026-11-05T10:00:00Z" },
    { id: "2", author: "Ben", body: "second", createdAt: "2026-11-05T11:00:00Z" },
  ];
  const signedOut = renderToStaticMarkup(
    h(CommentThread, {
      comments,
      viewer: null,
      signInHref: "/in",
      transport: { post: async () => comments[0] },
    }),
  );
  assert.match(signedOut, /<h2[^>]*class="ck-comments-title"[^>]*>2 comments<\/h2>/);
  assert.ok(signedOut.indexOf("Ana") < signedOut.indexOf("Ben"), "oldest first");
  assert.match(signedOut, /&lt;b&gt;first&lt;\/b&gt;/, "a comment is text, never markup");
  assert.match(
    signedOut,
    /<a[^>]*class="ck-comment-signin-link"[^>]*href="\/in"|href="\/in"[^>]*class="ck-comment-signin-link"/,
  );
  assert.doesNotMatch(signedOut, /<textarea/, "a signed-out reader is not offered a box");
  const signedIn = renderToStaticMarkup(
    h(CommentThread, {
      comments: [],
      viewer: { name: "Cy" },
      transport: { post: async () => comments[0] },
    }),
  );
  assert.match(signedIn, />No comments yet<\/h2>/);
  assert.match(signedIn, /<textarea[^>]*class="ck-input"/);
  assert.match(signedIn, /Posted as Cy\./);
  const removable = renderToStaticMarkup(
    h(CommentThread, {
      comments,
      viewer: { name: "Cy" },
      canRemove: (c) => c.id === "2",
      transport: { post: async () => comments[0], remove: async () => {} },
    }),
  );
  assert.equal(
    (removable.match(/ck-comment-remove/g) ?? []).length,
    1,
    "Remove only where allowed",
  );
});

test("a refused comment says why in the app's words; any other failure shows the label", () => {
  assert.equal(
    commentFailure(new CommentRefused("Write a short comment."), "try again"),
    "Write a short comment.",
  );
  assert.equal(commentFailure(new Error("500 Internal Server Error"), "try again"), "try again");
  assert.equal(commentFailure(new TypeError("Failed to fetch"), "try again"), "try again");
  assert.equal(commentFailure({ message: "raw" }, "try again"), "try again");
  assert.equal(commentFailure(new CommentRefused("  "), "try again"), "try again");
  const e = new CommentRefused("Limit reached.", { cause: 429 });
  assert.equal(e.name, "CommentRefused");
  assert.ok(e instanceof Error);
});
