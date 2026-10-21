"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createSynthSpeaker, plainTextForSpeech, type Speaker } from "../speech.js";

const noSubscribe = () => () => {};

export type SpeechController = {
  /** Something can speak here: the app's speaker, or the browser's voice. */
  supported: boolean;
  speaking: boolean;
  /** Seconds since this reading started; 0 while silent. */
  elapsed: number;
  /** Read this markdown aloud (flattened to prose first), stopping any other. */
  speak: (markdown: string) => void;
  stop: () => void;
  toggle: (markdown: string) => void;
};

/**
 * Read an answer aloud — the play button under every answer in the reference
 * apps. The browser's own voices by default: no upload, no key, works
 * offline. An app with a studio voice passes its own `speaker` (loki's
 * Orpheus voice, through the same two methods) and the button, the timer and
 * the stop are the same.
 *
 * One reading at a time: play on a second answer stops the first. Unmounting
 * stops it too — a voice that keeps reading a page you left is the
 * microphone bug's twin.
 */
export function useSpeech(speaker?: Speaker | null): SpeechController {
  const synthSupported = useSyncExternalStore(
    noSubscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );
  const supported = Boolean(speaker) || synthSupported;
  const [speaking, setSpeaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const synth = useRef<Speaker | null>(null);
  const active = useRef<Speaker | null>(null);
  const token = useRef(0);

  const stop = useCallback(() => {
    token.current++;
    active.current?.cancel();
    active.current = null;
    setSpeaking(false);
    setElapsed(0);
  }, []);

  const speak = useCallback(
    (markdown: string) => {
      const who = speaker ?? (synth.current ??= createSynthSpeaker());
      if (!who) return;
      const text = plainTextForSpeech(markdown);
      if (!text) return;
      stop();
      const my = ++token.current;
      active.current = who;
      setSpeaking(true);
      void who.speak(text).then(() => {
        if (my === token.current) {
          active.current = null;
          setSpeaking(false);
          setElapsed(0);
        }
      });
    },
    [speaker, stop],
  );

  const toggle = useCallback(
    (markdown: string) => {
      if (speaking) stop();
      else speak(markdown);
    },
    [speak, speaking, stop],
  );

  useEffect(() => {
    if (!speaking) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - started) / 1000), 500);
    return () => clearInterval(t);
  }, [speaking]);

  useEffect(() => () => stop(), [stop]);

  return { supported, speaking, elapsed, speak, stop, toggle };
}
