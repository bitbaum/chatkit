"use client";
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { formatElapsed } from "../composer.js";
import { IconCheck, IconSpinner, IconX } from "./icons.js";
/**
 * What has been heard so far, as one line that follows the end of the words:
 * a long sentence scrolls with the speaker instead of freezing on its start.
 */
function LiveWords({ text, dim }) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (el)
            el.scrollLeft = el.scrollWidth;
    }, [text]);
    return (_jsx("span", { ref: ref, className: dim ? "ck-voice-live ck-voice-live-dim" : "ck-voice-live", children: text }));
}
function Elapsed({ since }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (since === null)
            return;
        const t = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(t);
    }, [since]);
    return (_jsx("span", { className: "ck-voice-timer", children: formatElapsed(since === null ? 0 : (now - since) / 1000) }));
}
/** Covers its positioned parent while a take is live or being written down. */
export function VoiceBar({ dictation, labels, }) {
    const listening = dictation.status === "listening";
    const transcribing = dictation.status === "transcribing";
    if (!listening && !transcribing)
        return null;
    return (_jsx("div", { className: "ck-voice-bar", role: "status", "aria-live": "polite", children: listening ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "ck-voice-dot", "aria-hidden": true }), dictation.liveText ? (_jsx(LiveWords, { text: dictation.liveText })) : (_jsx("span", { className: "ck-voice-wave", "aria-hidden": true, children: Array.from({ length: 9 }).map((_, i) => (_jsx("span", {}, i))) })), _jsx(Elapsed, { since: dictation.startedAt }), _jsx("button", { type: "button", className: "ck-icon-btn", onClick: dictation.cancel, "aria-label": labels.cancelRecording, title: labels.cancelRecording, children: _jsx(IconX, {}) }), _jsx("button", { type: "button", className: "ck-voice-confirm", onClick: dictation.stop, "aria-label": labels.confirmRecording, title: labels.confirmRecording, children: _jsx(IconCheck, {}) })] })) : (_jsxs(_Fragment, { children: [_jsx(IconSpinner, {}), dictation.liveText ? (_jsx(LiveWords, { text: dictation.liveText, dim: true })) : (_jsx("span", { className: "ck-voice-timer", children: labels.transcribing }))] })) }));
}
/** A mic failure, in words, with the way forward: try the kept take again, or dismiss. */
export function VoiceProblem({ dictation, labels, }) {
    if (!dictation.problem)
        return null;
    return (_jsxs("p", { className: "ck-problem", role: "status", children: [_jsxs("span", { children: [labels.dictation[dictation.problem], dictation.problemDetail && (_jsxs("span", { className: "ck-problem-detail", children: [" ", dictation.problemDetail] }))] }), dictation.canRetry && (_jsx("button", { type: "button", className: "ck-problem-retry", onClick: () => void dictation.retry(), disabled: dictation.status !== "idle", children: labels.retryTake })), _jsx("button", { type: "button", className: "ck-problem-x", onClick: dictation.clearProblem, "aria-label": labels.dismiss, children: _jsx(IconX, {}) })] }));
}
//# sourceMappingURL=Voice.js.map