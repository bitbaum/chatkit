import { type ReactNode, type RefObject } from "react";
import { type ComposerMode, type ComposerSendResult } from "../composer.js";
import { type DictationProblem } from "../dictation.js";
import type { Attachment, AttachmentLimits } from "../attachments.js";
import { type UseDictationOptions } from "./use-dictation.js";
export type ComposerLabels = {
    send: string;
    stop: string;
    voice: string;
    voiceStop: string;
    cancelRecording: string;
    confirmRecording: string;
    listening: string;
    transcribing: string;
    attach: string;
    remove: (name: string) => string;
    dismiss: string;
    dictation: Record<DictationProblem, string>;
};
export declare const DEFAULT_COMPOSER_LABELS: ComposerLabels;
export type ComposerVoice = Omit<UseDictationOptions, "onText">;
export type ComposerProps = {
    /** Deliver what was written. Return `false` (or resolve to it) to keep the
     *  draft — a failed send is retried from the same box, not retyped. */
    onSend: (text: string, attachments: Attachment[]) => ComposerSendResult | Promise<ComposerSendResult>;
    placeholder: string;
    ariaLabel?: string;
    disabled?: boolean;
    /** Typing is fine, sending is not — shown as the send button's title. */
    sendBlockedReason?: string | null;
    sending?: boolean;
    /** Given, the send slot becomes Stop while `sending`: a turn you cannot
     *  cancel is what makes a slow answer feel broken. */
    onStop?: () => void;
    /** What an attachments-only send says. Omit and empty text cannot send. */
    attachmentOnlyText?: string;
    /** Attachments on, optionally with the app's own limits. Off by default:
     *  only offer what the app's API accepts. */
    attach?: boolean | Partial<AttachmentLimits>;
    /** The microphone. On by default. Pass `transcribeUrl` (or `transcribe`) so
     *  it still works where the browser recogniser does not — that fallback is
     *  what makes the mic never a dead button. `false` only for a surface that
     *  truly cannot take speech. */
    voice?: ComposerVoice | false;
    modes?: readonly ComposerMode[];
    mode?: string;
    onModeChange?: (id: string) => void;
    /** "/" typed into an empty composer — open a library instead of typing. */
    onEmptySlash?: () => void;
    value?: string;
    onValueChange?: (text: string) => void;
    defaultValue?: string;
    inputRef?: RefObject<HTMLTextAreaElement | null>;
    density?: "comfortable" | "compact";
    /** Outside the box, above it (suggestion chips). */
    above?: ReactNode;
    /** Inside the box, above the text (scope pills, an error). */
    header?: ReactNode;
    /** Extra tools after attach and voice (a model picker, a library). */
    tools?: ReactNode;
    /** Just before the send button. */
    trailing?: ReactNode;
    /** Inside the box, under the controls. */
    footer?: ReactNode;
    hint?: string;
    labels?: Partial<ComposerLabels>;
    autoFocus?: boolean;
};
/**
 * THE composer: write words — or say them, or paste a screenshot — and send
 * them. Enter sends, Shift+Enter breaks the line, an IME composition never
 * sends half a word. 16px text, so iOS never zooms the page on focus.
 *
 * Extracted from loki `components/composer/Composer.tsx` (itself the merge of
 * four composers in one app), with heidi's microphone and orangecat's lessons.
 */
export declare function Composer({ onSend, placeholder, ariaLabel, disabled, sendBlockedReason, sending, onStop, attachmentOnlyText, attach, voice, modes, mode, onModeChange, onEmptySlash, value, onValueChange, defaultValue, inputRef, density, above, header, tools, trailing, footer, hint, labels: labelOverrides, autoFocus, }: ComposerProps): import("react").JSX.Element;
//# sourceMappingURL=Composer.d.ts.map