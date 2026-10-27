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
export declare const PDF_SHEET_COLUMNS = 2;
export declare const PDF_SHEET_ROWS = 2;
export declare const PDF_PAGES_PER_SHEET: number;
/** Width of one page on a sheet; a sheet is two of these side by side. */
export declare const PDF_PAGE_WIDTH_PX = 784;
/** A PDF this large is refused before pdf.js opens it. */
export declare const PDF_MAX_BYTES: number;
/**
 * Below this many non-space characters per page, on average, the text layer
 * is treated as absent (a slide deck's page numbers, a scanner's stamp) and
 * the pages are looked at instead.
 */
export declare const PDF_MIN_TEXT_CHARS_PER_PAGE = 60;
export type PdfReading = {
    kind: "text";
    text: string;
    pageCount: number;
} | {
    kind: "pages";
    sheets: PdfSheet[];
    pageCount: number;
    pagesShown: number;
};
export interface PdfSheet {
    /** 1-based, inclusive. */
    firstPage: number;
    lastPage: number;
    dataUrl: string;
}
export declare function isPdfFile(file: {
    name: string;
    type: string;
}): boolean;
/** True when the extracted text is the document, not a few stray labels. */
export declare function isTextRich(pageTexts: string[]): boolean;
/** The pages as one text, each under a marker the Cat can cite. */
export declare function joinPageTexts(pageTexts: string[]): string;
/**
 * Which pages go on which sheet, for at most `maxSheets` sheets. Pages past
 * what fits are left out, and the caller says so.
 */
export declare function planSheets(pageCount: number, maxSheets: number): number[][];
/** "deck.pdf · pages 5–8", or "· page 9" for a sheet of one. */
export declare function sheetName(fileName: string, firstPage: number, lastPage: number): string;
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
export declare const PDF_ASSET_DIRS: readonly ["wasm", "cmaps", "standard_fonts", "iccs"];
export declare const PDF_WORKER_FILE = "pdf.worker.min.mjs";
export interface ReadPdfOptions {
    /** How many pictures the message still has room for. A text PDF needs none. */
    maxSheets: number;
    /** Base URL of the files `chatkit-copy-pdf-assets` copied, e.g. "/pdfjs/". */
    assetsUrl: string;
}
/**
 * Read a picked PDF. Throws on a file pdf.js cannot open (encrypted, corrupt)
 * — the app words that for the person. `PDF_MAX_BYTES` is checked by the app
 * before calling, so it can say so in its own words.
 */
export declare function readPdf(file: Blob | Uint8Array, opts: ReadPdfOptions): Promise<PdfReading>;
//# sourceMappingURL=pdf.d.ts.map