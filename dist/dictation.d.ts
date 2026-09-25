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
/** Why a dictation produced no text, in terms the person can act on. */
export type DictationProblem = "mic" | "silence" | "unavailable";
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
/** The default words for each problem. Override per app (and per language). */
export declare const DEFAULT_DICTATION_MESSAGES: Record<DictationProblem, string>;
//# sourceMappingURL=dictation.d.ts.map