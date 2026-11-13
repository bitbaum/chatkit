"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { plainTextForSpeech } from "../speech.js";
import { IconX } from "./icons.js";
import { DEFAULT_DICTATION_MESSAGES } from "../dictation.js";
import { useVoiceMode } from "./use-voice-mode.js";
export const DEFAULT_VOICE_MODE_LABELS = {
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
/**
 * A spoken conversation, full screen: one big button, what was heard, what is
 * being said back, and End. Open it from a tap (browsers open a microphone
 * and a voice only inside one); closing it shuts both.
 *
 * The loop and its rules are `useVoiceMode` and `voiceModeReducer`. This is
 * only the screen, so every chat that offers voice looks and behaves the same.
 */
export function VoiceMode({ open, onClose, name, labels: given, ...opts }) {
    const labels = { ...DEFAULT_VOICE_MODE_LABELS, ...given };
    const vm = useVoiceMode(opts);
    const ref = useRef(null);
    const { start, end, state } = vm;
    useEffect(() => {
        const d = ref.current;
        if (!d)
            return;
        if (open && !d.open && typeof d.showModal === "function") {
            d.showModal();
            start();
        }
        else if (!open && d.open) {
            end();
            d.close();
        }
    }, [open, start, end]);
    // Unmounting ends the call too: a microphone that outlives its screen is the worst bug a chat can have.
    useEffect(() => () => end(), [end]);
    const phase = state.phase;
    const line = phase === "listening"
        ? vm.dictation.liveText || labels.listening
        : phase === "thinking"
            ? state.said
            : phase === "speaking"
                ? plainTextForSpeech(state.answer)
                : "";
    const reason = state.ended && state.ended !== "ended"
        ? vm.dictation.problem
            ? labels.dictation[vm.dictation.problem]
            : labels.ended[state.ended]
        : null;
    return (_jsxs("dialog", { ref: ref, className: "ck-voicemode", "aria-label": name ? `${labels.title}: ${name}` : labels.title, onClose: () => {
            end();
            onClose();
        }, children: [_jsxs("div", { className: "ck-voicemode-top", children: [_jsx("span", { className: "ck-voicemode-name", children: name ?? labels.title }), _jsx("button", { type: "button", className: "ck-icon-btn", "aria-label": labels.end, onClick: onClose, children: _jsx(IconX, {}) })] }), _jsx("div", { className: "ck-voicemode-body", "data-phase": phase, "data-mic": vm.dictation.status, children: phase === "off" ? (_jsxs(_Fragment, { children: [reason && (_jsx("p", { className: "ck-voicemode-reason", role: "status", children: reason })), _jsx("button", { type: "button", className: "ck-voicemode-again", onClick: start, children: labels.again })] })) : (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "ck-voicemode-orb", "data-phase": phase, disabled: phase === "thinking", "aria-label": phase === "listening"
                                ? labels.pressListening
                                : phase === "speaking"
                                    ? labels.pressSpeaking
                                    : labels.pressThinking, onClick: vm.press, children: _jsx("span", { className: "ck-voicemode-ring", "aria-hidden": "true" }) }), _jsx("p", { className: "ck-voicemode-status", role: "status", children: phase === "listening"
                                ? labels.listening
                                : phase === "thinking"
                                    ? labels.thinking
                                    : labels.speaking }), line && line !== labels.listening && (_jsx("p", { className: "ck-voicemode-line", "data-phase": phase, children: line }))] })) }), _jsx("div", { className: "ck-voicemode-foot", children: _jsx("button", { type: "button", className: "ck-voicemode-end", onClick: onClose, children: labels.end }) })] }));
}
//# sourceMappingURL=VoiceMode.js.map