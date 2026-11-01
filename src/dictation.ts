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

/** Which leg a press of the microphone starts on. */
export type DictationLeg = "browser" | "server" | "none";

/**
 * Where a take starts. With a server leg the default is to RECORD: a take
 * then lasts until the person presses done (or the cap). The browser
 * recogniser on Android ends the take at the first pause however `continuous`
 * is set, so someone who stops to think for a second loses the rest of their
 * sentence. Found 2026-11-01 in OrangeCat's bot chats, whose composer had no
 * `prefer` while the Cat's said `server`: the same microphone stopped after
 * one or two seconds in one screen and listened to the end in the other.
 * `prefer: "browser"` still asks for the recogniser first where an app wants
 * it, and either leg is used when the other cannot work.
 */
export function dictationLeg(opts: {
  prefer?: DictationPreference;
  hasServer: boolean;
  canRecord: boolean;
  hasRecogniser: boolean;
  recogniserDead: boolean;
}): DictationLeg {
  const server = opts.hasServer && opts.canRecord;
  const recogniser = opts.hasRecogniser;
  const prefer = opts.prefer ?? (opts.hasServer ? "server" : "browser");
  if (prefer === "server" && server) return "server";
  if (recogniser && !opts.recogniserDead) return "browser";
  if (server) return "server";
  if (recogniser) return "browser";
  return "none";
}

/**
 * Which recogniser failures the fallback can rescue: only "unavailable" — the
 * recogniser cannot do this (no speech service, network refused, language
 * unsupported) and recording locally does not care. "mic" is the person's
 * hardware or a permission they denied; "silence" is whether they spoke.
 * Recording again would tell them the same thing twice.
 */
export function fallbackCanRescue(problem: DictationProblem | null): boolean {
  return problem === "unavailable";
}

/** Web Speech `error` codes → the three words. Anything unknown is
 *  `unavailable`, never nothing: a control that fails silently looks broken. */
export function problemFor(error: string | undefined): DictationProblem | null {
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
export function problemForRecording(error: unknown): DictationProblem {
  const name = (error as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "mic";
  if (name === "NotFoundError" || name === "NotReadableError") return "mic";
  return "unavailable";
}

/**
 * The words on screen while a take is live: everything the recogniser has
 * settled on, then what it is still guessing at — one line, read as it is
 * spoken. A preview only: when the server leg transcribes, ITS words are
 * what lands in the box; these are what the person watches meanwhile, so a
 * take is never a timer and a wave with nothing to show for twenty seconds.
 */
export function liveWords(finals: readonly string[], interim: string): string {
  return [...finals, interim]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}

/** One entry of a Web Speech `event.results` list, as much of it as we read. */
export type RecognitionResultLike = { isFinal?: boolean } & ArrayLike<{ transcript?: string }>;

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

const wordsOf = (s: string): string[] => s.toLowerCase().trim().split(/\s+/).filter(Boolean);

/** Is `a` a whole-word prefix of `b` (equal counts)? */
function startsWithWords(b: readonly string[], a: readonly string[]): boolean {
  if (a.length === 0 || a.length > b.length) return false;
  return a.every((w, i) => b[i] === w);
}

/** Length of the longest common subsequence of two word lists. */
function commonWords(a: readonly string[], b: readonly string[]): number {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (const wa of a) {
    const row = new Array<number>(b.length + 1).fill(0);
    for (let j = 0; j < b.length; j++) {
      row[j + 1] = wa === b[j] ? prev[j]! + 1 : Math.max(prev[j + 1]!, row[j]!);
    }
    prev = row;
  }
  return prev[b.length]!;
}

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
export function heardFromResults(
  results: ArrayLike<RecognitionResultLike | undefined>,
  opts: { unflaggedIsFinal?: boolean } = {},
): HeardSoFar {
  type Kept = { text: string; words: string[]; final: boolean; revises: string | null };
  const raw: Kept[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const text = (r?.[0]?.transcript ?? "").trim();
    if (!r || !text) continue;
    const final = opts.unflaggedIsFinal ? r.isFinal !== false : r.isFinal === true;
    raw.push({ text, words: wordsOf(text), final, revises: null });
  }

  let cumulative = false;
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1]!.words;
    const b = raw[i]!.words;
    if (b.length > a.length && startsWithWords(b, a)) {
      cumulative = true;
      break;
    }
  }

  const kept: Kept[] = [];
  for (const next of raw) {
    const prev = kept[kept.length - 1];
    if (!prev) {
      kept.push(next);
      continue;
    }
    const grows = next.words.length > prev.words.length && startsWithWords(next.words, prev.words);
    const lateReport = cumulative && startsWithWords(prev.words, next.words);
    const revision =
      cumulative &&
      next.words.length >= prev.words.length &&
      next.words[0] === prev.words[0] &&
      commonWords(prev.words, next.words) >=
        prev.words.length - Math.max(1, Math.floor(prev.words.length / 4));
    if (lateReport && !grows) continue;
    if (grows || revision) {
      // The settled words an interim revision stands in for, so a take that
      // ends before the revision settles still delivers them.
      const revises = next.final ? null : prev.final ? prev.text : prev.revises;
      kept[kept.length - 1] = { ...next, revises };
      continue;
    }
    kept.push(next);
  }

  // Only the tail after the last settled link is interim (desktop Chrome may
  // split its guess into more than one result); a non-final before a final
  // has been followed by settled speech, so its words stand.
  let cut = kept.length;
  while (cut > 0 && !kept[cut - 1]!.final) cut--;
  const tail = kept.slice(cut);
  const finals = kept.slice(0, cut).map((k) => k.text);
  const interim = tail.map((k) => k.text).join(" ");
  const revised = tail.flatMap((k) => (k.revises ? [k.revises] : []));
  return { finals, interim, text: [...finals, ...revised].join(" ") };
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

export function mayKeepWaitingForPermission(
  elapsedMs: number,
  permissionPending: boolean,
): boolean {
  return permissionPending && elapsedMs < PERMISSION_WAIT_MS;
}

/** A browser whose recogniser proved dead is remembered for this long, so the
 *  person does not rediscover it on every press — and not forever, because a
 *  browser can gain the capability. */
export const DEAD_RECOGNISER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function deadRecogniserStillTrusted(rememberedAt: number | null, now = Date.now()): boolean {
  if (rememberedAt === null || !Number.isFinite(rememberedAt)) return false;
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
] as const;

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
export function isAudioFile(file: { type?: string; name?: string }): boolean {
  const type = (file.type ?? "").toLowerCase();
  if (type.startsWith("audio/")) return true;
  if (type.startsWith("image/") || type.startsWith("text/")) return false;
  return AUDIO_EXT.test(file.name ?? "");
}

/** The name a recording travels under. Whisper services read the container
 *  from the extension, so a mic take keeps the type's extension and a file
 *  keeps its own name. */
export function audioFileName(audio: { type?: string; name?: string }): string {
  if (audio.name && AUDIO_EXT.test(audio.name)) return audio.name;
  const type = (audio.type ?? "").toLowerCase();
  const ext =
    type.includes("mp4") || type.includes("m4a")
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
  readonly reason: string | null;
  readonly status: number | null;
  constructor(reason: string | null, status: number | null = null) {
    super(reason ?? `transcription failed${status ? ` (${status})` : ""}`);
    this.name = "TranscriptionError";
    this.reason = reason;
    this.status = status;
  }
}

/** The server's sentence from a failed transcription, if it sent one. Reads
 *  the shapes servers actually answer with: `{ error }`, `{ message }`,
 *  `{ error: { message } }`. Capped, because it is shown in a status line. */
export function reasonFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { error?: unknown; message?: unknown };
  const pick =
    typeof b.error === "string"
      ? b.error
      : b.error &&
          typeof b.error === "object" &&
          typeof (b.error as { message?: unknown }).message === "string"
        ? (b.error as { message: string }).message
        : typeof b.message === "string"
          ? b.message
          : null;
  const t = pick?.trim();
  return t ? t.slice(0, 200) : null;
}

/** What a thrown transcription error says, for any thrower: ours, or an
 *  app's `transcribe` that sets `reason` on whatever it throws. */
export function reasonOf(error: unknown): string | null {
  const r = (error as { reason?: unknown } | null)?.reason;
  return typeof r === "string" && r.trim() ? r.trim().slice(0, 200) : null;
}

/** The default words for each problem. Override per app (and per language). */
export const DEFAULT_DICTATION_MESSAGES: Record<DictationProblem, string> = {
  mic: "The microphone is blocked. Allow it for this site and try again.",
  silence: "Nothing was heard. Try again, a little closer to the mic.",
  unavailable: "Voice input is not available right now. Type instead, or try again later.",
  fileTooLarge: `That recording is too large to transcribe here (max ${Math.round(MAX_AUDIO_FILE_BYTES / 1024 / 1024)} MB).`,
};
