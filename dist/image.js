/**
 * Shrinking a picture in the browser before it leaves the device — for a chat
 * attachment and for any uploader (an avatar, a product photo, a receipt).
 * Browser-only: it needs `createImageBitmap` and a canvas, and returns null
 * where they are missing rather than throwing.
 */
import { dataUrlBytes, fitWithin } from "./attachments.js";
/**
 * Draw the image no larger than `maxEdge` and encode it as JPEG, stepping the
 * quality down until it fits `maxBytes`. Null when it cannot be made to fit,
 * or the browser cannot decode it (no `createImageBitmap`, no canvas).
 */
export async function shrinkImage(file, maxEdge, maxBytes) {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined")
        return null;
    const bitmap = await createImageBitmap(file);
    try {
        const size = fitWithin(bitmap.width, bitmap.height, maxEdge);
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            return null;
        // JPEG has no alpha: paint white first so a transparent PNG does not turn black.
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size.width, size.height);
        ctx.drawImage(bitmap, 0, 0, size.width, size.height);
        let quality = 0.82;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrlBytes(dataUrl) > maxBytes && quality > 0.4) {
            quality -= 0.15;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        return dataUrlBytes(dataUrl) > maxBytes ? null : dataUrl;
    }
    finally {
        bitmap.close();
    }
}
//# sourceMappingURL=image.js.map