/**
 * What a composer can attach, and the wire shape an app's API receives.
 *
 * From loki `lib/loki/attachments.ts`. The limits are defaults, not law — an
 * app passes its own to `useAttachments` when its model or API differs.
 */

export type TextAttachment = { kind: "text"; name: string; content: string };
export type ImageAttachment = {
  kind: "image";
  name: string;
  mimeType: string;
  dataBase64: string;
};
export type Attachment = TextAttachment | ImageAttachment;

/** Client-only preview URL — never sent to the API. */
export type StagedAttachment = Attachment & { previewUrl?: string };

export type AttachmentLimits = {
  /** Files per message. */
  maxFiles: number;
  /** Characters per text file (it is inlined into a prompt). */
  maxTextChars: number;
  /** Raw image bytes before base64 — checked AFTER any downscale. */
  maxImageBytes: number;
  /**
   * Longest edge, in pixels, an image is shrunk to in the browser before it is
   * staged. 0 = send the original. A phone screenshot is ~1290×2796 and several
   * megabytes; vision models bill by tile and read a chat bubble just as well
   * at 1024px, so shrinking first is cheaper for the reader AND means the full
   * screenshot never leaves the device. Shrunk images are re-encoded as JPEG
   * (a screenshot re-encoded as PNG is often larger), stepping quality down
   * until they fit `maxImageBytes`. From heidi `downscale.ts`.
   */
  maxImageEdge: number;
};

export const DEFAULT_ATTACHMENT_LIMITS: AttachmentLimits = {
  maxFiles: 5,
  maxTextChars: 100_000,
  maxImageBytes: 2_800_000,
  maxImageEdge: 0,
};

/** Why a file did not attach — every one a label, so an app can say it in its
 *  reader's language. */
export type AttachmentNotes = {
  wrongType: (name: string) => string;
  imageTooLarge: (name: string, maxMb: number) => string;
  textTooLarge: (name: string, maxThousandChars: number) => string;
  unreadable: (name: string) => string;
  tooMany: (max: number) => string;
};

export const DEFAULT_ATTACHMENT_NOTES: AttachmentNotes = {
  wrongType: (name) => `${name}: use PNG, JPEG, GIF or WebP.`,
  imageTooLarge: (name, maxMb) => `${name} is too large (max ${maxMb} MB).`,
  textTooLarge: (name, k) => `${name} is too large (max ${k}k characters).`,
  unreadable: (name) => `Could not read ${name}.`,
  tooMany: (max) => `Up to ${max} files.`,
};

/**
 * The size an image is drawn at to fit `maxEdge` on its longest side. Never
 * enlarges; 0 (or less) means "leave it". Pure, so it is tested without a DOM.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(width, height);
  if (maxEdge <= 0 || longest <= maxEdge) return { width, height, scaled: false };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  };
}

/** Bytes a base64 data URL decodes to — close enough to compare to a limit. */
export function dataUrlBytes(dataUrl: string): number {
  return Math.floor(stripDataUrlBase64(dataUrl).length * 0.75);
}

const IMAGE_MIME = /^image\/(jpeg|jpg|png|gif|webp)$/i;

export function isImageMime(mime: string): boolean {
  return IMAGE_MIME.test(mime);
}

/** `data:image/png;base64,AAAA` → `AAAA`: FileReader hands back a data URL,
 *  the wire carries raw base64. */
export function stripDataUrlBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

/** Identity for dedupe and removal: the same name and bytes are the same
 *  attachment however they arrived (picker, paste, drop). */
export function attachmentKey(a: Attachment): string {
  return a.kind === "image"
    ? `image:${a.name}:${a.dataBase64.length}`
    : `text:${a.name}:${a.content.length}`;
}

/** Strip client-only fields: what the API validates. */
export function toWire(staged: StagedAttachment[]): Attachment[] {
  return staged.map((a) => {
    const { previewUrl: _preview, ...rest } = a;
    void _preview;
    return rest as Attachment;
  });
}
