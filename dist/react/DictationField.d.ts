import { type ReactNode, type Ref } from "react";
import { type DictationProblem } from "../dictation.js";
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
export declare const DEFAULT_DICTATION_FIELD_LABELS: DictationFieldLabels;
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
    improve?: {
        run: ImproveRun;
        suggestions?: readonly string[];
    };
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
export declare function DictationField({ value, onValueChange, label, ariaLabel, id, placeholder, multiline, rows, maxLength, disabled, required, voice, improve, hint, inputRef, labels: overrides, className, }: DictationFieldProps): import("react").JSX.Element;
//# sourceMappingURL=DictationField.d.ts.map