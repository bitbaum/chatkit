"use client";

import { richAnswerText } from "../rich.js";
import { useSyncExternalStore, type ReactNode } from "react";
import { formatElapsed } from "../composer.js";
import { plainTextForSpeech, type Speaker } from "../speech.js";
import { useClipboard } from "./hooks.js";
import { useSpeech } from "./use-speech.js";
import {
  IconCheck,
  IconCopy,
  IconRetry,
  IconShare,
  IconSpeaker,
  IconStop,
  IconThumbDown,
  IconThumbUp,
} from "./icons.js";
import { Sheet } from "./Sheet.js";
import { FEEDBACK_REASONS, type AnswerFeedback, type FeedbackReason } from "../review.js";
import { useState } from "react";

const noSubscribe = () => () => {};

export type AnswerActionsLabels = {
  copy: string;
  copied: string;
  listen: string;
  stop: string;
  share: string;
  retry: string;
  good: string;
  bad: string;
  /** The sheet after a thumb down: its title, the reasons, the box, the button. */
  feedbackTitle: string;
  feedbackReasons: Record<FeedbackReason, string>;
  feedbackMore: string;
  feedbackSend: string;
  feedbackThanks: string;
};

export const DEFAULT_ANSWER_ACTIONS_LABELS: AnswerActionsLabels = {
  copy: "Copy",
  copied: "Copied",
  listen: "Listen",
  stop: "Stop",
  share: "Share",
  retry: "Try again",
  good: "Good answer",
  bad: "Bad answer",
  feedbackTitle: "What went wrong?",
  feedbackReasons: {
    wrong: "It is wrong",
    dead_end: "It gave up instead of looking",
    vague: "Too vague",
    misread: "It misread my question",
    too_long: "Too long",
    format: "Hard to read",
    other: "Something else",
  },
  feedbackMore: "Anything to add?",
  feedbackSend: "Send",
  feedbackThanks: "Thanks, noted.",
};

/**
 * The row under an answer — Copy, Listen, Share, Try again — the same in every
 * product, so an answer is handled the same way wherever it was written.
 *
 * Every button is one that works here: Listen only where something can
 * speak, Share only where the system share sheet exists (phones), Try again
 * only when the caller can re-ask. A button that does nothing is worse than
 * a missing one. While an answer is being read, a small player takes the
 * row's place: a stop and the time read so far.
 *
 * `children` are the app's own buttons after these (loki's thumbs-down).
 */
export function AnswerActions({
  text,
  onRetry,
  speaker,
  share,
  labels: overrides,
  children,
  messageId,
  onFeedback,
}: {
  /** The answer's markdown. Copied as written; read as prose. */
  text: string;
  onRetry?: () => void;
  /** With `onFeedback`: a thumb up and a thumb down after the row. A thumb
   *  down opens a sheet asking why - one tap on a reason, words optional -
   *  so the product learns what the person wanted, not only that it failed. */
  messageId?: string;
  onFeedback?: (feedback: AnswerFeedback) => void;
  /** The app's voice. Without it, the browser's; without either, no Listen. */
  speaker?: Speaker | null;
  /** What the share sheet gets. Defaults to the answer's prose. `false` hides Share. */
  share?: { title?: string; text?: string; url?: string } | false;
  labels?: Partial<AnswerActionsLabels>;
  children?: ReactNode;
}) {
  const labels = { ...DEFAULT_ANSWER_ACTIONS_LABELS, ...overrides };
  const { copied, copy } = useClipboard();
  const [verdict, setVerdict] = useState<"up" | "down" | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<FeedbackReason | null>(null);
  const [more, setMore] = useState("");
  const feedbackOn = Boolean(onFeedback && messageId);
  const sendDown = () => {
    if (!onFeedback || !messageId) return;
    onFeedback({
      messageId,
      verdict: "down",
      ...(reason ? { reason } : {}),
      ...(more.trim() ? { text: more.trim().slice(0, 1000) } : {}),
    });
    setVerdict("down");
    setAsking(false);
  };
  const speech = useSpeech(speaker);
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );

  if (speech.speaking) {
    return (
      <div className="ck-turn-actions ck-player" role="status" aria-live="polite">
        <button
          type="button"
          className="ck-action ck-action-stop"
          onClick={speech.stop}
          aria-label={labels.stop}
        >
          <IconStop />
          <span>{labels.stop}</span>
        </button>
        <span className="ck-player-wave" aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} />
          ))}
        </span>
        <span className="ck-player-time">{formatElapsed(speech.elapsed)}</span>
      </div>
    );
  }

  return (
    <div className="ck-turn-actions">
      <button
        type="button"
        className="ck-action"
        onClick={() => copy(richAnswerText(text))}
        aria-label={copied ? labels.copied : labels.copy}
      >
        {copied ? <IconCheck /> : <IconCopy />}
        <span>{copied ? labels.copied : labels.copy}</span>
      </button>
      {speech.supported && (
        <button
          type="button"
          className="ck-action"
          onClick={() => speech.speak(text)}
          aria-label={labels.listen}
        >
          <IconSpeaker />
          <span>{labels.listen}</span>
        </button>
      )}
      {canShare && share !== false && (
        <button
          type="button"
          className="ck-action"
          // A dismissed share sheet rejects; that is the person changing their
          // mind, not an error to report.
          onClick={() =>
            void navigator
              .share({
                title: share?.title,
                text: share?.text ?? plainTextForSpeech(text),
                url: share?.url,
              })
              .catch(() => {})
          }
          aria-label={labels.share}
        >
          <IconShare />
          <span>{labels.share}</span>
        </button>
      )}
      {onRetry && (
        <button type="button" className="ck-action" onClick={onRetry}>
          <IconRetry />
          <span>{labels.retry}</span>
        </button>
      )}
      {feedbackOn && (
        <>
          <button
            type="button"
            className={verdict === "up" ? "ck-action ck-action-on" : "ck-action"}
            aria-label={labels.good}
            aria-pressed={verdict === "up"}
            title={labels.good}
            onClick={() => {
              if (verdict === "up") return;
              onFeedback!({ messageId: messageId!, verdict: "up" });
              setVerdict("up");
            }}
          >
            <IconThumbUp />
          </button>
          <button
            type="button"
            className={verdict === "down" ? "ck-action ck-action-on" : "ck-action"}
            aria-label={labels.bad}
            aria-pressed={verdict === "down"}
            title={labels.bad}
            onClick={() => setAsking(true)}
          >
            <IconThumbDown />
          </button>
          {verdict === "down" && !asking && (
            <span className="ck-feedback-thanks" role="status">
              {labels.feedbackThanks}
            </span>
          )}
          <Sheet open={asking} onClose={() => setAsking(false)} title={labels.feedbackTitle}>
            <div className="ck-feedback" role="group" aria-label={labels.feedbackTitle}>
              {FEEDBACK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={
                    reason === r ? "ck-feedback-reason ck-feedback-reason-on" : "ck-feedback-reason"
                  }
                  aria-pressed={reason === r}
                  onClick={() => setReason(r)}
                >
                  {labels.feedbackReasons[r]}
                </button>
              ))}
              <textarea
                className="ck-feedback-more"
                rows={2}
                placeholder={labels.feedbackMore}
                value={more}
                onChange={(e) => setMore(e.target.value)}
                maxLength={1000}
              />
              <button type="button" className="ck-feedback-send" onClick={sendDown}>
                {labels.feedbackSend}
              </button>
            </div>
          </Sheet>
        </>
      )}
      {children}
    </div>
  );
}
