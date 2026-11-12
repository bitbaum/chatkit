import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "styles.css");
const outputPath = resolve(root, "styles/chat.css");
const messengerPath = resolve(root, "styles/messenger.css");
const appMarker = "/* ── ChatApp: the whole app";
const messengerMarker = "/* ── Messenger: people talking to people";
const source = readFileSync(sourcePath, "utf8");
const boundary = source.indexOf(appMarker);
const messenger = source.indexOf(messengerMarker);

if (boundary < 0) {
  throw new Error(`Missing ChatApp stylesheet boundary in ${sourcePath}`);
}
if (messenger < boundary) {
  throw new Error(`Missing Messenger section after the ChatApp boundary in ${sourcePath}`);
}

const embedded = source.slice(0, boundary).trimEnd() + "\n";
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, embedded);
// The Messenger without ChatApp: the embedded sheet (the composer, the sheet,
// the marks it shares with a chat) and the Messenger's own section, which is
// last in styles.css so it runs to the end of the file.
writeFileSync(messengerPath, embedded + "\n" + source.slice(messenger).trimEnd() + "\n");
