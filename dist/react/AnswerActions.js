"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { richAnswerText } from "../rich.js";
import { useSyncExternalStore } from "react";
import { formatElapsed } from "../composer.js";
import { plainTextForSpeech } from "../speech.js";
import { useClipboard } from "./hooks.js";
import { useSpeech } from "./use-speech.js";
import { IconCheck, IconCopy, IconRetry, IconShare, IconSpeaker, IconStop, IconThumbDown, IconThumbUp, } from "./icons.js";
import { Sheet } from "./Sheet.js";
import { FEEDBACK_REASONS } from "../review.js";
import { useState } from "react";
const noSubscribe = () => () => { };
export const DEFAULT_ANSWER_ACTIONS_LABELS = {
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
export function AnswerActions({ text, onRetry, speaker, share, labels: overrides, children, messageId, onFeedback, }) {
    const labels = { ...DEFAULT_ANSWER_ACTIONS_LABELS, ...overrides };
    const { copied, copy } = useClipboard();
    const [verdict, setVerdict] = useState(null);
    const [asking, setAsking] = useState(false);
    const [reason, setReason] = useState(null);
    const [more, setMore] = useState("");
    const feedbackOn = Boolean(onFeedback && messageId);
    const sendDown = () => {
        if (!onFeedback || !messageId)
            return;
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
    const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator !== "undefined" && typeof navigator.share === "function", () => false);
    if (speech.speaking) {
        return (_jsxs("div", { className: "ck-turn-actions ck-player", role: "status", "aria-live": "polite", children: [_jsxs("button", { type: "button", className: "ck-action ck-action-stop", onClick: speech.stop, "aria-label": labels.stop, children: [_jsx(IconStop, {}), _jsx("span", { children: labels.stop })] }), _jsx("span", { className: "ck-player-wave", "aria-hidden": true, children: Array.from({ length: 7 }).map((_, i) => (_jsx("span", {}, i))) }), _jsx("span", { className: "ck-player-time", children: formatElapsed(speech.elapsed) })] }));
    }
    return (_jsxs("div", { className: "ck-turn-actions", children: [_jsxs("button", { type: "button", className: "ck-action", onClick: () => copy(richAnswerText(text)), "aria-label": copied ? labels.copied : labels.copy, children: [copied ? _jsx(IconCheck, {}) : _jsx(IconCopy, {}), _jsx("span", { children: copied ? labels.copied : labels.copy })] }), speech.supported && (_jsxs("button", { type: "button", className: "ck-action", onClick: () => speech.speak(text), "aria-label": labels.listen, children: [_jsx(IconSpeaker, {}), _jsx("span", { children: labels.listen })] })), canShare && share !== false && (_jsxs("button", { type: "button", className: "ck-action", 
                // A dismissed share sheet rejects; that is the person changing their
                // mind, not an error to report.
                onClick: () => void navigator
                    .share({
                    title: share?.title,
                    text: share?.text ?? plainTextForSpeech(text),
                    url: share?.url,
                })
                    .catch(() => { }), "aria-label": labels.share, children: [_jsx(IconShare, {}), _jsx("span", { children: labels.share })] })), onRetry && (_jsxs("button", { type: "button", className: "ck-action", onClick: onRetry, children: [_jsx(IconRetry, {}), _jsx("span", { children: labels.retry })] })), feedbackOn && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: verdict === "up" ? "ck-action ck-action-on" : "ck-action", "aria-label": labels.good, "aria-pressed": verdict === "up", title: labels.good, onClick: () => {
                            if (verdict === "up")
                                return;
                            onFeedback({ messageId: messageId, verdict: "up" });
                            setVerdict("up");
                        }, children: _jsx(IconThumbUp, {}) }), _jsx("button", { type: "button", className: verdict === "down" ? "ck-action ck-action-on" : "ck-action", "aria-label": labels.bad, "aria-pressed": verdict === "down", title: labels.bad, onClick: () => setAsking(true), children: _jsx(IconThumbDown, {}) }), verdict === "down" && !asking && (_jsx("span", { className: "ck-feedback-thanks", role: "status", children: labels.feedbackThanks })), _jsx(Sheet, { open: asking, onClose: () => setAsking(false), title: labels.feedbackTitle, children: _jsxs("div", { className: "ck-feedback", role: "group", "aria-label": labels.feedbackTitle, children: [FEEDBACK_REASONS.map((r) => (_jsx("button", { type: "button", className: reason === r ? "ck-feedback-reason ck-feedback-reason-on" : "ck-feedback-reason", "aria-pressed": reason === r, onClick: () => setReason(r), children: labels.feedbackReasons[r] }, r))), _jsx("textarea", { className: "ck-feedback-more", rows: 2, placeholder: labels.feedbackMore, value: more, onChange: (e) => setMore(e.target.value), maxLength: 1000 }), _jsx("button", { type: "button", className: "ck-feedback-send", onClick: sendDown, children: labels.feedbackSend })] }) })] })), children] }));
}
//# sourceMappingURL=AnswerActions.js.map