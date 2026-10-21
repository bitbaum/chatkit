"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSyncExternalStore } from "react";
import { formatElapsed } from "../composer.js";
import { plainTextForSpeech } from "../speech.js";
import { useClipboard } from "./hooks.js";
import { useSpeech } from "./use-speech.js";
import { IconCheck, IconCopy, IconRetry, IconShare, IconSpeaker, IconStop } from "./icons.js";
const noSubscribe = () => () => { };
export const DEFAULT_ANSWER_ACTIONS_LABELS = {
    copy: "Copy",
    copied: "Copied",
    listen: "Listen",
    stop: "Stop",
    share: "Share",
    retry: "Try again",
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
export function AnswerActions({ text, onRetry, speaker, share, labels: overrides, children, }) {
    const labels = { ...DEFAULT_ANSWER_ACTIONS_LABELS, ...overrides };
    const { copied, copy } = useClipboard();
    const speech = useSpeech(speaker);
    const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator !== "undefined" && typeof navigator.share === "function", () => false);
    if (speech.speaking) {
        return (_jsxs("div", { className: "ck-turn-actions ck-player", role: "status", "aria-live": "polite", children: [_jsxs("button", { type: "button", className: "ck-action ck-action-stop", onClick: speech.stop, "aria-label": labels.stop, children: [_jsx(IconStop, {}), _jsx("span", { children: labels.stop })] }), _jsx("span", { className: "ck-player-wave", "aria-hidden": true, children: Array.from({ length: 7 }).map((_, i) => (_jsx("span", {}, i))) }), _jsx("span", { className: "ck-player-time", children: formatElapsed(speech.elapsed) })] }));
    }
    return (_jsxs("div", { className: "ck-turn-actions", children: [_jsxs("button", { type: "button", className: "ck-action", onClick: () => copy(text), "aria-label": copied ? labels.copied : labels.copy, children: [copied ? _jsx(IconCheck, {}) : _jsx(IconCopy, {}), _jsx("span", { children: copied ? labels.copied : labels.copy })] }), speech.supported && (_jsxs("button", { type: "button", className: "ck-action", onClick: () => speech.speak(text), "aria-label": labels.listen, children: [_jsx(IconSpeaker, {}), _jsx("span", { children: labels.listen })] })), canShare && share !== false && (_jsxs("button", { type: "button", className: "ck-action", 
                // A dismissed share sheet rejects; that is the person changing their
                // mind, not an error to report.
                onClick: () => void navigator
                    .share({
                    title: share?.title,
                    text: share?.text ?? plainTextForSpeech(text),
                    url: share?.url,
                })
                    .catch(() => { }), "aria-label": labels.share, children: [_jsx(IconShare, {}), _jsx("span", { children: labels.share })] })), onRetry && (_jsxs("button", { type: "button", className: "ck-action", onClick: onRetry, children: [_jsx(IconRetry, {}), _jsx("span", { children: labels.retry })] })), children] }));
}
//# sourceMappingURL=AnswerActions.js.map