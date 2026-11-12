"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { appendTranscript, clipToMaxLength } from "../composer.js";
import { DEFAULT_DICTATION_MESSAGES, type DictationProblem } from "../dictation.js";
import { useDictation } from "./use-dictation.js";
import { useAutoGrow } from "./hooks.js";
import { useFieldFocus } from "./field-focus.js";
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

/**
 * Props the component sets itself. `inputProps` cannot replace them: the
 * field's value, its label wiring, its error state, its 16px text and its
 * keys belong to the package.
 */
type ManagedInputKey =
  | "id"
  | "className"
  | "style"
  | "value"
  | "defaultValue"
  | "placeholder"
  | "children"
  | "dangerouslySetInnerHTML"
  | "onChange"
  | "onKeyDown"
  | "onFocus"
  | "onBlur"
  | "aria-label"
  | "aria-invalid";

/**
 * What an app may add to the text box itself: `spellCheck`, `autoComplete`,
 * `autoCapitalize`, `inputMode`, `enterKeyHint`, `minLength`, `aria-*` and
 * `data-*`. Spread before the managed props, so the managed ones win;
 * `aria-describedby` is joined with the hint and error ids, not replaced.
 */
export type DictationFieldInputProps = Omit<HTMLAttributes<HTMLElement>, ManagedInputKey> & {
  autoComplete?: string;
  minLength?: number;
} & { [data: `data-${string}`]: string | number | boolean | undefined };

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
  /** The field's name in a native `<form>` post. */
  name?: string;
  autoFocus?: boolean;
  /** Shown, selectable, not editable: no microphone, no Improve, no Undo. */
  readOnly?: boolean;
  /** The error state: `aria-invalid`, the frame in the danger colour. */
  invalid?: boolean;
  /** The error, in words, under the field (`role="alert"`). Implies `invalid`. */
  error?: ReactNode;
  /** Runs first; `event.preventDefault()` here stops `onSubmit`. */
  onKeyDown?: (event: ReactKeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  /**
   * The submit keys, the same in every app: Cmd+Enter or Ctrl+Enter in a
   * multi-line field, Enter in a one-line one. Never during an IME
   * composition, never while disabled or read-only, never while a take is
   * being recorded or transcribed.
   */
  onSubmit?: () => void;
  /** Focus entered the FIELD (text box, microphone, Improve and its panel). */
  onFocus?: () => void;
  /**
   * Focus left the whole field — not when it moves between its parts, so
   * pressing the microphone is not a blur. Leaving while a take is recorded
   * or transcribed is reported once the take has ended and its words have
   * been delivered through `onValueChange`.
   */
  onBlur?: () => void;
  /** Extra attributes for the text box; see `DictationFieldInputProps`. */
  inputProps?: DictationFieldInputProps;
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
  name,
  autoFocus,
  readOnly = false,
  invalid = false,
  error,
  onKeyDown,
  onSubmit,
  onFocus,
  onBlur,
  inputProps,
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
      set(clipToMaxLength(appendTranscript(valueRef.current, said), maxLength));
    },
  });
  const voiceOn = voice !== false && dictation.supported && !readOnly;
  const listening = dictation.status === "listening";
  const transcribing = dictation.status === "transcribing";
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  // Improve at work disables its own box and button, so focus falls off them
  // with nowhere to go: the person is still in the field, waiting.
  const focus = useFieldFocus({
    busy: dictation.status !== "idle" || working,
    onFocus,
    onBlur,
  });
  // An error with no words (`error=""` from a `?? ""`, a `0` from `n && msg`)
  // is no error: colour must never be the only sign.
  const hasError =
    error !== undefined && error !== null && error !== false && error !== "" && error !== 0;
  const isInvalid = invalid || hasError;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = hasError ? `${fieldId}-error` : undefined;
  const describedBy =
    [inputProps?.["aria-describedby"], errorId, hintId].filter(Boolean).join(" ") || undefined;

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
        set(clipToMaxLength(next, maxLength));
        setOpen(false);
        setInstruction("");
      } else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setWorking(false);
    }
  };

  const canImprove = Boolean(improve) && !readOnly && value.trim().length > 0;
  const common = {
    id: fieldId,
    className: "ck-field-input",
    style: undefined,
    value,
    placeholder: listening ? labels.listening : placeholder,
    maxLength,
    required,
    name,
    autoFocus,
    readOnly: readOnly || undefined,
    disabled: disabled || transcribing,
    "aria-label": label ? undefined : (ariaLabel ?? placeholder),
    "aria-invalid": isInvalid ? true : undefined,
    "aria-describedby": describedBy,
  } as const;
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    onKeyDown?.(e);
    if (!onSubmit || e.defaultPrevented || e.key !== "Enter") return;
    // An Enter that confirms an IME composition (Japanese, Chinese, Korean)
    // is the person choosing a word, not sending.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const chord = e.metaKey || e.ctrlKey;
    if (multiline && !chord) return; // a new line
    // From here the key is the package's: in a one-line field the browser
    // would otherwise send the native form, mid-take, without the words.
    e.preventDefault();
    if (disabled || readOnly || dictation.status !== "idle") return;
    if (!multiline && (e.shiftKey || e.altKey)) return;
    onSubmit();
  };
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
    <div
      ref={focus.wrapRef}
      className={["ck-field-wrap", isInvalid && "ck-field-invalid", className]
        .filter(Boolean)
        .join(" ")}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
    >
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
              {...inputProps}
              {...common}
              ref={setRefs}
              rows={rows}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <input
              {...inputProps}
              {...common}
              ref={setRefs}
              type="text"
              enterKeyHint={inputProps?.enterKeyHint ?? "done"}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
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

      {errorId && (
        <p id={errorId} className="ck-field-error" role="alert">
          {error}
        </p>
      )}

      {open && improve && !readOnly && (
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
              onSubmit={() => void run(instruction)}
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

      {undo !== null && !readOnly && (
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
      {hint && (
        <div id={hintId} className="ck-field-hint">
          {hint}
        </div>
      )}
    </div>
  );
}
