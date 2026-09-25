/**
 * What a composer can attach, and the wire shape an app's API receives.
 *
 * From loki `lib/loki/attachments.ts`. The limits are defaults, not law — an
 * app passes its own to `useAttachments` when its model or API differs.
 */
export const DEFAULT_ATTACHMENT_LIMITS = {
    maxFiles: 5,
    maxTextChars: 100_000,
    maxImageBytes: 2_800_000,
};
const IMAGE_MIME = /^image\/(jpeg|jpg|png|gif|webp)$/i;
export function isImageMime(mime) {
    return IMAGE_MIME.test(mime);
}
/** `data:image/png;base64,AAAA` → `AAAA`: FileReader hands back a data URL,
 *  the wire carries raw base64. */
export function stripDataUrlBase64(dataUrl) {
    const i = dataUrl.indexOf(",");
    return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}
/** Identity for dedupe and removal: the same name and bytes are the same
 *  attachment however they arrived (picker, paste, drop). */
export function attachmentKey(a) {
    return a.kind === "image"
        ? `image:${a.name}:${a.dataBase64.length}`
        : `text:${a.name}:${a.content.length}`;
}
/** Strip client-only fields: what the API validates. */
export function toWire(staged) {
    return staged.map((a) => {
        const { previewUrl: _preview, ...rest } = a;
        void _preview;
        return rest;
    });
}
//# sourceMappingURL=attachments.js.map