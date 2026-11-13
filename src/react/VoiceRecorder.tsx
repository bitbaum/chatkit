"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "../messenger.js";
import { IconMic, IconStop } from "./icons.js";
import type { MessengerLabels } from "./messenger-labels.js";

/** The longest voice message: five minutes. Past it the take ends by itself. */
export const VOICE_MESSAGE_MAX_MS = 5 * 60 * 1000;

/** The container the browser can record a voice in, best first. Safari takes
 *  only MP4; everything else takes WebM/Opus, which is much smaller. */
export function voiceMimeType(
  supported: (type: string) => boolean = (type) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
): string | null {
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (supported(type)) return type;
  }
  return null;
}

/** Can this browser record a voice message at all? */
export function canRecordVoice(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    voiceMimeType() !== null
  );
}

/** "voice-2026-11-13-2004.webm": a name a person can find again in a folder. */
export function voiceFileName(at: Date, mimeType: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}`;
  const bare = mimeType.split(";")[0] ?? "";
  const ext = bare === "audio/mp4" ? "m4a" : bare === "audio/ogg" ? "ogg" : "webm";
  return `voice-${stamp}.${ext}`;
}

type Phase = "idle" | "opening" | "recording" | "recorded" | "failed";

/**
 * Record a voice message: one button to start, the same one to stop, then
 * listen to it and add it to the message or take it again. The microphone is
 * open only while recording and is closed on every way out (stop, the take
 * running to its limit, the sheet closing), so it is never left on.
 *
 * The take is handed over as a `File`; the Messenger puts it in the tray like
 * any other, so it is uploaded, shown and sent by what already sends a photo.
 */
export function VoiceRecorder({
  onDone,
  labels,
  maxMs = VOICE_MESSAGE_MAX_MS,
}: {
  onDone: (file: File) => void;
  labels: MessengerLabels;
  maxMs?: number;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<{ file: File; url: string } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  // Asked for once at a time: a second tap while the microphone is still
  // opening must not open a second one that nothing would ever close.
  const opening = useRef(false);

  const closeMicrophone = useCallback(() => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const active = recorder.current;
      recorder.current = null;
      if (active && active.state !== "inactive") {
        active.ondataavailable = null;
        active.onstop = null;
        active.stop();
      }
      closeMicrophone();
    };
  }, [closeMicrophone]);

  useEffect(() => {
    const url = take?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [take]);

  const stop = useCallback(() => {
    const active = recorder.current;
    if (active && active.state !== "inactive") active.stop();
  }, []);

  const start = useCallback(async () => {
    const mimeType = voiceMimeType();
    if (opening.current || !mimeType) return;
    opening.current = true;
    setTake(null);
    setPhase("opening");
    try {
      const opened = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        for (const track of opened.getTracks()) track.stop();
        return;
      }
      stream.current = opened;
      const chunks: Blob[] = [];
      const next = new MediaRecorder(opened, { mimeType });
      recorder.current = next;
      const began = Date.now();
      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      next.onstop = () => {
        closeMicrophone();
        recorder.current = null;
        if (!mounted.current) return;
        const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
        if (blob.size === 0) {
          setPhase("failed");
          return;
        }
        const file = new File([blob], voiceFileName(new Date(), mimeType), { type: blob.type });
        setTake({ file, url: URL.createObjectURL(blob) });
        setPhase("recorded");
      };
      next.start();
      setElapsed(0);
      setPhase("recording");
      tick.current = setInterval(() => {
        const ms = Date.now() - began;
        setElapsed(ms);
        if (ms >= maxMs) stop();
      }, 250);
    } catch {
      closeMicrophone();
      if (mounted.current) setPhase("failed");
    } finally {
      opening.current = false;
    }
  }, [closeMicrophone, maxMs, stop]);

  const recording = phase === "recording";
  return (
    <div className="ck-msgr-voice" data-phase={phase}>
      {phase !== "recorded" && (
        <>
          <button
            type="button"
            className={recording ? "ck-msgr-voice-btn ck-msgr-voice-btn-on" : "ck-msgr-voice-btn"}
            onClick={recording ? stop : () => void start()}
            disabled={phase === "opening"}
            aria-label={recording ? labels.voiceStop : labels.voiceStart}
          >
            {recording ? <IconStop /> : <IconMic />}
          </button>
          <p className="ck-msgr-voice-line" role="status">
            {recording
              ? labels.voiceRecording.replace("{time}", formatDuration(elapsed))
              : phase === "failed"
                ? labels.voiceFailed
                : labels.voiceStart}
          </p>
        </>
      )}
      {phase === "recorded" && take && (
        <>
          <audio className="ck-msgr-audio" controls src={take.url} aria-label={labels.voiceTake} />
          <div className="ck-msgr-confirm">
            <button type="button" className="ck-msgr-btn" onClick={() => void start()}>
              {labels.voiceAgain}
            </button>
            <button
              type="button"
              className="ck-msgr-btn ck-msgr-btn-primary"
              onClick={() => onDone(take.file)}
            >
              {labels.voiceAdd}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
