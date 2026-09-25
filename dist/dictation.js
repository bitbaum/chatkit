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
/**
 * Which recogniser failures the fallback can rescue: only "unavailable" — the
 * recogniser cannot do this (no speech service, network refused, language
 * unsupported) and recording locally does not care. "mic" is the person's
 * hardware or a permission they denied; "silence" is whether they spoke.
 * Recording again would tell them the same thing twice.
 */
export function fallbackCanRescue(problem) {
    return problem === "unavailable";
}
/** Web Speech `error` codes → the three words. Anything unknown is
 *  `unavailable`, never nothing: a control that fails silently looks broken. */
export function problemFor(error) {
    switch (error) {
        case "aborted":
            return null;
        case "not-allowed":
        case "service-not-allowed":
        case "audio-capture":
            return "mic";
        case "no-speech":
            return "silence";
        default:
            return "unavailable";
    }
}
/** getUserMedia / MediaRecorder failures → the same three words, so the UI
 *  never grows a second vocabulary for the same situations. */
export function problemForRecording(error) {
    const name = error?.name ?? "";
    if (name === "NotAllowedError" || name === "SecurityError")
        return "mic";
    if (name === "NotFoundError" || name === "NotReadableError")
        return "mic";
    return "unavailable";
}
/** A working recogniser fires `start` well inside this once the mic is allowed. */
export const START_TIMEOUT_MS = 4000;
/**
 * How long a pending permission may hold off the fallback. The wait is right —
 * someone reading a permission dialog has not failed — but it must be BOUNDED:
 * `permissions.query` says "prompt" both while a dialog is open and when none
 * will ever appear (heidi, 2026-09-12: twenty-two seconds, nothing).
 */
export const PERMISSION_WAIT_MS = 10_000;
export function mayKeepWaitingForPermission(elapsedMs, permissionPending) {
    return permissionPending && elapsedMs < PERMISSION_WAIT_MS;
}
/** A browser whose recogniser proved dead is remembered for this long, so the
 *  person does not rediscover it on every press — and not forever, because a
 *  browser can gain the capability. */
export const DEAD_RECOGNISER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export function deadRecogniserStillTrusted(rememberedAt, now = Date.now()) {
    if (rememberedAt === null || !Number.isFinite(rememberedAt))
        return false;
    const age = now - rememberedAt;
    // A timestamp from the future is a clock change, not a verdict.
    return age >= 0 && age < DEAD_RECOGNISER_TTL_MS;
}
/** Recording is capped so a forgotten mic does not run for an hour. */
export const MAX_RECORDING_MS = 120_000;
/** Candidate containers for MediaRecorder, best first. */
export const RECORDING_MIME_CANDIDATES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
];
/** The default words for each problem. Override per app (and per language). */
export const DEFAULT_DICTATION_MESSAGES = {
    mic: "The microphone is blocked. Allow it for this site and try again.",
    silence: "Nothing was heard. Try again, a little closer to the mic.",
    unavailable: "Voice input is not available right now. Type instead, or try again later.",
};
//# sourceMappingURL=dictation.js.map