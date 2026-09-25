import { type DictationPreference, type DictationProblem } from "../dictation.js";
export type DictationStatus = "idle" | "listening" | "transcribing";
export type UseDictationOptions = {
    /** Receives what was said, once, when the take ends. */
    onText: (text: string) => void;
    /** BCP-47 language for the browser recogniser. Defaults to the page's
     *  `<html lang>`, then the browser's. The server leg receives its first part
     *  as `locale` and may detect the language itself. */
    lang?: string;
    /** Which path first. Default `browser` (free, instant); `server` for one
     *  model everywhere. Each falls back to the other when it cannot work. */
    prefer?: DictationPreference;
    /** Server leg: POST multipart `{ audio, locale }` → `{ text }`. */
    transcribeUrl?: string;
    /** Or bring your own server leg (a widget token, a different body). */
    transcribe?: (audio: Blob, locale: string) => Promise<string>;
    maxRecordingMs?: number;
    /** Where a dead recogniser is remembered (localStorage). `null` to never
     *  store anything on the device. */
    rememberKey?: string | null;
};
export type DictationController = {
    /** False only when neither path can work here — the mic is then hidden. */
    supported: boolean;
    status: DictationStatus;
    /** When the current take began (ms epoch), for the timer. */
    startedAt: number | null;
    problem: DictationProblem | null;
    clearProblem: () => void;
    start: () => void;
    /** End the take and deliver what was said. */
    stop: () => void;
    /** End the take and throw it away. */
    cancel: () => void;
    toggle: () => void;
};
/**
 * Speaking instead of typing — with a microphone that is never a dead button.
 *
 * Browser recogniser first (unless `prefer: "server"`); when it is missing, or
 * accepts `start()` and then says nothing (heidi measured nine silent seconds
 * on a real Chromium), the same press RECORDS and the server transcribes. A
 * failure always ends as a `problem` the composer shows in words.
 *
 * Every microphone track is stopped on every exit path. A mic left open on
 * someone's device because a request failed is the worst bug a chat can have.
 */
export declare function useDictation(opts: UseDictationOptions): DictationController;
//# sourceMappingURL=use-dictation.d.ts.map