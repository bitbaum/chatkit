// The fixture behind demo/voice.html and test/browser-voice.mjs: VoiceMode the
// way an app mounts it. The microphone is real (the browser's fake device in
// the test); the transcription, the answer and the voice are stubs the page's
// URL steers, so the test is deterministic:
//   ?heard=<text>   what the "server" says was said ("" for nothing)
//   ?answer=<text>  what the chat answers ("" for no answer)
//   ?fail=mic       the transcription fails
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { VoiceMode, type Speaker } from "../src/react/index.js";

declare global {
  interface Window {
    __voice: { turns: string[]; spoken: string[]; speaking: boolean };
  }
}

function Fixture() {
  const q = new URLSearchParams(location.search);
  const heard = q.get("heard") ?? "what is next today";
  const answer = q.get("answer") ?? "The **report**, at five.";
  const [open, setOpen] = useState(false);
  window.__voice ??= { turns: [], spoken: [], speaking: false };
  // A voice that takes a moment, so "speaking" can be seen and cut into.
  const speaker: Speaker = {
    speak(text) {
      window.__voice.spoken.push(text);
      window.__voice.speaking = true;
      return new Promise<void>((resolve) => {
        const t = setTimeout(
          () => {
            window.__voice.speaking = false;
            resolve();
          },
          Number(q.get("voiceMs") ?? 600),
        );
        speaker.cancel = () => {
          clearTimeout(t);
          window.__voice.speaking = false;
          resolve();
        };
      });
    },
    cancel() {},
  };
  return (
    <div style={{ padding: 16 }}>
      <button type="button" id="open-voice" onClick={() => setOpen(true)}>
        Talk to Day Planner
      </button>
      <VoiceMode
        open={open}
        onClose={() => setOpen(false)}
        name="Day Planner"
        speaker={speaker}
        dictation={{
          prefer: "server",
          rememberKey: null,
          transcribe: async () => {
            if (q.get("fail") === "mic") throw new Error("down");
            return heard;
          },
        }}
        onTurn={async (text) => {
          window.__voice.turns.push(text);
          await new Promise((r) => setTimeout(r, 150));
          return answer;
        }}
      />
    </div>
  );
}

export function mountVoiceFixture() {
  const el = document.getElementById("voice-fixture");
  if (el)
    createRoot(el).render(
      <StrictMode>
        <Fixture />
      </StrictMode>,
    );
}
