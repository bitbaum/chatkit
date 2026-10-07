#!/usr/bin/env node
// Fails when a file input asks for more than one family of files at once.
//
//   chatkit-check-file-inputs [dir ...]        (default: src app components)
//
// A phone answers <input type="file" accept="image/*,.txt,audio/*"> with a
// chooser of capture apps — Camera, Recorder, "Photos & Videos" — and no file
// browser, so the screenshot the person came to send is out of reach. Found on
// Android on 2026-10-05 in loki, orangecat and evig at once: each app had
// written its own input. The fix is one input per source (AttachMenu from
// @bitbaum/chatkit/attach); this check keeps a new one from coming back.
//
// Comments are skipped. It reads literal accept values (accept="…", accept={"…"}, accept: "…",
// accept={`…`} without interpolation). A value built at runtime is not seen,
// so build mixed lists nowhere. A line, or the line above it, carrying
// `chatkit-allow-mixed-accept: <reason>` is skipped — say why.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { acceptFamilies } from "../dist/index.js";

const roots = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const dirs = (roots.length ? roots : ["src", "app", "components"]).filter((d) => existsSync(d));
const SKIP = new Set(["node_modules", ".next", "dist", "build", "out", "coverage", ".git"]);
const EXT = /\.(tsx|jsx|ts|js|mjs)$/;
const ACCEPT = /accept\s*[=:]\s*\{?\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) yield* walk(path);
    else if (EXT.test(name) && !/\.(test|spec)\./.test(name)) yield path;
  }
}

const problems = [];
let scanned = 0;
for (const dir of dirs) {
  for (const file of walk(dir)) {
    scanned++;
    const lines = readFileSync(file, "utf8").split("\n");
    let inBlockComment = false;
    lines.forEach((line, i) => {
      // Comments describe inputs; they are not inputs. A note recording the
      // old bug ("used to be accept=\"image/*,text/*\"") must not fail CI.
      const trimmed = line.trim();
      if (inBlockComment) {
        if (trimmed.includes("*/")) inBlockComment = false;
        return;
      }
      if (/^(\/\/|\*|\{\s*\/\*)/.test(trimmed)) return;
      if (trimmed.startsWith("/*")) {
        if (!trimmed.includes("*/")) inBlockComment = true;
        return;
      }
      // "/*" opens a comment only after space, "{" or "(" — inside an accept
      // value it follows a letter ("image/*") and must survive.
      const code = line.replace(/(^|[\s{(])\/\*.*?\*\//g, "$1").replace(/(^|\s)\/\/.*$/, "$1");
      for (const m of code.matchAll(ACCEPT)) {
        const value = m[1] ?? m[2] ?? m[3] ?? "";
        const families = acceptFamilies(value);
        if (families.length < 2) continue;
        const allowed = [line, lines[i - 1] ?? ""].some((l) =>
          l.includes("chatkit-allow-mixed-accept:"),
        );
        if (allowed) continue;
        problems.push(
          `${relative(process.cwd(), file)}:${i + 1}  accept="${value}" mixes ${families.join(" + ")}`,
        );
      }
    });
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} file input(s) mix file families:\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "\n  A phone answers a mixed accept with a chooser of capture apps and no file browser." +
      "\n  Use AttachMenu from @bitbaum/chatkit/attach (Camera / Photos / Files), or one input per family.",
  );
  process.exit(1);
}
console.log(
  `✓ file inputs: none mixes file families (${scanned} files in ${dirs.join(", ") || "nothing"})`,
);
