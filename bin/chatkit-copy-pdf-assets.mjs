#!/usr/bin/env node
// Copies pdf.js's runtime files where an app serves static files, so
// `readPdf(file, { assetsUrl })` from @bitbaum/chatkit/pdf can fetch them.
//
//   chatkit-copy-pdf-assets public/pdfjs      →  readPdf(file, { assetsUrl: "/pdfjs/" })
//
// pdf.js loads its worker and its image decoders (JPEG 2000, JBIG2) by URL at
// runtime, which no bundler follows. Without them a page whose pictures are
// JPEG 2000 — macOS's "reduce file size" PDF export — draws blank (found
// 2026-10-27 on an investor deck). Run it as the first step of the app's dev
// and build scripts (pnpm skips `prebuild` hooks by default) so the files
// always match the installed pdf.js; the folder stays out of git. Idempotent.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { PDF_ASSET_DIRS, PDF_WORKER_FILE } from "../dist/pdf.js";

const dest = resolve(process.argv[2] ?? "public/pdfjs");
const require = createRequire(import.meta.url);
const pkgJson = require.resolve("pdfjs-dist/package.json");
const root = dirname(pkgJson);
const { version } = require(pkgJson);

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(join(root, "legacy", "build", PDF_WORKER_FILE), join(dest, PDF_WORKER_FILE));
for (const dir of PDF_ASSET_DIRS) {
  const from = join(root, dir);
  if (!existsSync(from)) {
    console.error(`chatkit-copy-pdf-assets: pdfjs-dist ${version} has no ${dir}/`);
    process.exit(1);
  }
  // quickjs-eval is pdf.js's sandbox for a PDF's own JavaScript, which a chat
  // never runs. Leaving it out keeps a document's scripts from having anywhere to go.
  cpSync(from, join(dest, dir), { recursive: true, filter: (p) => !p.includes("quickjs") });
}
writeFileSync(join(dest, "VERSION"), `pdfjs-dist ${version}\n`);
console.log(`chatkit-copy-pdf-assets: pdfjs-dist ${version} → ${dest}`);
