"use client";

import { useEffect, useRef, useState } from "react";
import { formatElapsed } from "../composer.js";
import type { DictationProblem } from "../dictation.js";
import type { DictationController } from "./use-dictation.js";
import { IconCheck, IconSpinner, IconX } from "./icons.js";

/**
 * The microphone's two visible states, drawn once. `Composer` and
 * `DictationField` both put them over / under their box, so a take looks and
 * behaves the same in a chat, in a comment and in a title field — the same
 * "every control the same everywhere" rule as the rest of the package.
 */

export type VoiceLabels = {
  cancelRecording: string;
  confirmRecording: string;
  transcribing: string;
  retryTake: string;
  dismiss: string;
  dictation: Record<DictationProblem, string>;
};

/**
 * What has been heard so far, as one line that follows the end of the words:
 * a long sentence scrolls with the speaker instead of freezing on its start.
 */
function LiveWords({ text, dim }: { text: string; dim?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [text]);
  return (
    <span ref={ref} className={dim ? "ck-voice-live ck-voice-live-dim" : "ck-voice-live"}>
      {text}
    </span>
  );
}

function Elapsed({ since }: { since: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [since]);
  return (
    <span className="ck-voice-timer">
      {formatElapsed(since === null ? 0 : (now - since) / 1000)}
    </span>
  );
}

/** Covers its positioned parent while a take is live or being written down. */
export function VoiceBar({
  dictation,
  labels,
}: {
  dictation: DictationController;
  labels: VoiceLabels;
}) {
  const listening = dictation.status === "listening";
  const transcribing = dictation.status === "transcribing";
  if (!listening && !transcribing) return null;
  return (
    <div className="ck-voice-bar" role="status" aria-live="polite">
      {listening ? (
        <>
          <span className="ck-voice-dot" aria-hidden />
          {dictation.liveText ? (
            <LiveWords text={dictation.liveText} />
          ) : (
            <span className="ck-voice-wave" aria-hidden>
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} />
              ))}
            </span>
          )}
          <Elapsed since={dictation.startedAt} />
          <button
            type="button"
            className="ck-icon-btn"
            onClick={dictation.cancel}
            aria-label={labels.cancelRecording}
            title={labels.cancelRecording}
          >
            <IconX />
          </button>
          <button
            type="button"
            className="ck-voice-confirm"
            onClick={dictation.stop}
            aria-label={labels.confirmRecording}
            title={labels.confirmRecording}
          >
            <IconCheck />
          </button>
        </>
      ) : (
        <>
          <IconSpinner />
          {dictation.liveText ? (
            <LiveWords text={dictation.liveText} dim />
          ) : (
            <span className="ck-voice-timer">{labels.transcribing}</span>
          )}
        </>
      )}
    </div>
  );
}

/** A mic failure, in words, with the way forward: try the kept take again, or dismiss. */
export function VoiceProblem({
  dictation,
  labels,
}: {
  dictation: DictationController;
  labels: VoiceLabels;
}) {
  if (!dictation.problem) return null;
  return (
    <p className="ck-problem" role="status">
      <span>
        {labels.dictation[dictation.problem]}
        {dictation.problemDetail && (
          <span className="ck-problem-detail"> {dictation.problemDetail}</span>
        )}
      </span>
      {dictation.canRetry && (
        <button
          type="button"
          className="ck-problem-retry"
          onClick={() => void dictation.retry()}
          disabled={dictation.status !== "idle"}
        >
          {labels.retryTake}
        </button>
      )}
      <button
        type="button"
        className="ck-problem-x"
        onClick={dictation.clearProblem}
        aria-label={labels.dismiss}
      >
        <IconX />
      </button>
    </p>
  );
}
