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

test("starters are one column at every width, never wrapping pills", () => {
  assert.match(source, /\.ck-starters-list\s*\{[^}]*flex-direction:\s*column/);
  assert.doesNotMatch(source, /\.ck-starters-list\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(source, /\.ck-starter\s*\{[^}]*width:\s*100%/);
  assert.match(source, /\.ck-starter\s*\{[^}]*min-height:\s*var\(--ck-target\)/);
  assert.match(source, /\.ck-starter\s*\{[^}]*text-align:\s*left/);
});

test("a message's actions button can take focus: hidden by opacity, never by display", () => {
  const rule = (css, selector) => {
    const at = css.indexOf(`\n${selector} {`);
    assert.notEqual(at, -1, `${selector} is styled`);
    return css.slice(at, css.indexOf("}", at));
  };
  const act = rule(messenger, ".ck-msgr-act");
  assert.doesNotMatch(act, /display:\s*none/, "a button that is not drawn cannot be tabbed to");
  assert.match(act, /opacity:\s*0/);
  assert.match(act, /width:\s*2\.75rem/, "a 44px target");
  assert.match(act, /height:\s*2\.75rem/);
  assert.match(rule(messenger, ".ck-msgr-act:focus-visible"), /opacity:\s*1/);
});
