import { type Speaker } from "../speech.js";
export type SpeechController = {
    /** Something can speak here: the app's speaker, or the browser's voice. */
    supported: boolean;
    speaking: boolean;
    /** Seconds since this reading started; 0 while silent. */
    elapsed: number;
    /** Read this markdown aloud (flattened to prose first), stopping any other. */
    speak: (markdown: string) => void;
    stop: () => void;
    toggle: (markdown: string) => void;
};
/**
 * Read an answer aloud — the play button under every answer in the reference
 * apps. The browser's own voices by default: no upload, no key, works
 * offline. An app with a studio voice passes its own `speaker` (loki's
 * Orpheus voice, through the same two methods) and the button, the timer and
 * the stop are the same.
 *
 * One reading at a time: play on a second answer stops the first. Unmounting
 * stops it too — a voice that keeps reading a page you left is the
 * microphone bug's twin.
 */
export declare function useSpeech(speaker?: Speaker | null): SpeechController;
//# sourceMappingURL=use-speech.d.ts.map