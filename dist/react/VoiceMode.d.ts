import type { DictationProblem } from "../dictation.js";
import type { VoiceModeEnd } from "../voice-mode.js";
import { type UseVoiceModeOptions } from "./use-voice-mode.js";
export type VoiceModeLabels = {
    title: string;
    /** Under the button, per phase: what is happening and what a press does. */
    listening: string;
    thinking: string;
    speaking: string;
    /** The big button's name for a screen reader, per phase. */
    pressListening: string;
    pressSpeaking: string;
    pressThinking: string;
    end: string;
    again: string;
    /** Why the call is over. */
    ended: Record<Exclude<VoiceModeEnd, "ended">, string>;
    dictation: Record<DictationProblem, string>;
};
export declare const DEFAULT_VOICE_MODE_LABELS: VoiceModeLabels;
export type VoiceModeProps = UseVoiceModeOptions & {
    open: boolean;
    onClose: () => void;
    /** Who is being talked to, shown above the button. */
    name?: string;
    labels?: Partial<VoiceModeLabels>;
};
/**
 * A spoken conversation, full screen: one big button, what was heard, what is
 * being said back, and End. Open it from a tap (browsers open a microphone
 * and a voice only inside one); closing it shuts both.
 *
 * The loop and its rules are `useVoiceMode` and `voiceModeReducer`. This is
 * only the screen, so every chat that offers voice looks and behaves the same.
 */
export declare function VoiceMode({ open, onClose, name, labels: given, ...opts }: VoiceModeProps): import("react").JSX.Element;
//# sourceMappingURL=VoiceMode.d.ts.map