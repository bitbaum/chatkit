// The components render on the server (Next RSC/SSR) and carry the parts the
// standard requires. Rendered to a string: a chat that cannot even render
// without a browser is a chat that breaks every Next page it is put on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Composer, ChatThread, ChatStarters, Markdown } from "../dist/react/index.js";

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
