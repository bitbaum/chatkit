import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "styles.css");
const outputPath = resolve(root, "styles/chat.css");
const appMarker = "/* ── ChatApp: the whole app";
const source = readFileSync(sourcePath, "utf8");
const boundary = source.indexOf(appMarker);

if (boundary < 0) {
  throw new Error(`Missing ChatApp stylesheet boundary in ${sourcePath}`);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, source.slice(0, boundary).trimEnd() + "\n");
