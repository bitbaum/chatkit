/**
 * @bitbaum/chatkit/pdf — a PDF a person attaches, read in the browser and
 * handed on the way a chat model already understands: as text, or as
 * pictures of the pages.
 *
 *   import { isPdfFile, readPdf } from "@bitbaum/chatkit/pdf";
 *
 * No model on a free chain reads a PDF file, and most paid ones bill for the
 * privilege. So the PDF never leaves the device as a PDF:
 *
 *   - A PDF with a text layer (exported from Word, Docs, a typed report) comes
 *     back as `{ kind: "text" }` with page markers kept, so the model can say
 *     "on page 4". Attach it like a .txt file.
 *   - A PDF without one (a deck exported as slide images, a scan) comes back as
 *     `{ kind: "pages" }`: the pages rendered and packed four to a sheet.
 *     Attach the sheets like photos, to a model that can see. Four to a sheet
 *     keeps each page ~780px wide — slide text stays legible — and turns a
 *     20-page deck into 5 pictures instead of 20.
 *
 * Found 2026-10-27 in OrangeCat: an investor deck (17 slide images, 13.7 MB,
 * no text layer) could not be shared with the Cat at all.
 *
 * Its own entry point, so a chat that never sees a PDF never loads pdf.js;
 * `readPdf` imports it on the first PDF. The pure parts are exported for
 * tests and for apps that word their own notices.
 */
/** Pages per sheet, as a grid. */
export const PDF_SHEET_COLUMNS = 2;
export const PDF_SHEET_ROWS = 2;
export const PDF_PAGES_PER_SHEET = PDF_SHEET_COLUMNS * PDF_SHEET_ROWS;
/** Width of one page on a sheet; a sheet is two of these side by side. */
export const PDF_PAGE_WIDTH_PX = 784;
/** A PDF this large is refused before pdf.js opens it. */
export const PDF_MAX_BYTES = 40 * 1024 * 1024;
/**
 * Below this many non-space characters per page, on average, the text layer
 * is treated as absent (a slide deck's page numbers, a scanner's stamp) and
 * the pages are looked at instead.
 */
export const PDF_MIN_TEXT_CHARS_PER_PAGE = 60;
const SHEET_JPEG_QUALITY = 0.82;
export function isPdfFile(file) {
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
/** True when the extracted text is the document, not a few stray labels. */
export function isTextRich(pageTexts) {
    if (pageTexts.length === 0) {
        return false;
    }
    const chars = pageTexts.reduce((n, t) => n + t.replace(/\s+/g, "").length, 0);
    return chars / pageTexts.length >= PDF_MIN_TEXT_CHARS_PER_PAGE;
}
/** The pages as one text, each under a marker the Cat can cite. */
export function joinPageTexts(pageTexts) {
    return pageTexts
        .map((t, i) => `--- page ${i + 1} ---\n${t.trim()}`)
        .join("\n\n")
        .trim();
}
/**
 * Which pages go on which sheet, for at most `maxSheets` sheets. Pages past
 * what fits are left out, and the caller says so.
 */
export function planSheets(pageCount, maxSheets) {
    const shown = Math.min(pageCount, Math.max(0, maxSheets) * PDF_PAGES_PER_SHEET);
    const sheets = [];
    for (let first = 1; first <= shown; first += PDF_PAGES_PER_SHEET) {
        const pages = [];
        for (let p = first; p < first + PDF_PAGES_PER_SHEET && p <= shown; p++) {
            pages.push(p);
        }
        sheets.push(pages);
    }
    return sheets;
}
/** "deck.pdf · pages 5–8", or "· page 9" for a sheet of one. */
export function sheetName(fileName, firstPage, lastPage) {
    return firstPage === lastPage
        ? `${fileName} · page ${firstPage}`
        : `${fileName} · pages ${firstPage}–${lastPage}`;
}
let pdfjsPromise = null;
/**
 * Where pdf.js's own runtime files live — the worker, the image decoders
 * (JPEG 2000, JBIG2), CMaps, standard fonts, ICC profiles. They are fetched by
 * URL at runtime, which a bundler cannot follow, so an app copies them into its
 * static folder with `chatkit-copy-pdf-assets public/pdfjs` and passes
 * `assetsUrl: "/pdfjs/"`. Served from the app's own origin, they also pass a
 * strict Content-Security-Policy. Missing decoders are why a page whose
 * pictures are JPEG 2000 — macOS's "reduce file size" export, the deck this
 * was written for — draws blank.
 */
export const PDF_ASSET_DIRS = ["wasm", "cmaps", "standard_fonts", "iccs"];
export const PDF_WORKER_FILE = "pdf.worker.min.mjs";
function withSlash(url) {
    return url.endsWith("/") ? url : `${url}/`;
}
/** pdf.js, loaded on the first PDF — never part of the chat's first paint. */
function loadPdfJs(assetsUrl) {
    if (!pdfjsPromise) {
        pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
            pdfjs.GlobalWorkerOptions.workerSrc = `${withSlash(assetsUrl)}${PDF_WORKER_FILE}`;
            return pdfjs;
        });
        // A failed load (offline, blocked chunk) must not poison the next try.
        pdfjsPromise.catch(() => {
            pdfjsPromise = null;
        });
    }
    return pdfjsPromise;
}
async function pageTextsOf(doc) {
    const texts = [];
    for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        let text = "";
        for (const item of content.items) {
            if ("str" in item) {
                text += item.str + (item.hasEOL ? "\n" : " ");
            }
        }
        texts.push(text.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " "));
        page.cleanup();
    }
    return texts;
}
async function renderSheet(doc, pages) {
    // Rendering needs a canvas; outside a browser the pages are simply not drawn.
    if (typeof document === "undefined")
        return null;
    const rendered = [];
    for (const n of pages) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: PDF_PAGE_WIDTH_PX / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return null;
        }
        // White, not transparent: a JPEG turns transparency black.
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        rendered.push(canvas);
        page.cleanup();
    }
    if (rendered.length === 0) {
        return null;
    }
    const cols = Math.min(PDF_SHEET_COLUMNS, rendered.length);
    const rows = Math.ceil(rendered.length / PDF_SHEET_COLUMNS);
    const cellW = PDF_PAGE_WIDTH_PX;
    const cellH = Math.max(...rendered.map((c) => c.height));
    const gap = 8;
    const sheet = document.createElement("canvas");
    sheet.width = cols * cellW + (cols - 1) * gap;
    sheet.height = rows * cellH + (rows - 1) * gap;
    const ctx = sheet.getContext("2d");
    if (!ctx) {
        return null;
    }
    // The gaps read as page edges; grey so a white page still has one.
    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    rendered.forEach((c, i) => {
        const x = (i % PDF_SHEET_COLUMNS) * (cellW + gap);
        const y = Math.floor(i / PDF_SHEET_COLUMNS) * (cellH + gap);
        ctx.drawImage(c, x, y);
    });
    return sheet.toDataURL("image/jpeg", SHEET_JPEG_QUALITY);
}
/**
 * Read a picked PDF. Throws on a file pdf.js cannot open (encrypted, corrupt)
 * — the app words that for the person. `PDF_MAX_BYTES` is checked by the app
 * before calling, so it can say so in its own words.
 */
export async function readPdf(file, opts) {
    const pdfjs = await loadPdfJs(opts.assetsUrl);
    const data = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
    const base = withSlash(opts.assetsUrl);
    const task = pdfjs.getDocument({
        data,
        wasmUrl: `${base}wasm/`,
        cMapUrl: `${base}cmaps/`,
        standardFontDataUrl: `${base}standard_fonts/`,
        iccUrl: `${base}iccs/`,
    });
    const doc = await task.promise;
    try {
        const pageTexts = await pageTextsOf(doc);
        if (isTextRich(pageTexts)) {
            return { kind: "text", text: joinPageTexts(pageTexts), pageCount: doc.numPages };
        }
        const sheets = [];
        for (const pages of planSheets(doc.numPages, opts.maxSheets)) {
            const dataUrl = await renderSheet(doc, pages);
            if (dataUrl) {
                sheets.push({ firstPage: pages[0], lastPage: pages[pages.length - 1], dataUrl });
            }
        }
        const pagesShown = sheets.length > 0 ? sheets[sheets.length - 1].lastPage : 0;
        return { kind: "pages", sheets, pageCount: doc.numPages, pagesShown };
    }
    finally {
        void task.destroy();
    }
}
//# sourceMappingURL=pdf.js.map