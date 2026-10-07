/**
 * What a composer can attach, and the wire shape an app's API receives.
 *
 * From loki `lib/loki/attachments.ts`. The limits are defaults, not law — an
 * app passes its own to `useAttachments` when its model or API differs.
 */
export type TextAttachment = {
    kind: "text";
    name: string;
    content: string;
};
export type ImageAttachment = {
    kind: "image";
    name: string;
    mimeType: string;
    dataBase64: string;
};
export type Attachment = TextAttachment | ImageAttachment;
/** Client-only preview URL — never sent to the API. */
export type StagedAttachment = Attachment & {
    previewUrl?: string;
};
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
export declare const DEFAULT_ATTACHMENT_LIMITS: AttachmentLimits;
/** Why a file did not attach — every one a label, so an app can say it in its
 *  reader's language. */
export type AttachmentNotes = {
    wrongType: (name: string) => string;
    imageTooLarge: (name: string, maxMb: number) => string;
    textTooLarge: (name: string, maxThousandChars: number) => string;
    unreadable: (name: string) => string;
    tooMany: (max: number) => string;
};
export declare const DEFAULT_ATTACHMENT_NOTES: AttachmentNotes;
/**
 * The size an image is drawn at to fit `maxEdge` on its longest side. Never
 * enlarges; 0 (or less) means "leave it". Pure, so it is tested without a DOM.
 */
export declare function fitWithin(width: number, height: number, maxEdge: number): {
    width: number;
    height: number;
    scaled: boolean;
};
/** Bytes a base64 data URL decodes to — close enough to compare to a limit. */
export declare function dataUrlBytes(dataUrl: string): number;
export declare function isImageMime(mime: string): boolean;
/**
 * Whether a file is text the model can read inline. The Files picker accepts
 * anything — that is what keeps it the phone's real document browser instead
 * of a camera chooser — so the decision about what can actually be sent moves
 * here, after the pick, where a PDF gets a sentence instead of being read as
 * binary noise and pasted into a prompt.
 */
export declare function isTextFile(name: string, mime: string): boolean;
/**
 * Where an attachment comes from. Three sources, three inputs, because a phone
 * answers ONE input with a mixed `accept` ("image/*,text/*,audio/*") by
 * opening a chooser of capture apps — Camera, Camera, Recorder, "Photos &
 * Videos" — in which the screenshot you came to send is three levels down,
 * and the file browser is not offered at all. Measured on Android/Brave,
 * 2026-10-05; it is what made attaching to Loki "impossible".
 *
 * - camera: `capture` opens the camera straight away.
 * - photos: `image/*` alone opens the system photo picker (Screenshots is its
 *   first album), not a chooser.
 * - files: no `accept` at all opens the real document browser — Downloads,
 *   Drive, any folder. The type check happens after, in `isTextFile`.
 */
export type AttachSource = "camera" | "photos" | "files";
export declare const ATTACH_SOURCE_INPUT: Record<AttachSource, {
    accept?: string;
    capture?: "environment";
}>;
/** What kind of picker a file `accept` asks a phone for. */
export type AcceptFamily = "image" | "audio" | "video" | "document";
/**
 * The families an `accept` value spans. More than one is the bug
 * `ATTACH_SOURCE_INPUT` exists to prevent: a phone answers a mixed accept with
 * a chooser of capture apps instead of the picker the person needed. Pure, so
 * the fleet's file-input check (`chatkit-check-file-inputs`) and the tests
 * share one definition.
 */
export declare function acceptFamilies(accept: string): AcceptFamily[];
/** `data:image/png;base64,AAAA` → `AAAA`: FileReader hands back a data URL,
 *  the wire carries raw base64. */
export declare function stripDataUrlBase64(dataUrl: string): string;
/** Identity for dedupe and removal: the same name and bytes are the same
 *  attachment however they arrived (picker, paste, drop). */
export declare function attachmentKey(a: Attachment): string;
/** Strip client-only fields: what the API validates. */
export declare function toWire(staged: StagedAttachment[]): Attachment[];
//# sourceMappingURL=attachments.d.ts.map