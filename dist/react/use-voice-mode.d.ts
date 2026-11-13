import { type VoiceModeState } from "../voice-mode.js";
import type { Speaker } from "../speech.js";
import { type DictationController, type UseDictationOptions } from "./use-dictation.js";
export type UseVoiceModeOptions = {
    /**
     * Send the person's turn and resolve with the answer's words (markdown is
     * fine; it is flattened before it is read). Resolve with "" or reject when
     * no answer came: the call then ends and says so.
     */
    onTurn: (text: string) => Promise<string>;
    /** The same options the composer's microphone takes (`transcribeUrl`, `lang`…). */
    dictation?: Omit<UseDictationOptions, "onText">;
    /** A studio voice; the browser's own voice when omitted. */
    speaker?: Speaker | null;
};
export type VoiceModeController = {
    /** False where this device can neither listen nor speak. */
    supported: boolean;
    state: VoiceModeState;
    dictation: DictationController;
    /** Open the call. Must run inside a tap: browsers open a microphone and a voice only then. */
    start: () => void;
    end: () => void;
    /**
     * The one big button. Listening: "I have finished speaking". Speaking: cut
     * in and listen again. Thinking: nothing to do.
     */
    press: () => void;
};
/**
 * A spoken conversation over any chat: listen, send, read the answer aloud,
 * listen again (`voiceModeReducer` holds the rules). Where the browser's own
 * recogniser runs, a pause ends the person's turn by itself; everywhere else
 * a press of the button does, which is also how a person takes their time.
 *
 * The microphone and the voice follow the phase and nothing else
 * (`voiceModeWants`), and both are shut when the component unmounts.
 */
export declare function useVoiceMode(opts: UseVoiceModeOptions): VoiceModeController;
//# sourceMappingURL=use-voice-mode.d.ts.map