// A PDF a person attaches must reach the model as something it can read.
// Found 2026-10-27: an investor deck of slide images could not be shared at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  isPdfFile,
  isTextRich,
  joinPageTexts,
  planSheets,
  readPdf,
  sheetName,
  PDF_PAGES_PER_SHEET,
} from "../dist/pdf.js";

// The files an app copies with `chatkit-copy-pdf-assets`, copied the same way.
const assets = mkdtempSync(join(tmpdir(), "chatkit-pdf-"));
execFileSync(process.execPath, [
  fileURLToPath(new URL("../bin/chatkit-copy-pdf-assets.mjs", import.meta.url)),
  assets,
]);
const assetsUrl = pathToFileURL(assets).href + "/";
const fixture = async (name) =>
  new Uint8Array(await readFile(new URL(`./fixtures/${name}`, import.meta.url)));

test("a PDF is recognised by type or by name", () => {
  assert.equal(isPdfFile({ name: "deck.PDF", type: "" }), true);
  assert.equal(isPdfFile({ name: "x", type: "application/pdf" }), true);
  assert.equal(isPdfFile({ name: "notes.txt", type: "text/plain" }), false);
});

test("page numbers alone are not a text layer", () => {
  assert.equal(isTextRich(["1", "2", "3"]), false);
  assert.equal(isTextRich([]), false);
  assert.equal(
    isTextRich([
      "A paragraph long enough to be the document itself, not a page number or a stamp.",
    ]),
    true,
  );
});

test("page markers survive so the model can cite a page", () => {
  assert.equal(joinPageTexts(["one ", " two"]), "--- page 1 ---\none\n\n--- page 2 ---\ntwo");
});

test("sheets hold four pages and stop where the message runs out of pictures", () => {
  assert.equal(PDF_PAGES_PER_SHEET, 4);
  assert.deepEqual(planSheets(6, 5), [
    [1, 2, 3, 4],
    [5, 6],
  ]);
  // A 17-page deck with room for five pictures is read whole.
  assert.equal(planSheets(17, 5).flat().length, 17);
  // With room for two, eight pages go and the caller says so.
  assert.deepEqual(planSheets(17, 2).flat(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(planSheets(3, 0), []);
});

test("a sheet is named for the pages on it", () => {
  assert.equal(sheetName("deck.pdf", 5, 8), "deck.pdf · pages 5–8");
  assert.equal(sheetName("deck.pdf", 9, 9), "deck.pdf · page 9");
});

test("a PDF with a text layer comes back as text, page by page", async () => {
  const reading = await readPdf(await fixture("text.pdf"), { maxSheets: 5, assetsUrl });
  assert.equal(reading.kind, "text");
  assert.equal(reading.pageCount, 2);
  assert.match(reading.text, /--- page 1 ---\nQuarterly report, page 1\./);
  assert.match(reading.text, /--- page 2 ---/);
});

test("a PDF of slide images is treated as pages to look at, not as empty text", async () => {
  const reading = await readPdf(await fixture("slides.pdf"), { maxSheets: 5, assetsUrl });
  assert.equal(reading.kind, "pages");
  assert.equal(reading.pageCount, 3);
  // Drawing needs a browser canvas; test/browser-pdf.mjs checks the pictures.
});
