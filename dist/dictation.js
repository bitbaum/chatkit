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
/**
 * The words on screen while a take is live: everything the recogniser has
 * settled on, then what it is still guessing at — one line, read as it is
 * spoken. A preview only: when the server leg transcribes, ITS words are
 * what lands in the box; these are what the person watches meanwhile, so a
 * take is never a timer and a wave with nothing to show for twenty seconds.
 */
export function liveWords(finals, interim) {
    return [...finals, interim]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(" ");
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
export const MAX_AUDIO_FILE_BYTES = 120 * 1024 * 1024;
const AUDIO_EXT = /\.(m4a|mp3|wav|ogg|oga|opus|webm|aac|flac|amr|3gp|3gpp|mp4|caf|aiff?|wma)$/i;
/**
 * Does this file hold a recording? By MIME where the browser gives one, by
 * extension where it does not: Android's picker hands over `.m4a` from the
 * stock recorder with an empty type often enough that mime alone would call
 * it a text file and inline the bytes into a prompt.
 */
export function isAudioFile(file) {
    const type = (file.type ?? "").toLowerCase();
    if (type.startsWith("audio/"))
        return true;
    if (type.startsWith("image/") || type.startsWith("text/"))
        return false;
    return AUDIO_EXT.test(file.name ?? "");
}
/** The name a recording travels under. Whisper services read the container
 *  from the extension, so a mic take keeps the type's extension and a file
 *  keeps its own name. */
export function audioFileName(audio) {
    if (audio.name && AUDIO_EXT.test(audio.name))
        return audio.name;
    const type = (audio.type ?? "").toLowerCase();
    const ext = type.includes("mp4") || type.includes("m4a")
        ? "m4a"
        : type.includes("ogg")
            ? "ogg"
            : type.includes("mpeg") || type.includes("mp3")
                ? "mp3"
                : type.includes("wav")
                    ? "wav"
                    : "webm";
    return `voice.${ext}`;
}
/**
 * A server leg that refused, with the server's own words when it gave any.
 *
 * A failed transcription used to reach the person as one sentence whatever
 * went wrong — and in OrangeCat as "check your connection", while the server
 * had answered plainly that it was busy (2026-10-07). `reason` is what the
 * server said, for the UI to show beside the generic line; a custom
 * `transcribe` may throw one too.
 */
export class TranscriptionError extends Error {
    reason;
    status;
    constructor(reason, status = null) {
        super(reason ?? `transcription failed${status ? ` (${status})` : ""}`);
        this.name = "TranscriptionError";
        this.reason = reason;
        this.status = status;
    }
}
/** The server's sentence from a failed transcription, if it sent one. Reads
 *  the shapes servers actually answer with: `{ error }`, `{ message }`,
 *  `{ error: { message } }`. Capped, because it is shown in a status line. */
export function reasonFromBody(body) {
    if (!body || typeof body !== "object")
        return null;
    const b = body;
    const pick = typeof b.error === "string"
        ? b.error
        : b.error &&
            typeof b.error === "object" &&
            typeof b.error.message === "string"
            ? b.error.message
            : typeof b.message === "string"
                ? b.message
                : null;
    const t = pick?.trim();
    return t ? t.slice(0, 200) : null;
}
/** What a thrown transcription error says, for any thrower: ours, or an
 *  app's `transcribe` that sets `reason` on whatever it throws. */
export function reasonOf(error) {
    const r = error?.reason;
    return typeof r === "string" && r.trim() ? r.trim().slice(0, 200) : null;
}
/** The default words for each problem. Override per app (and per language). */
export const DEFAULT_DICTATION_MESSAGES = {
    mic: "The microphone is blocked. Allow it for this site and try again.",
    silence: "Nothing was heard. Try again, a little closer to the mic.",
    unavailable: "Voice input is not available right now. Type instead, or try again later.",
    fileTooLarge: `That recording is too large to transcribe here (max ${Math.round(MAX_AUDIO_FILE_BYTES / 1024 / 1024)} MB).`,
};
//# sourceMappingURL=dictation.js.map