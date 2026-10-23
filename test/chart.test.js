// Charts in answers (0.15): chatkit holds the data contract and the fallback;
// the drawing is injected. These tests are the contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  parseRichBlock,
  parseChartBlock,
  chartFallback,
  richAnswerText,
  plainTextForSpeech,
  RICH_ANSWERS_INSTRUCTION,
} from "../dist/index.js";
import { Markdown, ChatThread, ChatScreen, RichAnswerBlock } from "../dist/react/index.js";

const bars = {
  type: "chart",
  chart: "bars",
  caption: "Gallium production, 2024",
  unit: "t",
  highlight: "China",
  rows: [
    { label: "China", value: 750, share: 98, href: "/atlas/china" },
    { label: "Japan", value: 10, estimated: true },
    { label: "Russia", value: 5, note: "USGS estimate" },
  ],
};
const share = {
  type: "chart",
  chart: "share",
  caption: "Who refines it",
  rows: [
    { label: "China", share: 98, href: "https://example.com/china" },
    { label: "Japan", share: 1 },
  ],
  other: 1,
};
const line = {
  type: "chart",
  chart: "line",
  caption: "Production by year",
  unit: "t",
  series: [
    {
      id: "cn",
      label: "China",
      points: [
        { x: 2020, y: 420 },
        { x: 2022, y: 600 },
        { x: 2024, y: 750, href: "/atlas/china" },
      ],
    },
  ],
};
const timeline = {
  type: "chart",
  chart: "timeline",
  caption: "Export controls",
  events: [
    { date: "2023-08", label: "China restricts gallium exports", tone: "down" },
    {
      date: "2024-12",
      label: "Ban on exports to the US",
      href: "/findings/ga-ban",
      kind: "policy",
    },
    { date: "2025-11", label: "Ban suspended", tone: "up" },
  ],
};
const tiles = {
  type: "chart",
  chart: "tiles",
  caption: "Gallium at a glance",
  tiles: [
    { label: "World production", value: "760 t", href: "/resources/gallium" },
    { label: "China's share", value: 98, note: "percent" },
  ],
};
const fence = (b) => "```chat_ui\n" + (typeof b === "string" ? b : JSON.stringify(b)) + "\n```";

test("every chart kind parses to the block it was written as, mirroring chartkit's props", () => {
  for (const b of [bars, share, line, timeline, tiles]) {
    assert.deepEqual(parseRichBlock(JSON.stringify(b)), b);
    assert.deepEqual(parseChartBlock(b), b);
  }
});

test("a malformed chart is rejected by the parser but keeps its caption and safe rows", () => {
  const bad = [
    { ...bars, rows: [] },
    { ...bars, rows: [{ label: "China", value: "lots" }] },
    { ...bars, rows: [{ label: "China", value: 750, share: 140 }] },
    { ...bars, rows: [{ label: "China", value: 750, href: "javascript:alert(1)" }] },
    { ...share, rows: [{ label: "China", share: -1 }] },
    { ...line, series: [{ id: "a", label: "A", points: [] }] },
    { ...line, series: [line.series[0], line.series[0]] },
    { ...timeline, events: [{ date: "2023", label: "x", tone: "sideways" }] },
    { ...tiles, tiles: Array(7).fill(tiles.tiles[0]) },
    { ...bars, chart: "pie" },
    { ...bars, caption: "" },
  ];
  for (const b of bad) assert.equal(parseRichBlock(JSON.stringify(b)), null, JSON.stringify(b));
  // The fallback keeps what a reader can use and drops what it cannot trust.
  const t = chartFallback(
    JSON.stringify({
      ...bars,
      rows: [
        { label: "China", value: 750, href: "javascript:alert(1)" },
        { label: "Japan", value: "ten" },
        { label: "<b>Russia</b>", value: 5 },
      ],
    }),
  );
  assert.equal(t.caption, bars.caption);
  assert.deepEqual(
    t.rows.map((r) => r.cells[0]),
    ["China", "<b>Russia</b>"],
  );
  assert.equal(t.rows[0].href, undefined);
  // No caption, not a chart, or partial JSON: nothing to fall back to.
  assert.equal(chartFallback(JSON.stringify({ ...bars, caption: "" })), null);
  assert.equal(chartFallback(JSON.stringify({ type: "callout", caption: "x" })), null);
  assert.equal(chartFallback('{"type":"chart","chart":"bars","caption":"Gal'), null);
});

test("without a renderer a chart is its caption and a table, never a blank", () => {
  const html = renderToStaticMarkup(h(Markdown, { text: fence(bars) }));
  assert.match(html, /ck-chart ck-chart-table/);
  assert.match(html, /<table class="ck-table"/);
  assert.match(html, /Value \(t\)/);
  assert.match(html, /<a href="\/atlas\/china" class="ck-chart-link">China<\/a>/);
  assert.match(html, /10 t \(est\.\)/);
  assert.match(html, /98 %/);
  assert.match(html, /ck-chart-caption">Gallium production, 2024</);
  for (const b of [share, line, timeline, tiles]) {
    const out = renderToStaticMarkup(h(Markdown, { text: fence(b) }));
    assert.match(out, /ck-chart-table/, b.chart);
    assert.match(out, new RegExp(b.caption), b.chart);
  }
  // A malformed block renders the same fallback instead of disappearing.
  const broken = renderToStaticMarkup(
    h(Markdown, { text: fence({ ...bars, rows: [{ label: "China", value: 750, share: 140 }] }) }),
  );
  assert.match(broken, /ck-chart-table/);
  assert.match(broken, /China/);
  // A partial block, mid-stream, still never flashes.
  assert.doesNotMatch(
    renderToStaticMarkup(h(Markdown, { text: 'Reading…\n```chat_ui\n{"type":"chart","cap' })),
    /chart/,
  );
  // And a script in a caption is text.
  const unsafe = renderToStaticMarkup(
    h(Markdown, { text: fence({ ...bars, caption: "<script>alert(1)</script>" }) }),
  );
  assert.doesNotMatch(unsafe, /<script>/);
});

test("an injected renderer draws the block; null from it hands back the fallback", () => {
  const seen = [];
  const renderers = {
    chart: (b) => {
      seen.push(b.chart);
      return b.chart === "bars" ? h("svg", { "data-drawn": b.chart }) : null;
    },
  };
  const text = fence(bars) + "\n\n" + fence(line);
  const direct = renderToStaticMarkup(h(Markdown, { text, renderers }));
  assert.match(
    direct,
    /<figure class="ck-rich ck-chart" data-chart="bars"><svg data-drawn="bars">/,
  );
  assert.match(direct, /ck-chart-table/);
  assert.deepEqual(seen, ["bars", "line"]);
  // Through the thread, and through the screen's context with no prop on the thread.
  const message = { id: "a", role: "assistant", content: text };
  const thread = renderToStaticMarkup(h(ChatThread, { messages: [message], renderers }));
  assert.match(thread, /data-drawn="bars"/);
  const screen = renderToStaticMarkup(
    h(ChatScreen, { composer: null, renderers }, h(ChatThread, { messages: [message] })),
  );
  assert.match(screen, /data-drawn="bars"/);
  const own = renderToStaticMarkup(h(RichAnswerBlock, { block: bars, renderers }));
  assert.match(own, /data-drawn="bars"/);
  // A renderer never sees a block the parser rejected.
  const rejected = [];
  renderToStaticMarkup(
    h(Markdown, {
      text: fence({ ...bars, rows: [{ label: "x", value: NaN }] }),
      renderers: { chart: (b) => rejected.push(b) && null },
    }),
  );
  assert.equal(rejected.length, 0);
});

test("copy and speech read the figures, never the wire JSON", () => {
  const text = "China leads.\n" + fence(bars);
  const copy = richAnswerText(text);
  assert.match(copy, /Gallium production, 2024\nChina — 750 t — 98 %/);
  assert.doesNotMatch(copy, /chat_ui|"rows"/);
  assert.match(plainTextForSpeech(text), /China/);
  assert.doesNotMatch(plainTextForSpeech(text), /chat_ui/);
  const broken = richAnswerText(
    fence({ ...bars, rows: [{ label: "China", value: 750, share: 140 }] }),
  );
  assert.match(broken, /Gallium production, 2024\nChina — 750 t/);
});

test("the instruction says when to draw and that figures come from tools", () => {
  assert.match(RICH_ANSWERS_INSTRUCTION, /"type":"chart","chart":"bars"/);
  for (const kind of ["share", "line", "timeline", "tiles"])
    assert.match(RICH_ANSWERS_INSTRUCTION, new RegExp(`"${kind}" with`));
  assert.match(RICH_ANSWERS_INSTRUCTION, /3 or more rows → bars/);
  assert.match(RICH_ANSWERS_INSTRUCTION, /never a chart for a figure the tools did not return/);
  assert.match(RICH_ANSWERS_INSTRUCTION, /href from the result's page or link/);
});
