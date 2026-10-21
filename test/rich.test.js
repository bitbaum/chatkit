import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseRichBlock, safeImageSrc, richAnswerText, plainTextForSpeech } from "../dist/index.js";
import { Markdown } from "../dist/react/index.js";
const diagram = {
  type: "diagram",
  title: "Dependency",
  nodes: [
    { id: "a", label: "Machine" },
    { id: "b", label: "Material" },
  ],
  edges: [{ from: "a", to: "b" }],
};
test("diagrams reject dangling edges, duplicate ids and oversized model output", () => {
  assert.deepEqual(parseRichBlock(JSON.stringify(diagram)), diagram);
  assert.equal(
    parseRichBlock(JSON.stringify({ ...diagram, edges: [{ from: "a", to: "missing" }] })),
    null,
  );
  assert.equal(
    parseRichBlock(JSON.stringify({ ...diagram, nodes: [diagram.nodes[0], diagram.nodes[0]] })),
    null,
  );
  assert.equal(parseRichBlock("x".repeat(40001)), null);
  assert.equal(parseRichBlock('{"type":"diagram"'), null);
});
test("images cannot inject protocols, credentials or markup", () => {
  for (const src of [
    "javascript:alert(1)",
    "data:image/svg+xml,<svg/>",
    "//evil.test/img",
    "/\\evil.test",
    "https://user:pass@evil.test/x",
  ])
    assert.equal(safeImageSrc(src), null);
  assert.equal(safeImageSrc("/photos/hinge.jpg"), "/photos/hinge.jpg");
  assert.equal(safeImageSrc("https://example.com/img.jpg"), "https://example.com/img.jpg");
});
test("visuals render semantic content and escape labels, without executing model code", () => {
  const html = renderToStaticMarkup(
    h(Markdown, { text: "```chat_ui\n" + JSON.stringify(diagram) + "\n```" }),
  );
  assert.match(html, /ck-diagram-nodes/);
  assert.match(html, /Machine/);
  assert.doesNotMatch(html, /<pre/);
  const unsafe = renderToStaticMarkup(
    h(Markdown, {
      text:
        "```chat_ui\n" +
        JSON.stringify({ type: "callout", title: "<script>alert(1)</script>", body: "Helpful" }) +
        "\n```",
    }),
  );
  assert.doesNotMatch(unsafe, /<script>/);
  assert.match(unsafe, /&lt;script&gt;/);
});
test("choice forms require an explicit selection and callback, partial JSON never flashes", () => {
  const text =
    "```chat_ui\n" +
    JSON.stringify({
      type: "choices",
      title: "Which part moves?",
      options: [
        { label: "Door", reply: "The door moves" },
        { label: "Both", reply: "Both move" },
      ],
      submit: "Continue diagnosis",
    }) +
    "\n```";
  const readOnly = renderToStaticMarkup(h(Markdown, { text }));
  assert.match(readOnly, /fieldset disabled/);
  assert.doesNotMatch(readOnly, /type="submit"/);
  const active = renderToStaticMarkup(h(Markdown, { text, onReply: () => {} }));
  assert.match(active, /type="radio"/);
  assert.match(active, /type="submit"[^>]*disabled/);
  assert.doesNotMatch(
    renderToStaticMarkup(h(Markdown, { text: 'Reading…\n```chat_ui\n{"type":' })),
    /\{"type"/,
  );
});

test("copy and speech describe visuals instead of reading JSON", () => {
  const text = "Here is the flow.\n```chat_ui\n" + JSON.stringify(diagram) + "\n```";
  assert.match(richAnswerText(text), /Machine → Material/);
  assert.doesNotMatch(richAnswerText(text), /chat_ui|\{"type"/);
  assert.match(plainTextForSpeech(text), /Dependency/);
  assert.doesNotMatch(plainTextForSpeech(text), /code|chat_ui/);
});

test("audio is a real provided asset with explicit playback and readable attribution", () => {
  const block = {
    type: "audio",
    title: "Morning sketch",
    src: "/morning.wav",
    creator: "Studio",
    caption: "An instrumental draft",
  };
  assert.deepEqual(parseRichBlock(JSON.stringify(block)), block);
  const text = "```chat_ui\n" + JSON.stringify(block) + "\n```";
  const html = renderToStaticMarkup(h(Markdown, { text }));
  assert.match(html, /<audio[^>]*controls=""[^>]*preload="none"/);
  assert.doesNotMatch(html, /autoplay|autoPlay/);
  assert.match(html, /Studio/);
  assert.match(richAnswerText(text), /Morning sketch — Studio/);
  assert.doesNotMatch(plainTextForSpeech(text), /chat_ui/);
  for (const src of [
    "javascript:alert(1)",
    "data:audio/wav;base64,AA==",
    "//evil.test/x",
    "https://u:p@evil.test/x",
  ]) {
    assert.equal(parseRichBlock(JSON.stringify({ ...block, src })), null);
  }
});
