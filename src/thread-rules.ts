/**
 * The thread rules the Messenger draws from: what may be attached, who was
 * addressed, how far a message has been read.
 *
 * THESE ARE `@bitbaum/threadkit`'s, word for word (threadkit 0.1.2:
 * `src/attachments.ts`, `src/mentions.ts`, `readState` in
 * `src/participants.ts`). They are carried here because on 2026-11-12
 * threadkit 0.1.2 was merged and tagged but could not reach npm — its publish
 * workflow is not yet linked as the package's trusted publisher — and a
 * Messenger that waits for a registry form is a Messenger nobody has.
 *
 * WHEN `npm view @bitbaum/threadkit version` SAYS 0.1.2 OR LATER: raise the
 * dependency to `^0.1.2`, replace this file's body with re-exports from
 * `@bitbaum/threadkit`, and delete `test/thread-rules.test.js`'s copies of
 * threadkit's own tests. Until then `test/thread-rules.test.js` runs those
 * tests here and, wherever the installed threadkit already has a rule,
 * checks that the two give the same answers — so this copy cannot drift
 * unnoticed. Fix a rule in threadkit first, then here.
 */
import {
  canSeeMessage,
  readersOf,
  type Message,
  type Participant,
  type Thread,
} from "@bitbaum/threadkit";

/**
 * What a file on a message is, as a reader meets it.
 *
 * `image`, `video` and `audio` are shown in place; `file` is something to
 * open or download. The split is by how it is used, not by where it is kept.
 */
export type AttachmentKind = "image" | "video" | "audio" | "file";

/**
 * A file that travels with a message.
 *
 * The thread knows what it is and how big it is; the bytes live in your object
 * storage, under whatever key you gave them. Deliberately no URL here: a URL
 * to a private file is a grant with an expiry, and that is decided per reader
 * at the moment of reading, never stored on the message.
 */
/* Named `ThreadAttachment` here: chatkit's own `Attachment` is what a composer
   stages for a model (text or a picture, inlined). In threadkit this is
   `Attachment`. */
export interface ThreadAttachment {
  readonly id: string;
  readonly kind: AttachmentKind;
  /** The name the sender's device gave it. Shown to readers; never used as a path. */
  readonly name: string;
  readonly mimeType: string;
  /** Size as stored, in bytes. What a quota counts. */
  readonly bytes: number;
  /** Pixels, for an image or a video — lets a reader lay it out before it loads. */
  readonly width?: number;
  readonly height?: number;
  /** Length of a video or a recording, in milliseconds. */
  readonly durationMs?: number;
}

/**
 * What may be attached, how big, how much, and for how long.
 *
 * Files are where a messenger's costs live. Text is bytes; one phone video is
 * megabytes, kept until somebody decides otherwise — and usually nobody does.
 * So the decisions are a policy, stated once and enforced in the same words on
 * the client (to refuse before an upload starts) and on the server (because
 * the client can be anyone):
 *
 * - **An allowlist, not a blocklist.** A type that is not named is refused. A
 *   blocklist is correct until the first type nobody thought of, and the type
 *   nobody thought of is the one that runs script when a reader opens it.
 * - **A ceiling per kind**, because a photo and a video are not the same risk.
 * - **A quota per person**, counted over what is still stored, so deleting
 *   something frees room for something else.
 * - **A lifetime.** An upload that never became a message is swept after a few
 *   hours; a sent file may expire after a stated number of days, or be kept
 *   as long as its message. Either way the rule is written down, not implied.
 *
 * Pure functions over numbers you already have. This file stores nothing,
 * signs nothing and never sees a byte.
 */
export interface AttachmentPolicy {
  /** Files on one message. */
  readonly maxPerMessage: number;
  /** Largest file of each kind, in bytes. 0 refuses the kind outright. */
  readonly maxBytes: Readonly<Record<AttachmentKind, number>>;
  /**
   * MIME types accepted for each kind: exact (`image/png`) or a whole family
   * (`audio/*`). Anything not listed is refused, whatever its extension says.
   */
  readonly accept: Readonly<Record<AttachmentKind, readonly string[]>>;
  /**
   * Bytes one person may keep stored at a time, across every thread.
   * `null` means no ceiling — say so on purpose.
   */
  readonly quotaBytes: number | null;
  /**
   * Days a sent attachment is kept. `null` keeps it as long as its message.
   * The message outlives its files: words stay, the file is gone, and a
   * reader is told so rather than shown a broken picture.
   */
  readonly retentionDays: number | null;
  /** Hours an uploaded file may wait to be sent before it is swept as abandoned. */
  readonly orphanHours: number;
}

const MB = 1024 * 1024;

/**
 * Defaults sized for a messenger whose pictures are shrunk in the browser
 * before they are sent: a photo arrives well under the image ceiling, and the
 * ceiling is there for the animated GIF and the picture nothing could shrink.
 *
 * `image/svg+xml` and `text/html` are deliberately absent. Both can carry
 * script, and a file a reader opens from your storage origin runs there.
 */
export const DEFAULT_ATTACHMENT_POLICY: AttachmentPolicy = {
  maxPerMessage: 10,
  maxBytes: {
    image: 10 * MB,
    video: 50 * MB,
    audio: 20 * MB,
    file: 25 * MB,
  },
  accept: {
    image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
    video: ["video/mp4", "video/webm", "video/quicktime"],
    audio: [
      "audio/mpeg",
      "audio/mp4",
      "audio/aac",
      "audio/ogg",
      "audio/webm",
      "audio/wav",
      "audio/x-wav",
      "audio/x-m4a",
    ],
    file: [
      "application/pdf",
      "text/plain",
      "text/csv",
      "text/markdown",
      "application/json",
      "application/zip",
      "application/rtf",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.oasis.opendocument.text",
      "application/vnd.oasis.opendocument.spreadsheet",
      "application/epub+zip",
    ],
  },
  quotaBytes: 1024 * MB,
  retentionDays: null,
  orphanHours: 24,
};

/** The parameters of a MIME type (`; charset=utf-8`) say nothing about what it is. */
function bareMime(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

function matches(mime: string, pattern: string): boolean {
  const p = pattern.toLowerCase();
  if (p.endsWith("/*")) return mime.startsWith(p.slice(0, -1));
  return mime === p;
}

const KINDS: readonly AttachmentKind[] = ["image", "video", "audio", "file"];

/**
 * Which kind a MIME type is under this policy, or `null` when the policy does
 * not accept it at all.
 *
 * The policy decides, not the type's first word: `image/svg+xml` is an image
 * by name and a document that can run script by nature, so unless a policy
 * lists it under `image` it is never shown in place.
 */
export function attachmentKind(
  mimeType: string,
  policy: AttachmentPolicy = DEFAULT_ATTACHMENT_POLICY,
): AttachmentKind | null {
  const mime = bareMime(mimeType);
  if (!mime) return null;
  for (const kind of KINDS) {
    if (policy.accept[kind].some((pattern) => matches(mime, pattern))) return kind;
  }
  return null;
}

/** Why a file was refused. Every reason carries the number a person needs to hear. */
export type AttachmentRefusal =
  | { readonly ok: false; readonly reason: "empty" }
  | { readonly ok: false; readonly reason: "type" }
  | {
      readonly ok: false;
      readonly reason: "size";
      readonly kind: AttachmentKind;
      readonly maxBytes: number;
    }
  | { readonly ok: false; readonly reason: "count"; readonly maxPerMessage: number }
  | {
      readonly ok: false;
      readonly reason: "quota";
      readonly quotaBytes: number;
      readonly usedBytes: number;
    };

export type AttachmentCheck =
  { readonly ok: true; readonly kind: AttachmentKind } | AttachmentRefusal;

/** What is already there when a new file asks to join. */
export interface AttachmentUsage {
  /** Files already on the message being written. */
  readonly onMessage?: number;
  /** Bytes this person already has stored. Only consulted when the policy has a quota. */
  readonly usedBytes?: number;
}

/**
 * May this file be attached?
 *
 * Returns rather than throws, and says why — a refusal is the normal outcome
 * of somebody picking a two-gigabyte video, and the caller's job is to say the
 * limit back to them. Checks run cheapest-first, so the answer for a wrong
 * type never depends on a quota lookup.
 *
 * Run it twice: in the browser before the upload starts (to save the person
 * the wait), and on the server before a storage URL is issued (because the
 * first check proves nothing about a request you did not write).
 */
export function checkAttachment(
  file: { readonly mimeType: string; readonly bytes: number },
  usage: AttachmentUsage = {},
  policy: AttachmentPolicy = DEFAULT_ATTACHMENT_POLICY,
): AttachmentCheck {
  if (!Number.isFinite(file.bytes) || file.bytes <= 0) return { ok: false, reason: "empty" };

  const kind = attachmentKind(file.mimeType, policy);
  if (!kind) return { ok: false, reason: "type" };

  const maxBytes = policy.maxBytes[kind];
  // A ceiling of 0 turns the kind off: it is a type this thread does not take.
  if (maxBytes <= 0) return { ok: false, reason: "type" };
  if (file.bytes > maxBytes) return { ok: false, reason: "size", kind, maxBytes };

  if ((usage.onMessage ?? 0) >= policy.maxPerMessage) {
    return { ok: false, reason: "count", maxPerMessage: policy.maxPerMessage };
  }

  if (policy.quotaBytes !== null) {
    const usedBytes = usage.usedBytes ?? 0;
    if (usedBytes + file.bytes > policy.quotaBytes) {
      return { ok: false, reason: "quota", quotaBytes: policy.quotaBytes, usedBytes };
    }
  }

  return { ok: true, kind };
}

/** Bytes a set of attachments occupies — what a quota is compared against. */
export function storedBytes(attachments: readonly { readonly bytes: number }[]): number {
  let total = 0;
  for (const a of attachments) total += Math.max(0, a.bytes);
  return total;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * When a sent attachment stops being kept, or `null` when the policy keeps it
 * as long as its message.
 */
export function attachmentExpiresAt(
  sentAt: Date,
  policy: AttachmentPolicy = DEFAULT_ATTACHMENT_POLICY,
): Date | null {
  if (policy.retentionDays === null) return null;
  return new Date(sentAt.getTime() + policy.retentionDays * DAY_MS);
}

/** Has a sent attachment outlived the policy's retention? Never true without one. */
export function isAttachmentExpired(
  sentAt: Date,
  now: Date = new Date(),
  policy: AttachmentPolicy = DEFAULT_ATTACHMENT_POLICY,
): boolean {
  const expiresAt = attachmentExpiresAt(sentAt, policy);
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

/**
 * Is an uploaded file that was never sent old enough to sweep?
 *
 * Uploading and sending are two steps, and the second does not always happen:
 * a tab closes, a person changes their mind. Without this rule every abandoned
 * upload is stored — and counted against its owner's quota — forever.
 */
export function isAbandonedUpload(
  uploadedAt: Date,
  now: Date = new Date(),
  policy: AttachmentPolicy = DEFAULT_ATTACHMENT_POLICY,
): boolean {
  return now.getTime() - uploadedAt.getTime() >= policy.orphanHours * HOUR_MS;
}

/**
 * Was somebody addressed by name?
 *
 * Whole words only. A substring test looks fine until an alias like "ai"
 * matches "again" or "wait" and an assistant starts answering turns nobody
 * addressed to it — or a "@cat" tag fires on "@catalogue". The same matcher
 * decides it on the server (does the agent answer?) and in the interface
 * (is the agent about to answer?), so the two cannot disagree.
 */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A matcher for a fixed set of aliases, compiled once.
 *
 * A word character on either side of the alias means it is part of a longer
 * word and is not a mention; anything else — a space, punctuation, the start
 * or the end of the text — is a boundary. Case is ignored. Empty aliases are
 * dropped, so a blank handle can never match everything.
 */
export function mentionMatcher(aliases: readonly string[]): (text: string) => boolean {
  const patterns = aliases
    .map((alias) => alias.trim())
    .filter(Boolean)
    .map(
      (alias) => new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(alias)}(?![\\p{L}\\p{N}_])`, "iu"),
    );
  return (text) => patterns.some((re) => re.test(text));
}

/** Does `text` mention any of `aliases` as a whole word? */
export function mentionsAny(text: string, aliases: readonly string[]): boolean {
  return mentionMatcher(aliases)(text);
}

/**
 * How far a message has been read: by nobody else, by some, or by everyone
 * who could have.
 *
 * `audience` is the people the message was *for*: every human participant
 * other than its author who can see it and has not left. A model is left out
 * on purpose — it has no reading to report, and counting it would mean a
 * message in a room with an assistant could never be "read by all".
 *
 * This is what a tick is drawn from. One grey tick, two, or two coloured is a
 * presentation choice; which of the three states a message is in is a rule,
 * and it has to be the same rule for two participants and for ten.
 */
export function readState(
  thread: Thread,
  message: Message,
): {
  readonly state: "none" | "some" | "all";
  readonly readers: readonly Participant[];
  readonly audience: number;
} {
  const audience = thread.participants.filter(
    (p) =>
      p.kind === "human" &&
      p.actorId !== message.authorId &&
      !p.leftAt &&
      canSeeMessage(p, message),
  );
  const readers = readersOf(thread, message).filter((p) => p.kind === "human" && !p.leftAt);
  const state =
    audience.length === 0 || readers.length === 0
      ? "none"
      : readers.length >= audience.length
        ? "all"
        : "some";
  return { state, readers, audience: audience.length };
}
