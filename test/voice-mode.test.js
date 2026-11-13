// Voice mode's rules: who has the floor, and when the microphone closes.
// The loop is listening → thinking → speaking → listening; a person can cut
// in; two empty takes or any problem end the call with its reason; and the
// microphone and the voice are never both open.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VOICE_MODE_MAX_SILENT_TAKES,
  VOICE_MODE_OFF,
  voiceModeReducer,
  voiceModeWants,
} from "../dist/index.js";

const run = (events, from = VOICE_MODE_OFF) => events.reduce(voiceModeReducer, from);

test("a call opens listening, and only from off", () => {
  const s = run([{ type: "start" }]);
  assert.equal(s.phase, "listening");
  assert.equal(run([{ type: "start" }], { ...s, phase: "speaking" }).phase, "speaking");
});

test("what is heard is sent; the answer is read; then the person has the floor again", () => {
  let s = run([{ type: "start" }, { type: "heard", text: "  what is next?  " }]);
  assert.equal(s.phase, "thinking");
  assert.equal(s.said, "what is next?");
  s = run([{ type: "answer", text: "The report, at five." }], s);
  assert.equal(s.phase, "speaking");
  assert.equal(s.answer, "The report, at five.");
  s = run([{ type: "spoken" }], s);
  assert.equal(s.phase, "listening");
});

test("a person can cut in while the answer is read", () => {
  const speaking = run([
    { type: "start" },
    { type: "heard", text: "hello" },
    { type: "answer", text: "A very long answer." },
  ]);
  assert.equal(run([{ type: "interrupt" }], speaking).phase, "listening");
  // …but not while it is still thinking: there is nothing to cut into.
  const thinking = run([{ type: "start" }, { type: "heard", text: "hello" }]);
  assert.equal(run([{ type: "interrupt" }], thinking).phase, "thinking");
});

test("empty takes in a row close the microphone, and say why", () => {
  let s = run([{ type: "start" }]);
  for (let i = 1; i < VOICE_MODE_MAX_SILENT_TAKES; i++) {
    s = run([{ type: "heard", text: "   " }], s);
    assert.equal(s.phase, "listening", `still listening after ${i}`);
  }
  s = run([{ type: "heard", text: "" }], s);
  assert.equal(s.phase, "off");
  assert.equal(s.ended, "silence");
});

test("a take with words in it clears the count of empty ones", () => {
  const s = run([
    { type: "start" },
    { type: "heard", text: "" },
    { type: "heard", text: "hello" },
    { type: "answer", text: "Hi." },
    { type: "spoken" },
    { type: "heard", text: "" },
  ]);
  assert.equal(s.phase, "listening");
  assert.equal(s.silentTakes, 1);
});

test("no answer, an empty answer and a microphone problem each end the call with their reason", () => {
  const thinking = run([{ type: "start" }, { type: "heard", text: "hello" }]);
  assert.equal(run([{ type: "no-answer" }], thinking).ended, "no-answer");
  assert.equal(run([{ type: "answer", text: "  " }], thinking).ended, "no-answer");
  assert.equal(run([{ type: "problem" }], thinking).ended, "microphone");
  assert.equal(run([{ type: "end" }], thinking).ended, "ended");
  for (const s of [run([{ type: "no-answer" }], thinking), run([{ type: "problem" }], thinking)]) {
    assert.equal(s.phase, "off");
  }
});

test("events that belong to another phase change nothing", () => {
  const listening = run([{ type: "start" }]);
  assert.deepEqual(run([{ type: "answer", text: "late" }], listening), listening);
  assert.deepEqual(run([{ type: "spoken" }], listening), listening);
  const off = VOICE_MODE_OFF;
  for (const e of [{ type: "heard", text: "x" }, { type: "answer", text: "x" }, { type: "end" }]) {
    assert.deepEqual(run([e], off), off);
  }
});

test("the microphone and the voice are never both open, and neither when the call is off", () => {
  for (const phase of ["off", "listening", "thinking", "speaking"]) {
    const w = voiceModeWants(phase);
    assert.equal(w.microphone && w.voice, false, phase);
  }
  assert.deepEqual(voiceModeWants("off"), { microphone: false, voice: false });
  assert.deepEqual(voiceModeWants("thinking"), { microphone: false, voice: false });
  assert.deepEqual(voiceModeWants("listening"), { microphone: true, voice: false });
  assert.deepEqual(voiceModeWants("speaking"), { microphone: false, voice: true });
});
