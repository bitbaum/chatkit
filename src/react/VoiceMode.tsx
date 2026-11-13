"use client";

import { useEffect, useRef } from "react";
import type { DictationProblem } from "../dictation.js";
import { plainTextForSpeech } from "../speech.js";
import type { VoiceModeEnd, VoiceModePhase } from "../voice-mode.js";
import { IconX } from "./icons.js";
import { DEFAULT_DICTATION_MESSAGES } from "../dictation.js";
import { useVoiceMode, type UseVoiceModeOptions } from "./use-voice-mode.js";

export type VoiceModeLabels = {
  title: string;
  /** Under the button, per phase: what is happening and what a press does. */
  listening: string;
  thinking: string;
  speaking: string;
  /** The big button's name for a screen reader, per phase. */
  pressListening: string;
  pressSpeaking: string;
  pressThinking: string;
  end: string;
  again: string;
  /** Why the call is over. */
  ended: Record<Exclude<VoiceModeEnd, "ended">, string>;
  dictation: Record<DictationProblem, string>;
};

export const DEFAULT_VOICE_MODE_LABELS: VoiceModeLabels = {
  dictation: DEFAULT_DICTATION_MESSAGES,
  title: "Talk",
  listening: "Listening. Tap when you have finished.",
  thinking: "Thinking…",
  speaking: "Tap to cut in.",
  pressListening: "I have finished speaking",
  pressSpeaking: "Stop reading and listen to me",
  pressThinking: "Waiting for the answer",
  end: "End",
  again: "Talk again",
  ended: {
    silence: "Nothing was heard, so the microphone is closed.",
    microphone: "The microphone stopped.",
    "no-answer": "No answer came. Your words are in the chat; try again there.",
  },
};

export type VoiceModeProps = UseVoiceModeOptions & {
  open: boolean;
  onClose: () => void;
  /** Who is being talked to, shown above the button. */
  name?: string;
  labels?: Partial<VoiceModeLabels>;
};

/**
 * A spoken conversation, full screen: one big button, what was heard, what is
 * being said back, and End. Open it from a tap (browsers open a microphone
 * and a voice only inside one); closing it shuts both.
 *
 * The loop and its rules are `useVoiceMode` and `voiceModeReducer`. This is
 * only the screen, so every chat that offers voice looks and behaves the same.
 */
export function VoiceMode({ open, onClose, name, labels: given, ...opts }: VoiceModeProps) {
  const labels = { ...DEFAULT_VOICE_MODE_LABELS, ...given };
  const vm = useVoiceMode(opts);
  const ref = useRef<HTMLDialogElement>(null);
  const { start, end, state } = vm;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open && typeof d.showModal === "function") {
      d.showModal();
      start();
    } else if (!open && d.open) {
      end();
      d.close();
    }
  }, [open, start, end]);
  // Unmounting ends the call too: a microphone that outlives its screen is the worst bug a chat can have.
  useEffect(() => () => end(), [end]);

  const phase: VoiceModePhase = state.phase;
  const line =
    phase === "listening"
      ? vm.dictation.liveText || labels.listening
      : phase === "thinking"
        ? state.said
        : phase === "speaking"
          ? plainTextForSpeech(state.answer)
          : "";
  const reason =
    state.ended && state.ended !== "ended"
      ? vm.dictation.problem
        ? labels.dictation[vm.dictation.problem]
        : labels.ended[state.ended]
      : null;

  return (
    <dialog
      ref={ref}
      className="ck-voicemode"
      aria-label={name ? `${labels.title}: ${name}` : labels.title}
      onClose={() => {
        end();
        onClose();
      }}
    >
      <div className="ck-voicemode-top">
        <span className="ck-voicemode-name">{name ?? labels.title}</span>
        <button type="button" className="ck-icon-btn" aria-label={labels.end} onClick={onClose}>
          <IconX />
        </button>
      </div>

      <div className="ck-voicemode-body" data-phase={phase} data-mic={vm.dictation.status}>
        {phase === "off" ? (
          <>
            {reason && (
              <p className="ck-voicemode-reason" role="status">
                {reason}
              </p>
            )}
            <button type="button" className="ck-voicemode-again" onClick={start}>
              {labels.again}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="ck-voicemode-orb"
              data-phase={phase}
              disabled={phase === "thinking"}
              aria-label={
                phase === "listening"
                  ? labels.pressListening
                  : phase === "speaking"
                    ? labels.pressSpeaking
                    : labels.pressThinking
              }
              onClick={vm.press}
            >
              <span className="ck-voicemode-ring" aria-hidden="true" />
            </button>
            <p className="ck-voicemode-status" role="status">
              {phase === "listening"
                ? labels.listening
                : phase === "thinking"
                  ? labels.thinking
                  : labels.speaking}
            </p>
            {line && line !== labels.listening && (
              <p className="ck-voicemode-line" data-phase={phase}>
                {line}
              </p>
            )}
          </>
        )}
      </div>

      <div className="ck-voicemode-foot">
        <button type="button" className="ck-voicemode-end" onClick={onClose}>
          {labels.end}
        </button>
      </div>
    </dialog>
  );
}
