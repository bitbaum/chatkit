/**
 * The decisions behind the microphone, without the microphone.
 *
 * The shape comes from heidi (`app/[locale]/_components/use-dictation.ts`),
 * which is the only chat in the fleet whose mic never goes dead:
 *
 * - The browser's recogniser is FAST (free, instant, nothing uploaded) but
 *   sometimes a lie: Chromium builds without Google's speech service accept
 *   `start()` and then never fire an event — measured on heidi's live site
 *   2026-09-12, nine seconds, zero events. So the recogniser is never the only
 *   path. Missing or silent, the same button RECORDS and a server transcribes.
 * - Every failure becomes one of three words the person can act on — the mic
 *   (permission, hardware), silence (nothing heard), unavailable (nothing here
 *   can do it) — never a button that does nothing and says nothing.
 *
 * Kept pure so "never forever" and "which failures the fallback rescues" are
 * tested properties rather than behaviour buried in a timeout.
 */
/** Why a dictation produced no text, in terms the person can act on.
 *  `fileTooLarge` is the fourth word, for a recording handed over as a file
 *  (see `isAudioFile`) that the server leg would refuse. */
export type DictationProblem = "mic" | "silence" | "unavailable" | "fileTooLarge";
/** Which path to try first. `browser` is free and instant; `server` is one
 *  model everywhere (and detects the language by itself). Either falls back to
 *  the other when it cannot work. */
export type DictationPreference = "browser" | "server";
/**
 * Which recogniser failures the fallback can rescue: only "unavailable" — the
 * recogniser cannot do this (no speech service, network refused, language
 * unsupported) and recording locally does not care. "mic" is the person's
 * hardware or a permission they denied; "silence" is whether they spoke.
 * Recording again would tell them the same thing twice.
 */
export declare function fallbackCanRescue(problem: DictationProblem | null): boolean;
/** Web Speech `error` codes → the three words. Anything unknown is
 *  `unavailable`, never nothing: a control that fails silently looks broken. */
export declare function problemFor(error: string | undefined): DictationProblem | null;
/** getUserMedia / MediaRecorder failures → the same three words, so the UI
 *  never grows a second vocabulary for the same situations. */
export declare function problemForRecording(error: unknown): DictationProblem;
/**
 * The words on screen while a take is live: everything the recogniser has
 * settled on, then what it is still guessing at — one line, read as it is
 * spoken. A preview only: when the server leg transcribes, ITS words are
 * what lands in the box; these are what the person watches meanwhile, so a
 * take is never a timer and a wave with nothing to show for twenty seconds.
 */
export declare function liveWords(finals: readonly string[], interim: string): string;
/** One entry of a Web Speech `event.results` list, as much of it as we read. */
export type RecognitionResultLike = {
    isFinal?: boolean;
} & ArrayLike<{
    transcript?: string;
}>;
/** What a recogniser has heard so far, read from its whole results list. */
export type HeardSoFar = {
    /** Settled phrases, in order. */
    finals: string[];
    /** The phrase still being guessed at, or "". Only ever the last one. */
    interim: string;
    /** What to deliver if the take ended now: the finals — plus, when the
     *  interim tail is a revision of a phrase that HAD settled, that settled
     *  phrase, so ending mid-revision never loses words already heard. */
    text: string;
};
/**
 * The transcript so far, from a recogniser's COMPLETE results list.
 *
 * Why this exists: Android's Chrome-family recognisers (Chrome, Brave, Samsung
 * Internet) with `continuous` + `interimResults` report CUMULATIVE results.
 * One utterance arrives as "why", "why exactly", "why exactly is", … — either
 * as one result re-reported with `resultIndex` 0 on every event, or as a new
 * result per event at the next index — and often every one of them flagged
 * `isFinal`. A hook that pushed every final from `resultIndex` onwards into a
 * running array typed the sentence once per word: "why why exactly why exactly
 * is …" (Substrata's Ask box, Brave on Android, 2026-10-25). Desktop Chrome
 * reports stable finals at increasing indices, so it never showed.
 *
 * So the transcript is rebuilt from the whole list on every event (the Web
 * Speech spec makes `results` the session's full list; nothing is kept
 * between events), and a cumulative chain collapses to its last link:
 *
 * - A result whose words BEGIN with the previous kept result's words, and
 *   add more, is the same utterance growing: it replaces it. Always on —
 *   desktop finals are consecutive phrases and essentially never restate the
 *   previous one whole.
 * - Once a list has shown that growth, the recogniser is cumulative, and two
 *   more rules apply for that list only: a result the previous one already
 *   begins with (a late, shorter or identical re-report) is dropped; and a
 *   result at least as long, starting with the same word, that keeps all but
 *   a quarter (min. one) of the previous one's words in order, is a REVISION
 *   ("why exactly is is so" → "why exactly is it so hard") and replaces it.
 * - Anything else is a new phrase and is appended.
 *
 * The tradeoff, chosen on purpose: the looser rules only run on a recogniser
 * that has proved itself cumulative, so on desktop nothing the person said is
 * ever dropped — "no", "no", "no" as three separate results stays "no no no",
 * and "hello there" then "how are you" stays both. The one limitation: a
 * person who really says "no" and then "no no" as two separate results reads
 * as one growing utterance and is delivered as "no no". That needs a word to
 * be heard as its own result and then restated with more after it, and it
 * loses a repeat, never a new word.
 *
 * `unflaggedIsFinal`: whether a result with no `isFinal` at all counts as
 * settled (the browser leg has always read it so; the preview has not).
 */
export declare function heardFromResults(results: ArrayLike<RecognitionResultLike | undefined>, opts?: {
    unflaggedIsFinal?: boolean;
}): HeardSoFar;
/** A working recogniser fires `start` well inside this once the mic is allowed. */
export declare const START_TIMEOUT_MS = 4000;
/**
 * How long a pending permission may hold off the fallback. The wait is right —
 * someone reading a permission dialog has not failed — but it must be BOUNDED:
 * `permissions.query` says "prompt" both while a dialog is open and when none
 * will ever appear (heidi, 2026-09-12: twenty-two seconds, nothing).
 */
export declare const PERMISSION_WAIT_MS = 10000;
export declare function mayKeepWaitingForPermission(elapsedMs: number, permissionPending: boolean): boolean;
/** A browser whose recogniser proved dead is remembered for this long, so the
 *  person does not rediscover it on every press — and not forever, because a
 *  browser can gain the capability. */
export declare const DEAD_RECOGNISER_TTL_MS: number;
export declare function deadRecogniserStillTrusted(rememberedAt: number | null, now?: number): boolean;
/** Recording is capped so a forgotten mic does not run for an hour. */
export declare const MAX_RECORDING_MS = 120000;
/** Candidate containers for MediaRecorder, best first. */
export declare const RECORDING_MIME_CANDIDATES: readonly ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
/**
 * A recording that already exists — a voice memo from the phone's recorder, a
 * meeting someone taped — is dictation that happened earlier. It goes to the
 * same server leg as the mic and its words land in the box the same way.
 *
 * The cap is on the upload, not the recording: the server compresses and
 * splits long audio before Whisper, but a phone on mobile data still has to
 * send the bytes. A one-hour memo from a phone recorder is about 60 MB; this
 * takes that with room to spare, and refuses the ten-hour one in words rather
 * than after a ten-minute upload that fails.
 */
export declare const MAX_AUDIO_FILE_BYTES: number;
/**
 * Does this file hold a recording? By MIME where the browser gives one, by
 * extension where it does not: Android's picker hands over `.m4a` from the
 * stock recorder with an empty type often enough that mime alone would call
 * it a text file and inline the bytes into a prompt.
 */
export declare function isAudioFile(file: {
    type?: string;
    name?: string;
}): boolean;
/** The name a recording travels under. Whisper services read the container
 *  from the extension, so a mic take keeps the type's extension and a file
 *  keeps its own name. */
export declare function audioFileName(audio: {
    type?: string;
    name?: string;
}): string;
/**
 * A server leg that refused, with the server's own words when it gave any.
 *
 * A failed transcription used to reach the person as one sentence whatever
 * went wrong — and in OrangeCat as "check your connection", while the server
 * had answered plainly that it was busy (2026-10-07). `reason` is what the
 * server said, for the UI to show beside the generic line; a custom
 * `transcribe` may throw one too.
 */
export declare class TranscriptionError extends Error {
    readonly reason: string | null;
    readonly status: number | null;
    constructor(reason: string | null, status?: number | null);
}
/** The server's sentence from a failed transcription, if it sent one. Reads
 *  the shapes servers actually answer with: `{ error }`, `{ message }`,
 *  `{ error: { message } }`. Capped, because it is shown in a status line. */
export declare function reasonFromBody(body: unknown): string | null;
/** What a thrown transcription error says, for any thrower: ours, or an
 *  app's `transcribe` that sets `reason` on whatever it throws. */
export declare function reasonOf(error: unknown): string | null;
/** The default words for each problem. Override per app (and per language). */
export declare const DEFAULT_DICTATION_MESSAGES: Record<DictationProblem, string>;
//# sourceMappingURL=dictation.d.ts.map