"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { appendTranscript } from "../composer.js";
import { DEFAULT_DICTATION_MESSAGES, type DictationProblem } from "../dictation.js";
import { useDictation } from "./use-dictation.js";
import { useAutoGrow } from "./hooks.js";
import { VoiceBar, VoiceProblem } from "./Voice.js";
import { IconMic, IconSpinner } from "./icons.js";
import type { ComposerVoice } from "./Composer.js";

export type DictationFieldLabels = {
  voice: string;
  voiceStop: string;
  cancelRecording: string;
  confirmRecording: string;
  transcribing: string;
  listening: string;
  retryTake: string;
  dismiss: string;
  dictation: Record<DictationProblem, string>;
  /** The button that opens the improve panel. */
  improve: string;
  /** Placeholder of the "what should change?" box. */
  improveWhat: string;
  improveApply: string;
  improveWorking: string;
  improveFailed: string;
  /** Shown after a change, beside Undo. */
  improved: string;
  undo: string;
};

export const DEFAULT_DICTATION_FIELD_LABELS: DictationFieldLabels = {
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
  improveFailed:
    "That did not work just now. Your text is unchanged; try again, or edit it by hand.",
  improved: "Changed by writing help.",
  undo: "Undo",
};

/**
 * Writing help for a field: given the text and what the person asked for,
 * resolve to the new text, or to `null` when it could not be done. Chatkit
 * ships no model call and no prompt — the app (or `@bitbaum/writingkit`)
 * owns those — only the way a person asks, sees and takes it back.
 */
export type ImproveRun = (text: string, instruction: string) => Promise<string | null | undefined>;

export type DictationFieldProps = {
  value: string;
  onValueChange: (next: string) => void;
  /** Visible label. Without one, `ariaLabel` is required for assistive tech. */
  label?: ReactNode;
  ariaLabel?: string;
  id?: string;
  placeholder?: string;
  /** `false`: a one-line field (a title, a summary). Default: a growing text area. */
  multiline?: boolean;
  /** Fewest rows a multiline field shows. Default 3. */
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  required?: boolean;
  /** The microphone. Pass `{ transcribeUrl }` for the server leg; `false` hides it. */
  voice?: ComposerVoice | false;
  /** Give it, and a non-empty field offers "Improve". */
  improve?: { run: ImproveRun; suggestions?: readonly string[] };
  /** Under the field: a count, a rule, an example. */
  hint?: ReactNode;
  inputRef?: Ref<HTMLTextAreaElement | HTMLInputElement>;
  labels?: Partial<Omit<DictationFieldLabels, "dictation">> & {
    dictation?: Partial<DictationFieldLabels["dictation"]>;
  };
  className?: string;
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
export function DictationField({
  value,
  onValueChange,
  label,
  ariaLabel,
  id,
  placeholder,
  multiline = true,
  rows = 3,
  maxLength,
  disabled = false,
  required,
  voice = {},
  improve,
  hint,
  inputRef,
  labels: overrides,
  className,
}: DictationFieldProps) {
  const labels: DictationFieldLabels = {
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
  const set = (next: string) => {
    valueRef.current = next;
    onValueChange(next);
  };

  const areaRef = useRef<HTMLTextAreaElement | null>(null);
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
  const [undo, setUndo] = useState<string | null>(null);

  const run = async (what: string) => {
    if (!improve || working || !what.trim()) return;
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
      } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
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
  } as const;
  const onChange = (next: string) => {
    setUndo(null);
    set(next);
  };

  const setRefs = (el: HTMLTextAreaElement | HTMLInputElement | null) => {
    if (multiline) areaRef.current = el as HTMLTextAreaElement | null;
    if (typeof inputRef === "function") inputRef(el);
    else if (inputRef) (inputRef as { current: unknown }).current = el;
  };

  return (
    <div className={className ? `ck-field-wrap ${className}` : "ck-field-wrap"}>
      {label && (
        <label className="ck-field-label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <div className="ck-field-frame">
        <VoiceBar dictation={dictation} labels={labels} />
        <div className={multiline ? "ck-field" : "ck-field ck-field-single"}>
          {multiline ? (
            <textarea
              {...common}
              ref={setRefs}
              rows={rows}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <input
              {...common}
              ref={setRefs}
              type="text"
              enterKeyHint="done"
              onChange={(e) => onChange(e.target.value)}
            />
          )}
          <div className="ck-field-actions">
            {canImprove && (
              <button
                type="button"
                className="ck-field-improve"
                aria-expanded={open}
                disabled={disabled || working}
                onClick={() => setOpen((o) => !o)}
              >
                {labels.improve}
              </button>
            )}
            {voiceOn && (
              <button
                type="button"
                className={listening ? "ck-icon-btn ck-mic ck-mic-on" : "ck-icon-btn ck-mic"}
                onClick={dictation.toggle}
                disabled={disabled || transcribing}
                aria-label={listening ? labels.voiceStop : labels.voice}
                aria-pressed={listening}
                title={listening ? labels.voiceStop : labels.voice}
              >
                {transcribing ? <IconSpinner /> : <IconMic />}
              </button>
            )}
          </div>
        </div>
      </div>

      {open && improve && (
        <div className="ck-field-improve-panel">
          {improve.suggestions && improve.suggestions.length > 0 && (
            <div className="ck-field-suggestions" role="group">
              {improve.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="ck-field-suggestion"
                  disabled={working}
                  onClick={() => void run(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="ck-field-improve-row">
            <DictationField
              value={instruction}
              onValueChange={setInstruction}
              multiline={false}
              placeholder={labels.improveWhat}
              ariaLabel={labels.improveWhat}
              voice={voice}
              disabled={working}
              labels={overrides}
            />
            <button
              type="button"
              className="ck-field-apply"
              disabled={working || !instruction.trim()}
              onClick={() => void run(instruction)}
            >
              {working ? labels.improveWorking : labels.improveApply}
            </button>
          </div>
          {failed && (
            <p className="ck-problem" role="alert">
              <span>{labels.improveFailed}</span>
            </p>
          )}
        </div>
      )}

      {undo !== null && (
        <p className="ck-field-undo" role="status">
          <span>{labels.improved}</span>
          <button
            type="button"
            className="ck-problem-retry"
            onClick={() => {
              set(undo);
              setUndo(null);
            }}
          >
            {labels.undo}
          </button>
        </p>
      )}
      <VoiceProblem dictation={dictation} labels={labels} />
      {hint && <div className="ck-field-hint">{hint}</div>}
    </div>
  );
}
