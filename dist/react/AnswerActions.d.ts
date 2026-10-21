import { type ReactNode } from "react";
import { type Speaker } from "../speech.js";
export type AnswerActionsLabels = {
    copy: string;
    copied: string;
    listen: string;
    stop: string;
    share: string;
    retry: string;
};
export declare const DEFAULT_ANSWER_ACTIONS_LABELS: AnswerActionsLabels;
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
export declare function AnswerActions({ text, onRetry, speaker, share, labels: overrides, children, }: {
    /** The answer's markdown. Copied as written; read as prose. */
    text: string;
    onRetry?: () => void;
    /** The app's voice. Without it, the browser's; without either, no Listen. */
    speaker?: Speaker | null;
    /** What the share sheet gets. Defaults to the answer's prose. `false` hides Share. */
    share?: {
        title?: string;
        text?: string;
        url?: string;
    } | false;
    labels?: Partial<AnswerActionsLabels>;
    children?: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=AnswerActions.d.ts.map