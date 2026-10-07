/**
 * Draw the image no larger than `maxEdge` and encode it as JPEG, stepping the
 * quality down until it fits `maxBytes`. Null when it cannot be made to fit,
 * or the browser cannot decode it (no `createImageBitmap`, no canvas).
 */
export declare function shrinkImage(file: File, maxEdge: number, maxBytes: number): Promise<string | null>;
//# sourceMappingURL=image.d.ts.map