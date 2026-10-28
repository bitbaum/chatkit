import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";

const source = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const embedded = readFileSync(new URL("../styles/chat.css", import.meta.url), "utf8");
const appMarker = "/* ── ChatApp: the whole app";
const appBoundary = source.indexOf(appMarker);

test("embedded stylesheet is generated from the shared chat styles", () => {
  assert.notEqual(appBoundary, -1, "the full stylesheet marks ChatApp-only styles");
  assert.equal(embedded, source.slice(0, appBoundary).trimEnd() + "\n");
});

test("embedded stylesheet includes shared chat surfaces and excludes ChatApp chrome", () => {
  for (const selector of [".ck-composer", ".ck-thread", ".ck-rich", ".ck-choice"]) {
    assert.ok(embedded.includes(selector), `${selector} remains styled`);
  }
  assert.ok(!embedded.includes(".ck-app-rail"), "the full app's history rail is not embedded");
  assert.ok(source.slice(appBoundary).includes(".ck-app-rail"), "full ChatApp styling remains");
});

test("embedded stylesheet stays within its compressed transfer budget", () => {
  assert.ok(
    gzipSync(embedded).byteLength <= 11_000,
    `embedded stylesheet is ${gzipSync(embedded).byteLength} bytes gzipped (budget 11,000)`,
  );
});
