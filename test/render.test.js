// The components render on the server (Next RSC/SSR) and carry the parts the
// standard requires. Rendered to a string: a chat that cannot even render
// without a browser is a chat that breaks every Next page it is put on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as reactMod from "../dist/react/index.js";
const { Composer, ChatThread, ChatStarters, Markdown } = reactMod;
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
  assert.doesNotMatch(files, /accept=/, "Files accepts anything: the real document browser");
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
