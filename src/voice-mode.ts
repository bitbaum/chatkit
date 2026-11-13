/**
 * Voice mode: talking with a chat instead of typing into it.
 *
 * The whole conversation is four states and the rules between them, as one
 * pure function, so the rules are tests that run in Node and every surface
 * (a chat with a bot, the Cat, a widget) takes its turns the same way:
 *
 *   listening  the microphone is open; what is heard is the person's turn
 *   thinking   the turn was sent; the answer is on its way
 *   speaking   the answer is being read aloud
 *   off        nothing is open
 *
 * The loop is listening → thinking → speaking → listening. A person can
 * always cut in: speaking + "interrupt" goes straight back to listening.
 * The microphone is never left open by accident: two takes in a row with
 * nothing in them end the call, and so does any problem, with its reason.
 */

export type VoiceModePhase = "off" | "listening" | "thinking" | "speaking";

export type VoiceModeEnd =
  /** The person ended it. */
  | "ended"
  /** Nothing was heard, twice in a row. */
  | "silence"
  /** The microphone or the transcription failed. */
  | "microphone"
  /** The answer did not come. */
  | "no-answer";

export type VoiceModeState = {
  phase: VoiceModePhase;
  /** Takes in a row with nothing in them. */
  silentTakes: number;
  /** Why the call is over, when it is; null while it runs or before it starts. */
  ended: VoiceModeEnd | null;
  /** What the person last said, shown while the answer is on its way. */
  said: string;
  /** What is being read aloud. */
  answer: string;
};

export type VoiceModeEvent =
  | { type: "start" }
  /** A take ended; `text` is what was heard ("" for nothing). */
  | { type: "heard"; text: string }
  /** The answer to the turn that was sent. */
  | { type: "answer"; text: string }
  /** The answer did not come (the send failed, or it came back empty). */
  | { type: "no-answer" }
  /** The reading finished. */
  | { type: "spoken" }
  /** The person cut in while the answer was being read. */
  | { type: "interrupt" }
  | { type: "problem" }
  | { type: "end" };

/** Two empty takes in a row and the microphone closes. */
export const VOICE_MODE_MAX_SILENT_TAKES = 2;

export const VOICE_MODE_OFF: VoiceModeState = {
  phase: "off",
  silentTakes: 0,
  ended: null,
  said: "",
  answer: "",
};

const over = (ended: VoiceModeEnd): VoiceModeState => ({ ...VOICE_MODE_OFF, ended });

export function voiceModeReducer(state: VoiceModeState, event: VoiceModeEvent): VoiceModeState {
  if (event.type === "start") {
    return state.phase === "off" ? { ...VOICE_MODE_OFF, phase: "listening" } : state;
  }
  if (state.phase === "off") return state;
  switch (event.type) {
    case "end":
      return over("ended");
    case "problem":
      return over("microphone");
    case "heard": {
      if (state.phase !== "listening") return state;
      const text = event.text.trim();
      if (text) return { ...state, phase: "thinking", silentTakes: 0, said: text, answer: "" };
      const silentTakes = state.silentTakes + 1;
      return silentTakes >= VOICE_MODE_MAX_SILENT_TAKES
        ? over("silence")
        : { ...state, silentTakes };
    }
    case "answer": {
      if (state.phase !== "thinking") return state;
      const text = event.text.trim();
      return text ? { ...state, phase: "speaking", answer: text } : over("no-answer");
    }
    case "no-answer":
      return state.phase === "thinking" ? over("no-answer") : state;
    case "spoken":
    case "interrupt":
      return state.phase === "speaking" ? { ...state, phase: "listening" } : state;
  }
}

/**
 * What each phase asks of the device. The hook does exactly this and nothing
 * else, so the microphone and the voice can never both be open, and neither
 * is open when the call is off.
 */
export function voiceModeWants(phase: VoiceModePhase): { microphone: boolean; voice: boolean } {
  return { microphone: phase === "listening", voice: phase === "speaking" };
}
