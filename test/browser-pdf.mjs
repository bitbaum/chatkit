// A PDF of slide images, read in a real browser: the pages must come back as
// pictures a vision model can read, four to a sheet.
//
//   pnpm run build && node test/browser-pdf.mjs [path/to/any.pdf]
//   (CHROME_PATH=/path/to/chrome to use an installed Chrome)
//
// Found 2026-10-27: an investor deck exported as 17 slide images had no text
// layer, so a text-only reader saw nothing and the chat refused it.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
// The files an app copies with `chatkit-copy-pdf-assets`, copied the same way.
execFileSync(process.execPath, [
  join(root, "bin/chatkit-copy-pdf-assets.mjs"),
  join(root, "demo/pdfjs"),
]);
const extra = process.argv[2] ? resolve(process.argv[2]) : null;
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript" };
const page = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{"pdfjs-dist/":"/node_modules/pdfjs-dist/"}}</script>
<script type="module">
  import { readPdf } from "/dist/pdf.js";
  window.read = async (url, maxSheets) => {
    const data = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const r = await readPdf(data, {
      maxSheets,
      assetsUrl: "/demo/pdfjs/",
    });
    if (r.kind !== "pages") return r;
    const sizes = await Promise.all(r.sheets.map(async (s) => {
      const img = new Image(); img.src = s.dataUrl; await img.decode();
      return { first: s.firstPage, last: s.lastPage, w: img.naturalWidth, h: img.naturalHeight, kb: Math.round(s.dataUrl.length * 0.75 / 1024) };
    }));
    // Ink on the first sheet: a page that failed to decode draws as plain white.
    const probe = new Image(); probe.src = r.sheets[0].dataUrl; await probe.decode();
    const c = document.createElement("canvas"); c.width = 64; c.height = 36;
    const g = c.getContext("2d"); g.drawImage(probe, 0, 0, 64, 36);
    const px = g.getImageData(0, 0, 64, 36).data;
    let dark = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] < 600) dark++;
    return { kind: r.kind, pageCount: r.pageCount, pagesShown: r.pagesShown, sizes, inkShare: dark / (px.length / 4), first: r.sheets[0]?.dataUrl };
  };
  window.ready = true;
</script>`;

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (pathname === "/") return res.writeHead(200, { "content-type": "text/html" }).end(page);
  if (pathname === "/extra.pdf" && extra) return res.writeHead(200).end(await readFile(extra));
  const path = normalize(join(root, pathname));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  let body;
  try {
    body = await readFile(path);
  } catch {
    return res.writeHead(404).end();
  }
  res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
  res.end(body);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const executablePath = process.env.CHROME_PATH || undefined;
const browser = await chromium.launch({ executablePath });
try {
  const tab = await browser.newPage();
  if (process.env.DEBUG_PDF) tab.on("console", (m) => console.log("[page]", m.type(), m.text()));
  await tab.goto(base);
  await tab.waitForFunction(() => window.ready === true);

  const slides = await tab.evaluate((u) => window.read(u, 5), `${base}/test/fixtures/slides.pdf`);
  assert.equal(slides.kind, "pages");
  assert.equal(slides.pagesShown, 3);
  assert.equal(slides.sizes.length, 1, "three pages fit one sheet");
  assert.equal(slides.sizes[0].w, 2 * 784 + 8, "two pages side by side, each 784px wide");
  assert.ok(slides.sizes[0].h > 2 * 400, "two rows for three pages");

  assert.ok(slides.inkShare > 0.3, "the slides are drawn, not blank");

  const jpx = await tab.evaluate((u) => window.read(u, 5), `${base}/test/fixtures/slides-jpx.pdf`);
  assert.equal(jpx.kind, "pages");
  assert.ok(jpx.inkShare > 0.3, "JPEG 2000 pages are decoded (macOS's compressed export)");

  const text = await tab.evaluate((u) => window.read(u, 5), `${base}/test/fixtures/text.pdf`);
  assert.equal(text.kind, "text");

  if (extra) {
    const r = await tab.evaluate((u) => window.read(u, 5), `${base}/extra.pdf`);
    const { first, ...summary } = r;
    console.log(JSON.stringify(summary, null, 2));
    if (first) {
      const out = process.env.SHEET_OUT;
      if (out) {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(out, Buffer.from(first.split(",")[1], "base64"));
        console.log("first sheet written to", out);
      }
    }
  }
  console.log("browser-pdf: ok");
} finally {
  await browser.close();
  server.close();
}
