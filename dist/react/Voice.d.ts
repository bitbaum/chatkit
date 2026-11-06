import type { DictationProblem } from "../dictation.js";
import type { DictationController } from "./use-dictation.js";
/**
 * The microphone's two visible states, drawn once. `Composer` and
 * `DictationField` both put them over / under their box, so a take looks and
 * behaves the same in a chat, in a comment and in a title field — the same
 * "every control the same everywhere" rule as the rest of the package.
 */
export type VoiceLabels = {
    cancelRecording: string;
    confirmRecording: string;
    transcribing: string;
    retryTake: string;
    dismiss: string;
    dictation: Record<DictationProblem, string>;
};
/** Covers its positioned parent while a take is live or being written down. */
export declare function VoiceBar({ dictation, labels, }: {
    dictation: DictationController;
    labels: VoiceLabels;
}): import("react").JSX.Element | null;
/** A mic failure, in words, with the way forward: try the kept take again, or dismiss. */
export declare function VoiceProblem({ dictation, labels, }: {
    dictation: DictationController;
    labels: VoiceLabels;
}): import("react").JSX.Element | null;
//# sourceMappingURL=Voice.d.ts.map