"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { appendTranscript, composerCanSend, composerOutgoingText, formatElapsed, shouldClearDraft, } from "../composer.js";
import { DEFAULT_DICTATION_MESSAGES } from "../dictation.js";
import { useDictation } from "./use-dictation.js";
import { useAttachments } from "./use-attachments.js";
import { useAutoGrow } from "./hooks.js";
import { IconArrowUp, IconCheck, IconFile, IconMic, IconPaperclip, IconSpinner, IconStop, IconX, } from "./icons.js";
export const DEFAULT_COMPOSER_LABELS = {
    send: "Send",
    stop: "Stop generating",
    voice: "Speak instead of typing",
    voiceStop: "Stop recording",
    cancelRecording: "Cancel recording",
    confirmRecording: "Done — use what I said",
    listening: "Listening…",
    transcribing: "Transcribing…",
    attach: "Attach a screenshot or file",
    remove: (name) => `Remove ${name}`,
    dismiss: "Dismiss",
    dictation: DEFAULT_DICTATION_MESSAGES,
};
function AttachmentStrip({ attachments, labels, }) {
    if (attachments.attachments.length === 0 && !attachments.note)
        return null;
    return (_jsxs("div", { className: "ck-attach-strip", children: [attachments.attachments.map((a) => {
                const key = attachments.keyOf(a);
                return (_jsxs("div", { className: "ck-attach-item", children: [a.kind === "image" && a.previewUrl ? (_jsx("img", { src: a.previewUrl, alt: a.name, className: "ck-attach-thumb" })) : (_jsxs("span", { className: "ck-attach-file", children: [_jsx(IconFile, {}), _jsx("span", { className: "ck-truncate", children: a.name })] })), _jsx("button", { type: "button", className: "ck-attach-remove", onClick: () => attachments.remove(key), "aria-label": labels.remove(a.name), title: labels.remove(a.name), children: _jsx(IconX, {}) })] }, key));
            }), attachments.note && (_jsx("button", { type: "button", className: "ck-note", onClick: attachments.clearNote, children: attachments.note }))] }));
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
/**
 * THE composer: write words — or say them, or paste a screenshot — and send
 * them. Enter sends, Shift+Enter breaks the line, an IME composition never
 * sends half a word. 16px text, so iOS never zooms the page on focus.
 *
 * Extracted from loki `components/composer/Composer.tsx` (itself the merge of
 * four composers in one app), with heidi's microphone and orangecat's lessons.
 */
export function Composer({ onSend, placeholder, ariaLabel, disabled = false, sendBlockedReason = null, sending = false, onStop, attachmentOnlyText, attach = false, voice = {}, modes, mode, onModeChange, onEmptySlash, value, onValueChange, defaultValue = "", inputRef, density = "comfortable", above, header, tools, trailing, footer, hint, labels: labelOverrides, autoFocus, }) {
    const labels = {
        ...DEFAULT_COMPOSER_LABELS,
        ...labelOverrides,
        dictation: { ...DEFAULT_COMPOSER_LABELS.dictation, ...labelOverrides?.dictation },
    };
    const [ownText, setOwnText] = useState(defaultValue);
    const controlled = value !== undefined;
    const text = controlled ? value : ownText;
    // Mirrored so an async send compares against the CURRENT draft, not the one
    // its closure captured. Written in an effect, never during render.
    const textRef = useRef(text);
    useEffect(() => {
        textRef.current = text;
    });
    const setText = (next) => {
        const resolved = typeof next === "function" ? next(textRef.current) : next;
        textRef.current = resolved;
        if (!controlled)
            setOwnText(resolved);
        onValueChange?.(resolved);
    };
    const localRef = useRef(null);
    const textareaRef = inputRef ?? localRef;
    useAutoGrow(textareaRef, text);
    const attachOn = attach !== false;
    const attachments = useAttachments(typeof attach === "object" ? attach : {});
    const dictation = useDictation({
        ...(voice || {}),
        onText: (said) => setText((prev) => appendTranscript(prev, said)),
    });
    const voiceOn = voice !== false && dictation.supported;
    const listening = dictation.status === "listening";
    const transcribing = dictation.status === "transcribing";
    const attachCount = attachOn ? attachments.attachments.length : 0;
    const canSend = composerCanSend({
        text,
        attachmentCount: attachCount,
        attachmentOnlyText,
        sending,
        disabled,
        blocked: Boolean(sendBlockedReason),
    });
    const submit = async () => {
        if (!canSend)
            return;
        const sent = text;
        const outgoing = composerOutgoingText(sent, attachCount, attachmentOnlyText);
        const result = await onSend(outgoing, attachOn ? attachments.toWire() : []);
        if (!shouldClearDraft(result))
            return;
        // Only clear what was sent: words typed while a slow send was in flight
        // are the next message.
        if (textRef.current === sent)
            setText("");
        attachments.clear();
    };
    const fileInput = useRef(null);
    const showModes = Boolean(modes && modes.length > 1);
    return (_jsxs("div", { className: "ck-composer-wrap", children: [above, _jsxs("div", { className: "ck-composer-frame", children: [(listening || transcribing) && (_jsx("div", { className: "ck-voice-bar", role: "status", "aria-live": "polite", children: listening ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "ck-voice-dot", "aria-hidden": true }), _jsx("span", { className: "ck-voice-wave", "aria-hidden": true, children: Array.from({ length: 9 }).map((_, i) => (_jsx("span", {}, i))) }), _jsx(Elapsed, { since: dictation.startedAt }), _jsx("button", { type: "button", className: "ck-icon-btn", onClick: dictation.cancel, "aria-label": labels.cancelRecording, title: labels.cancelRecording, children: _jsx(IconX, {}) }), _jsx("button", { type: "button", className: "ck-voice-confirm", onClick: dictation.stop, "aria-label": labels.confirmRecording, title: labels.confirmRecording, children: _jsx(IconCheck, {}) })] })) : (_jsxs(_Fragment, { children: [_jsx(IconSpinner, {}), _jsx("span", { className: "ck-voice-timer", children: labels.transcribing })] })) })), _jsxs("div", { className: density === "compact" ? "ck-composer ck-composer-compact" : "ck-composer", children: [showModes && (_jsx("div", { className: "ck-modes", role: "group", children: modes.map((m) => (_jsx("button", { type: "button", className: "ck-mode", "aria-pressed": m.id === mode, title: m.hint, onClick: () => onModeChange?.(m.id), children: m.label }, m.id))) })), header, _jsx("textarea", { ref: textareaRef, className: "ck-input", rows: 1, value: text, autoFocus: autoFocus, disabled: disabled || transcribing, placeholder: listening ? labels.listening : placeholder, "aria-label": ariaLabel ?? placeholder, enterKeyHint: "send", onChange: (e) => {
                                    const next = e.target.value;
                                    if (onEmptySlash && next === "/" && text === "") {
                                        onEmptySlash();
                                        return;
                                    }
                                    setText(next);
                                }, onPaste: (e) => {
                                    if (attachOn && attachments.addFromPaste(e))
                                        e.preventDefault();
                                }, onKeyDown: (e) => {
                                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                                        e.preventDefault();
                                        void submit();
                                    }
                                } }), attachOn && _jsx(AttachmentStrip, { attachments: attachments, labels: labels }), _jsxs("div", { className: "ck-actions", children: [_jsxs("div", { className: "ck-tools", children: [attachOn && (_jsxs(_Fragment, { children: [_jsx("input", { ref: fileInput, type: "file", multiple: true, hidden: true, accept: "image/*,text/*,.md,.txt,.json,.csv,.log", onChange: (e) => {
                                                            attachments.addFiles(e.target.files);
                                                            e.target.value = "";
                                                        } }), _jsx("button", { type: "button", className: "ck-icon-btn", onClick: () => fileInput.current?.click(), disabled: disabled || attachments.full, "aria-label": labels.attach, title: labels.attach, children: _jsx(IconPaperclip, {}) })] })), voiceOn && (_jsx("button", { type: "button", className: listening ? "ck-icon-btn ck-mic ck-mic-on" : "ck-icon-btn ck-mic", onClick: dictation.toggle, disabled: disabled || transcribing, "aria-label": listening ? labels.voiceStop : labels.voice, "aria-pressed": listening, title: listening ? labels.voiceStop : labels.voice, children: transcribing ? _jsx(IconSpinner, {}) : _jsx(IconMic, {}) })), tools, hint && _jsx("span", { className: "ck-hint", children: hint })] }), _jsxs("div", { className: "ck-submit", children: [trailing, sending && onStop ? (_jsx("button", { type: "button", className: "ck-send ck-send-stop", onClick: onStop, "aria-label": labels.stop, title: labels.stop, children: _jsx(IconStop, {}) })) : (!listening && (_jsx("button", { type: "button", className: "ck-send", disabled: !canSend, onClick: () => void submit(), "aria-label": labels.send, title: sendBlockedReason ?? labels.send, children: sending ? _jsx(IconSpinner, {}) : _jsx(IconArrowUp, {}) })))] })] }), footer] })] }), dictation.problem && (_jsxs("p", { className: "ck-problem", role: "status", children: [_jsx("span", { children: labels.dictation[dictation.problem] }), _jsx("button", { type: "button", className: "ck-problem-x", onClick: dictation.clearProblem, "aria-label": labels.dismiss, children: _jsx(IconX, {}) })] }))] }));
}
//# sourceMappingURL=Composer.js.map