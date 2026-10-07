// The fleet's file-input check: the one rule every app runs in CI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const bin = fileURLToPath(new URL("../bin/chatkit-check-file-inputs.mjs", import.meta.url));
const fixtures = fileURLToPath(new URL("./fixtures/file-inputs/", import.meta.url));
const run = (dir) => spawnSync(process.execPath, [bin, dir], { encoding: "utf8" });

test("single-family inputs, ambiguous containers and justified exceptions pass", () => {
  const r = run(`${fixtures}ok`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /none mixes file families/);
});

test("a mixed accept fails, naming the file, line and families", () => {
  const r = run(`${fixtures}bad`);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Mixed\.tsx:1 .*image \+ document/);
  assert.match(r.stderr, /Mixed\.tsx:2 .*audio \+ document/);
  assert.match(r.stderr, /@bitbaum\/chatkit\/attach/);
  // A trailing comment must not hide the input before it ("image/*" holds "/*").
  assert.match(r.stderr, /Trailing\.tsx:1 /);
  assert.match(r.stderr, /Trailing\.tsx:2 /);
});
