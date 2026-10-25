// Reading a recogniser's results list. The Android cases are modelled on the
// documented cumulative behaviour of Chrome-family recognisers on Android with
// `continuous` + `interimResults`; the first is the owner's own take in
// Substrata's Ask box (Brave, Android, 2026-10-25), which came out as
// "why why exactly why exactly is …".
import { test } from "node:test";
import assert from "node:assert/strict";
import { heardFromResults, liveWords } from "../dist/index.js";

/** One result the way the browser hands it over: array-like alternatives. */
const r = (transcript, isFinal = true) => Object.assign([{ transcript }], { isFinal });

const SENTENCE = "why exactly is it so hard to replace ASML";
const growing = SENTENCE.split(" ").map((_, i, w) => w.slice(0, i + 1).join(" "));

/** What the hook does on every event: read the whole list, show, keep the text. */
function drive(events, opts = { unflaggedIsFinal: true }) {
  let said = "";
  const shown = [];
  for (const results of events) {
    const heard = heardFromResults(results, opts);
    said = heard.text;
    shown.push(liveWords(heard.finals, heard.interim));
  }
  return { said, shown };
}

test("android: one result re-reported as it grows, final every time → one sentence", () => {
  const events = growing.map((t) => [r(t, true)]);
  const { said, shown } = drive(events);
  assert.equal(said, SENTENCE);
  assert.deepEqual(shown, growing);
});

test("android: each event appends the cumulative result at the next index → one sentence", () => {
  const events = growing.map((_, i) => growing.slice(0, i + 1).map((t) => r(t, true)));
  const { said, shown } = drive(events);
  assert.equal(said, SENTENCE);
  assert.equal(shown.at(-1), SENTENCE);
  for (const line of shown) assert.ok(!/\bwhy\b.*\bwhy\b/.test(line), line);
});

test("android: a chain that revises a word mid-way ('is is' → 'is it') still reads once", () => {
  const chain = [
    "why",
    "why exactly",
    "why exactly is",
    "why exactly is is",
    "why exactly is is so",
    "why exactly is is so hard to replace",
    SENTENCE,
  ];
  const { said } = drive([chain.map((t) => r(t, true))]);
  assert.equal(said, SENTENCE);
});

test("android: a late shorter or identical re-report is dropped", () => {
  const list = ["why exactly", "why exactly is", "why exactly", "why exactly is"].map((t) => r(t));
  assert.equal(heardFromResults(list).text, "why exactly is");
});

test("android: an interim revising a settled phrase is shown once, and ending then keeps the words", () => {
  const heard = heardFromResults([r("why exactly", true), r("why exactly is", false)]);
  assert.deepEqual(heard.finals, []);
  assert.equal(heard.interim, "why exactly is");
  assert.equal(liveWords(heard.finals, heard.interim), "why exactly is");
  // The take ends before the revision settles: the settled words are delivered.
  assert.equal(heard.text, "why exactly");
});

test("desktop: stable finals at rising indices with an interim tail read as before", () => {
  const events = [
    [r("hello", false)],
    [r("hello there", true)],
    [r("hello there", true), r(" how are", false)],
    [r("hello there", true), r(" how are you", true)],
    [r("hello there", true), r(" how are you", true), r(" doing", false)],
  ];
  const { said, shown } = drive(events);
  assert.deepEqual(shown, [
    "hello",
    "hello there",
    "hello there how are",
    "hello there how are you",
    "hello there how are you doing",
  ]);
  // Only settled words are delivered, as before.
  assert.equal(said, "hello there how are you");
});

test("desktop: an interim guess split over several results is one tail", () => {
  const heard = heardFromResults([r("hello", true), r(" how", false), r(" are you", false)]);
  assert.deepEqual(heard.finals, ["hello"]);
  assert.equal(heard.interim, "how are you");
  assert.equal(heard.text, "hello");
});

test("two genuinely different phrases are both kept", () => {
  const heard = heardFromResults([r("hello there"), r("how are you")]);
  assert.equal(heard.text, "hello there how are you");
});

test("a person who really repeats a word as separate results is not collapsed", () => {
  // Separate, non-cumulative results: nothing grows, so nothing is dropped.
  assert.equal(heardFromResults([r("no"), r("no"), r("no")]).text, "no no no");
  // On desktop two phrases that share a start are both kept.
  assert.equal(
    heardFromResults([r("I want a coffee"), r("I want a tea")]).text,
    "I want a coffee I want a tea",
  );
  // The documented limitation: "no" then "no no" as separate results is read
  // as one utterance growing, so a repeat is lost (never a new word).
  assert.equal(heardFromResults([r("no"), r("no no")]).text, "no no");
});

test("empty and whitespace results are ignored", () => {
  assert.deepEqual(heardFromResults([]), { finals: [], interim: "", text: "" });
  assert.equal(heardFromResults([r(""), r("   "), r("hello"), r(" ", false)]).text, "hello");
  assert.equal(heardFromResults([undefined, Object.assign([], { isFinal: true })]).text, "");
});

test("a result with no isFinal: settled for the browser leg, a guess for the preview", () => {
  const list = [Object.assign([{ transcript: "hello" }], {})];
  assert.equal(heardFromResults(list, { unflaggedIsFinal: true }).text, "hello");
  const preview = heardFromResults(list);
  assert.equal(preview.text, "");
  assert.equal(preview.interim, "hello");
});
