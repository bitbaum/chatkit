import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";

const source = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const embedded = readFileSync(new URL("../styles/chat.css", import.meta.url), "utf8");
const messenger = readFileSync(new URL("../styles/messenger.css", import.meta.url), "utf8");
const appMarker = "/* ── ChatApp: the whole app";
const appBoundary = source.indexOf(appMarker);
const messengerMarker = "/* ── Messenger: people talking to people";
const messengerBoundary = source.indexOf(messengerMarker);

test("embedded stylesheet is generated from the shared chat styles", () => {
  assert.notEqual(appBoundary, -1, "the full stylesheet marks ChatApp-only styles");
  assert.equal(embedded, source.slice(0, appBoundary).trimEnd() + "\n");
});

test("embedded stylesheet includes shared chat surfaces and excludes ChatApp chrome", () => {
  for (const selector of [".ck-composer", ".ck-thread", ".ck-rich", ".ck-choice"]) {
    assert.ok(embedded.includes(selector), `${selector} remains styled`);
  }
  assert.ok(!embedded.includes(".ck-app-rail"), "the full app's history rail is not embedded");
  assert.ok(
    !embedded.includes(".ck-field-wrap"),
    "DictationField is not a chat surface: not embedded",
  );
  assert.ok(
    !embedded.includes(".ck-comments"),
    "CommentThread is not a chat surface: not embedded",
  );
  for (const selector of [
    ".ck-field-wrap",
    ".ck-field-input",
    ".ck-comments",
    ".ck-comment-body",
  ]) {
    assert.ok(
      source.slice(appBoundary).includes(selector),
      `${selector} is styled in the full sheet`,
    );
  }
  assert.ok(source.slice(appBoundary).includes(".ck-app-rail"), "full ChatApp styling remains");
});

test("embedded stylesheet stays within its compressed transfer budget", () => {
  assert.ok(
    gzipSync(embedded).byteLength <= 11_000,
    `embedded stylesheet is ${gzipSync(embedded).byteLength} bytes gzipped (budget 11,000)`,
  );
});

test("the Messenger's sheet is the embedded sheet plus its own section, and nothing of ChatApp", () => {
  assert.ok(
    messengerBoundary > appBoundary,
    "the Messenger section sits after the ChatApp boundary",
  );
  assert.equal(messenger, embedded + "\n" + source.slice(messengerBoundary).trimEnd() + "\n");
  for (const selector of [".ck-msgr", ".ck-msgr-bubble", ".ck-composer-inline", ".ck-sheet"]) {
    assert.ok(messenger.includes(selector), `${selector} is styled in the Messenger's sheet`);
  }
  assert.ok(
    !messenger.includes(".ck-app-rail"),
    "ChatApp's chat list is not in the Messenger's sheet",
  );
  assert.ok(!embedded.includes(".ck-msgr"), "the Messenger is not in the embedded chat sheet");
  assert.ok(
    embedded.includes(".ck-composer-inline"),
    "the one-row composer is a composer: embedded",
  );
});

test("message text is 16px and wraps a long address without widening the thread", () => {
  assert.match(source, /\.ck-msgr-bubble\s*\{[^}]*font-size:\s*max\(16px/);
  assert.match(source, /\.ck-msgr-bubble\s*\{[^}]*overflow-wrap:\s*break-word/);
  assert.match(source, /\.ck-msgr-search > input\s*\{[^}]*font-size:\s*max\(16px/);
});
