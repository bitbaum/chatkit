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
    /** Raw image bytes before base64. */
    maxImageBytes: number;
};
export declare const DEFAULT_ATTACHMENT_LIMITS: AttachmentLimits;
export declare function isImageMime(mime: string): boolean;
/** `data:image/png;base64,AAAA` → `AAAA`: FileReader hands back a data URL,
 *  the wire carries raw base64. */
export declare function stripDataUrlBase64(dataUrl: string): string;
/** Identity for dedupe and removal: the same name and bytes are the same
 *  attachment however they arrived (picker, paste, drop). */
export declare function attachmentKey(a: Attachment): string;
/** Strip client-only fields: what the API validates. */
export declare function toWire(staged: StagedAttachment[]): Attachment[];
//# sourceMappingURL=attachments.d.ts.map