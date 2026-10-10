"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { appendTranscript, composerCanSend, composerOutgoingText, formatElapsed, shouldClearDraft, } from "../composer.js";
import { DEFAULT_DICTATION_MESSAGES, isAudioFile } from "../dictation.js";
import { DEFAULT_ATTACHMENT_NOTES, } from "../attachments.js";
import { useDictation } from "./use-dictation.js";
import { useAttachments } from "./use-attachments.js";
import { useAutoGrow } from "./hooks.js";
import { AttachMenu, DEFAULT_ATTACH_MENU_LABELS } from "./AttachMenu.js";
import { IconArrowUp, IconCheck, IconFile, IconMic, IconSpinner, IconStop, IconX, } from "./icons.js";
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
    attachMenu: {
        title: DEFAULT_ATTACH_MENU_LABELS.title,
        close: DEFAULT_ATTACH_MENU_LABELS.close,
        sources: DEFAULT_ATTACH_MENU_LABELS.sources,
    },
    queue: "Queue a message…",
    remove: (name) => `Remove ${name}`,
    dismiss: "Dismiss",
    retryTake: "Try again",
    dictation: DEFAULT_DICTATION_MESSAGES,
    attachNotes: DEFAULT_ATTACHMENT_NOTES,
};
function AttachmentStrip({ attachments, labels, }) {
    if (attachments.attachments.length === 0 && !attachments.note)
        return null;
    return (_jsxs("div", { className: "ck-attach-strip", children: [attachments.attachments.map((a) => {
                const key = attachments.keyOf(a);
                return (_jsxs("div", { className: "ck-attach-item", children: [a.kind === "image" && a.previewUrl ? (_jsx("img", { src: a.previewUrl, alt: a.name, className: "ck-attach-thumb" })) : (_jsxs("span", { className: "ck-attach-file", children: [_jsx(IconFile, {}), _jsx("span", { className: "ck-truncate", children: a.name })] })), _jsx("button", { type: "button", className: "ck-attach-remove", onClick: () => attachments.remove(key), "aria-label": labels.remove(a.name), title: labels.remove(a.name), children: _jsx(IconX, {}) })] }, key));
            }), attachments.note && (_jsx("button", { type: "button", className: "ck-note", onClick: attachments.clearNote, children: attachments.note }))] }));
}
/**
 * The words as they are heard, one line, always showing its end: the
 * newest words are what the person is checking. Scrolled by hand rather
 * than laid out right-to-left, so punctuation stays where the language
 * puts it.
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
/**
 * THE composer: write words — or say them, or paste a screenshot — and send
 * them. Enter sends, Shift+Enter breaks the line, an IME composition never
 * sends half a word. 16px text, so iOS never zooms the page on focus.
 *
 * Extracted from loki `components/composer/Composer.tsx` (itself the merge of
 * four composers in one app), with heidi's microphone and orangecat's lessons.
 */
export function Composer({ onSend, placeholder, ariaLabel, disabled = false, sendBlockedReason = null, sending = false, onStop, attachmentOnlyText, heldAttachments = 0, queue = false, attach = false, voice = {}, modes, mode, onModeChange, onEmptySlash, value, onValueChange, defaultValue = "", inputRef, density = "comfortable", above, header, tools, trailing, footer, hint, labels: labelOverrides, autoFocus, }) {
    const labels = {
        ...DEFAULT_COMPOSER_LABELS,
        ...labelOverrides,
        dictation: { ...DEFAULT_COMPOSER_LABELS.dictation, ...labelOverrides?.dictation },
        attachNotes: { ...DEFAULT_COMPOSER_LABELS.attachNotes, ...labelOverrides?.attachNotes },
        attachMenu: {
            ...DEFAULT_COMPOSER_LABELS.attachMenu,
            ...labelOverrides?.attachMenu,
            sources: {
                ...DEFAULT_COMPOSER_LABELS.attachMenu.sources,
                ...labelOverrides?.attachMenu?.sources,
            },
        },
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
    const attachments = useAttachments(typeof attach === "object" ? attach : {}, labels.attachNotes);
    const dictation = useDictation({
        ...(voice || {}),
        onText: (said) => setText((prev) => appendTranscript(prev, said)),
    });
    const voiceOn = voice !== false && dictation.supported;
    const listening = dictation.status === "listening";
    const transcribing = dictation.status === "transcribing";
    const attachCount = (attachOn ? attachments.attachments.length : 0) + Math.max(0, heldAttachments);
    const canSend = composerCanSend({
        text,
        attachmentCount: attachCount,
        attachmentOnlyText,
        sending,
        disabled,
        blocked: Boolean(sendBlockedReason),
        queue,
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
    const showModes = Boolean(modes && modes.length > 1);
    // The paperclip takes recordings too (through Files), when there is
    // somewhere to send them. A voice memo is not an attachment the model reads —
    // it is words the person said, so it goes to the same server leg as the mic
    // and lands in the box. Recordings are transcribed in the order picked;
    // everything else is staged.
    const takesAudio = voice !== false && dictation.canTranscribeFile;
    const onFiles = (files) => {
        if (!files)
            return;
        const all = Array.from(files);
        const audio = takesAudio ? all.filter(isAudioFile) : [];
        const rest = all.filter((f) => !audio.includes(f));
        if (rest.length > 0)
            attachments.addFiles(rest);
        if (audio.length > 0) {
            void (async () => {
                for (const file of audio)
                    await dictation.transcribeFile(file);
            })();
        }
    };
    return (_jsxs("div", { className: "ck-composer-wrap", children: [above, _jsxs("div", { className: "ck-composer-frame", children: [(listening || transcribing) && (_jsx("div", { className: "ck-voice-bar", role: "status", "aria-live": "polite", children: listening ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "ck-voice-dot", "aria-hidden": true }), dictation.liveText ? (_jsx(LiveWords, { text: dictation.liveText })) : (_jsx("span", { className: "ck-voice-wave", "aria-hidden": true, children: Array.from({ length: 9 }).map((_, i) => (_jsx("span", {}, i))) })), _jsx(Elapsed, { since: dictation.startedAt }), _jsx("button", { type: "button", className: "ck-icon-btn", onClick: dictation.cancel, "aria-label": labels.cancelRecording, title: labels.cancelRecording, children: _jsx(IconX, {}) }), _jsx("button", { type: "button", className: "ck-voice-confirm", onClick: dictation.stop, "aria-label": labels.confirmRecording, title: labels.confirmRecording, children: _jsx(IconCheck, {}) })] })) : (_jsxs(_Fragment, { children: [_jsx(IconSpinner, {}), dictation.liveText ? (_jsx(LiveWords, { text: dictation.liveText, dim: true })) : (_jsx("span", { className: "ck-voice-timer", children: labels.transcribing }))] })) })), _jsxs("div", { className: density === "compact" ? "ck-composer ck-composer-compact" : "ck-composer", children: [showModes && (_jsx("div", { className: "ck-modes", role: "group", children: modes.map((m) => (_jsx("button", { type: "button", className: "ck-mode", "aria-pressed": m.id === mode, title: m.hint, onClick: () => onModeChange?.(m.id), children: m.label }, m.id))) })), header, _jsx("textarea", { ref: textareaRef, className: "ck-input", rows: 1, value: text, autoFocus: autoFocus, disabled: disabled || transcribing, placeholder: listening ? labels.listening : sending && queue ? labels.queue : placeholder, "aria-label": ariaLabel ?? placeholder, enterKeyHint: "send", onChange: (e) => {
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
                                } }), attachOn && _jsx(AttachmentStrip, { attachments: attachments, labels: labels }), _jsxs("div", { className: "ck-actions", children: [_jsxs("div", { className: "ck-tools", children: [attachOn && (_jsx(AttachMenu, { onFiles: onFiles, disabled: disabled || attachments.full, labels: { attach: labels.attach, ...labels.attachMenu } })), voiceOn && (_jsx("button", { type: "button", className: listening ? "ck-icon-btn ck-mic ck-mic-on" : "ck-icon-btn ck-mic", onClick: dictation.toggle, disabled: disabled || transcribing, "aria-label": listening ? labels.voiceStop : labels.voice, "aria-pressed": listening, title: listening ? labels.voiceStop : labels.voice, children: transcribing ? _jsx(IconSpinner, {}) : _jsx(IconMic, {}) })), tools, hint && _jsx("span", { className: "ck-hint", children: hint })] }), _jsxs("div", { className: "ck-submit", children: [trailing, sending && onStop ? (_jsxs(_Fragment, { children: [queue && canSend && (_jsx("button", { type: "button", className: "ck-send", onClick: () => void submit(), "aria-label": labels.send, title: labels.send, children: _jsx(IconArrowUp, {}) })), _jsx("button", { type: "button", className: "ck-send ck-send-stop", onClick: onStop, "aria-label": labels.stop, title: labels.stop, children: _jsx(IconStop, {}) })] })) : (!listening && (_jsx("button", { type: "button", className: "ck-send", disabled: !canSend, onClick: () => void submit(), "aria-label": labels.send, title: sendBlockedReason ?? labels.send, children: sending ? _jsx(IconSpinner, {}) : _jsx(IconArrowUp, {}) })))] })] }), footer] })] }), dictation.problem && (_jsxs("p", { className: "ck-problem", role: "status", children: [_jsxs("span", { children: [labels.dictation[dictation.problem], dictation.problemDetail && (_jsxs("span", { className: "ck-problem-detail", children: [" ", dictation.problemDetail] }))] }), dictation.canRetry && (_jsx("button", { type: "button", className: "ck-problem-retry", onClick: () => void dictation.retry(), disabled: dictation.status !== "idle", children: labels.retryTake })), _jsx("button", { type: "button", className: "ck-problem-x", onClick: dictation.clearProblem, "aria-label": labels.dismiss, children: _jsx(IconX, {}) })] }))] }));
}
//# sourceMappingURL=Composer.js.map