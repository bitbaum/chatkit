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
    maxImageEdge: 0,
};
export const DEFAULT_ATTACHMENT_NOTES = {
    wrongType: (name) => `${name}: attach an image (PNG, JPEG, GIF, WebP) or a text file.`,
    imageTooLarge: (name, maxMb) => `${name} is too large (max ${maxMb} MB).`,
    textTooLarge: (name, k) => `${name} is too large (max ${k}k characters).`,
    unreadable: (name) => `Could not read ${name}.`,
    tooMany: (max) => `Up to ${max} files.`,
};
/**
 * The size an image is drawn at to fit `maxEdge` on its longest side. Never
 * enlarges; 0 (or less) means "leave it". Pure, so it is tested without a DOM.
 */
export function fitWithin(width, height, maxEdge) {
    const longest = Math.max(width, height);
    if (maxEdge <= 0 || longest <= maxEdge)
        return { width, height, scaled: false };
    const scale = maxEdge / longest;
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        scaled: true,
    };
}
/** Bytes a base64 data URL decodes to — close enough to compare to a limit. */
export function dataUrlBytes(dataUrl) {
    return Math.floor(stripDataUrlBase64(dataUrl).length * 0.75);
}
const IMAGE_MIME = /^image\/(jpeg|jpg|png|gif|webp)$/i;
export function isImageMime(mime) {
    return IMAGE_MIME.test(mime);
}
/** Extensions a picker may hand over with no type, or as
 *  application/octet-stream, that are still plain text a model can read. */
const TEXT_EXTENSIONS = /\.(txt|md|markdown|json|jsonl|csv|tsv|log|ya?ml|toml|ini|xml|html?|css|scss|js|jsx|mjs|cjs|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|bash|zsh|sql|env|diff|patch|srt|vtt)$/i;
const TEXT_MIME = /^(text\/|application\/(json|xml|x-yaml|yaml|javascript|x-sh|sql))/i;
/**
 * Whether a file is text the model can read inline. The Files picker accepts
 * anything — that is what keeps it the phone's real document browser instead
 * of a camera chooser — so the decision about what can actually be sent moves
 * here, after the pick, where a PDF gets a sentence instead of being read as
 * binary noise and pasted into a prompt.
 */
export function isTextFile(name, mime) {
    if (TEXT_MIME.test(mime))
        return true;
    if (mime && mime !== "application/octet-stream")
        return false;
    return TEXT_EXTENSIONS.test(name);
}
export const ATTACH_SOURCE_INPUT = {
    camera: { accept: "image/*", capture: "environment" },
    photos: { accept: "image/*" },
    files: {},
};
const FAMILY_BY_EXTENSION = {};
for (const ext of [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "heic",
    "heif",
    "avif",
    "bmp",
    "svg",
    "tif",
    "tiff",
])
    FAMILY_BY_EXTENSION[ext] = "image";
for (const ext of ["mp3", "m4a", "wav", "ogg", "oga", "opus", "aac", "flac", "amr", "wma"])
    FAMILY_BY_EXTENSION[ext] = "audio";
for (const ext of ["mp4", "mov", "m4v", "mkv", "avi", "wmv"])
    FAMILY_BY_EXTENSION[ext] = "video";
// Containers that hold either sound or picture (.webm, .3gp) say nothing about
// the picker on their own, so they are not counted for either family.
const AMBIGUOUS_EXTENSIONS = new Set(["webm", "3gp", "3g2", "mpeg", "mpg"]);
/**
 * The families an `accept` value spans. More than one is the bug
 * `ATTACH_SOURCE_INPUT` exists to prevent: a phone answers a mixed accept with
 * a chooser of capture apps instead of the picker the person needed. Pure, so
 * the fleet's file-input check (`chatkit-check-file-inputs`) and the tests
 * share one definition.
 */
export function acceptFamilies(accept) {
    const found = new Set();
    for (const raw of accept.split(",")) {
        const token = raw.trim().toLowerCase();
        if (!token)
            continue;
        if (token.startsWith(".")) {
            const ext = token.slice(1);
            if (AMBIGUOUS_EXTENSIONS.has(ext))
                continue;
            found.add(FAMILY_BY_EXTENSION[ext] ?? "document");
            continue;
        }
        const major = token.split("/")[0];
        if (major === "image" || major === "audio" || major === "video")
            found.add(major);
        else
            found.add("document");
    }
    return [...found];
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