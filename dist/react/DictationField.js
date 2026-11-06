"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from "react";
import { appendTranscript } from "../composer.js";
import { DEFAULT_DICTATION_MESSAGES } from "../dictation.js";
import { useDictation } from "./use-dictation.js";
import { useAutoGrow } from "./hooks.js";
import { VoiceBar, VoiceProblem } from "./Voice.js";
import { IconMic, IconSpinner } from "./icons.js";
export const DEFAULT_DICTATION_FIELD_LABELS = {
    voice: "Speak instead of typing",
    voiceStop: "Stop recording",
    cancelRecording: "Cancel recording",
    confirmRecording: "Done — use what I said",
    transcribing: "Transcribing…",
    listening: "Listening…",
    retryTake: "Try again",
    dismiss: "Dismiss",
    dictation: DEFAULT_DICTATION_MESSAGES,
    improve: "Improve",
    improveWhat: "What should change?",
    improveApply: "Change it",
    improveWorking: "Working on it…",
    improveFailed: "That did not work just now. Your text is unchanged; try again, or edit it by hand.",
    improved: "Changed by writing help.",
    undo: "Undo",
};
/**
 * ANY text box a person types words into: the microphone is part of it.
 *
 * This is the rule from AGENTS.md ("The experience belongs to the package")
 * made a component: a field made by hand in an app has no microphone, 14px
 * text that makes iOS zoom the page, and no way to take a failed take back —
 * so there is one, and it is this. `Composer` is the same thing for a
 * conversation (it also sends); this is for everything else: a note, a title,
 * a bio, a message to a seller.
 *
 * Controlled. Dictation appends to what is there. With `improve`, a field that
 * has text offers one more control: pick a suggestion or say or type what to
 * change, the text is replaced, and Undo puts it back until the next edit.
 */
export function DictationField({ value, onValueChange, label, ariaLabel, id, placeholder, multiline = true, rows = 3, maxLength, disabled = false, required, voice = {}, improve, hint, inputRef, labels: overrides, className, }) {
    const labels = {
        ...DEFAULT_DICTATION_FIELD_LABELS,
        ...overrides,
        dictation: { ...DEFAULT_DICTATION_FIELD_LABELS.dictation, ...overrides?.dictation },
    };
    const autoId = useId();
    const fieldId = id ?? `ck-field-${autoId}`;
    // The latest text, for a take that finishes after more typing.
    const valueRef = useRef(value);
    useEffect(() => {
        valueRef.current = value;
    });
    const set = (next) => {
        valueRef.current = next;
        onValueChange(next);
    };
    const areaRef = useRef(null);
    useAutoGrow(areaRef, multiline ? value : "");
    const dictation = useDictation({
        ...(voice || {}),
        onText: (said) => {
            setUndo(null);
            set(appendTranscript(valueRef.current, said));
        },
    });
    const voiceOn = voice !== false && dictation.supported;
    const listening = dictation.status === "listening";
    const transcribing = dictation.status === "transcribing";
    const [open, setOpen] = useState(false);
    const [working, setWorking] = useState(false);
    const [failed, setFailed] = useState(false);
    const [instruction, setInstruction] = useState("");
    const [undo, setUndo] = useState(null);
    const run = async (what) => {
        if (!improve || working || !what.trim())
            return;
        setWorking(true);
        setFailed(false);
        const before = valueRef.current;
        try {
            const next = await improve.run(before, what.trim());
            if (typeof next === "string" && next.trim()) {
                setUndo(before);
                set(next);
                setOpen(false);
                setInstruction("");
            }
            else
                setFailed(true);
        }
        catch {
            setFailed(true);
        }
        finally {
            setWorking(false);
        }
    };
    const canImprove = Boolean(improve) && value.trim().length > 0;
    const common = {
        id: fieldId,
        className: "ck-field-input",
        value,
        placeholder: listening ? labels.listening : placeholder,
        maxLength,
        required,
        disabled: disabled || transcribing,
        "aria-label": label ? undefined : (ariaLabel ?? placeholder),
    };
    const onChange = (next) => {
        setUndo(null);
        set(next);
    };
    const setRefs = (el) => {
        if (multiline)
            areaRef.current = el;
        if (typeof inputRef === "function")
            inputRef(el);
        else if (inputRef)
            inputRef.current = el;
    };
    return (_jsxs("div", { className: className ? `ck-field-wrap ${className}` : "ck-field-wrap", children: [label && (_jsx("label", { className: "ck-field-label", htmlFor: fieldId, children: label })), _jsxs("div", { className: "ck-field-frame", children: [_jsx(VoiceBar, { dictation: dictation, labels: labels }), _jsxs("div", { className: multiline ? "ck-field" : "ck-field ck-field-single", children: [multiline ? (_jsx("textarea", { ...common, ref: setRefs, rows: rows, onChange: (e) => onChange(e.target.value) })) : (_jsx("input", { ...common, ref: setRefs, type: "text", enterKeyHint: "done", onChange: (e) => onChange(e.target.value) })), _jsxs("div", { className: "ck-field-actions", children: [canImprove && (_jsx("button", { type: "button", className: "ck-field-improve", "aria-expanded": open, disabled: disabled || working, onClick: () => setOpen((o) => !o), children: labels.improve })), voiceOn && (_jsx("button", { type: "button", className: listening ? "ck-icon-btn ck-mic ck-mic-on" : "ck-icon-btn ck-mic", onClick: dictation.toggle, disabled: disabled || transcribing, "aria-label": listening ? labels.voiceStop : labels.voice, "aria-pressed": listening, title: listening ? labels.voiceStop : labels.voice, children: transcribing ? _jsx(IconSpinner, {}) : _jsx(IconMic, {}) }))] })] })] }), open && improve && (_jsxs("div", { className: "ck-field-improve-panel", children: [improve.suggestions && improve.suggestions.length > 0 && (_jsx("div", { className: "ck-field-suggestions", role: "group", children: improve.suggestions.map((s) => (_jsx("button", { type: "button", className: "ck-field-suggestion", disabled: working, onClick: () => void run(s), children: s }, s))) })), _jsxs("div", { className: "ck-field-improve-row", children: [_jsx(DictationField, { value: instruction, onValueChange: setInstruction, multiline: false, placeholder: labels.improveWhat, ariaLabel: labels.improveWhat, voice: voice, disabled: working, labels: overrides }), _jsx("button", { type: "button", className: "ck-field-apply", disabled: working || !instruction.trim(), onClick: () => void run(instruction), children: working ? labels.improveWorking : labels.improveApply })] }), failed && (_jsx("p", { className: "ck-problem", role: "alert", children: _jsx("span", { children: labels.improveFailed }) }))] })), undo !== null && (_jsxs("p", { className: "ck-field-undo", role: "status", children: [_jsx("span", { children: labels.improved }), _jsx("button", { type: "button", className: "ck-problem-retry", onClick: () => {
                            set(undo);
                            setUndo(null);
                        }, children: labels.undo })] })), _jsx(VoiceProblem, { dictation: dictation, labels: labels }), hint && _jsx("div", { className: "ck-field-hint", children: hint })] }));
}
//# sourceMappingURL=DictationField.js.map