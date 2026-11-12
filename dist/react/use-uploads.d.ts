import { type AttachmentKind, type AttachmentPolicy } from "../thread-rules.js";
import { type MessengerAttachment, type MessengerRefusalLabels, type MessengerTransport } from "../messenger.js";
/** A file between being picked and being on a message. */
export type UploadItem = {
    key: string;
    name: string;
    kind: AttachmentKind;
    bytes: number;
    /** A `blob:` picture of it (the photo itself, a video's first frame). */
    previewUrl?: string;
    /** 0..1 while its bytes travel. */
    progress: number;
    state: "preparing" | "uploading" | "done" | "failed";
    attachment?: MessengerAttachment;
};
export type UploadOptions = {
    /** What may be attached. threadkit's default when left out. */
    policy?: AttachmentPolicy;
    /**
     * Longest edge, in pixels, a photo is shrunk to before it is uploaded.
     * A phone photo is 12 megapixels and several megabytes; nobody reads a
     * conversation at that size, and every byte is stored until somebody
     * deletes it. 0 sends the original.
     */
    imageMaxEdge?: number;
    /** What a shrunk photo must fit, in bytes. */
    imageMaxBytes?: number;
};
export declare const DEFAULT_UPLOAD_OPTIONS: Required<Omit<UploadOptions, "policy">>;
export type UploadsController = {
    items: UploadItem[];
    /** Why something was not taken, in words. */
    note: string | null;
    clearNote: () => void;
    add: (files: readonly File[]) => void;
    remove: (key: string) => void;
    retry: (key: string) => void;
    /** Forget everything staged (after a send, or when the conversation changes). */
    clear: () => void;
    /** The uploads that are ready to go on a message, in the order picked. */
    attachments: MessengerAttachment[];
    /** Something is still on its way. */
    busy: boolean;
};
/**
 * Files on their way to a message: checked against the policy before a byte
 * moves, photos shrunk in the browser, each uploaded through the app's
 * `transport.upload` with its progress shown, a failure kept with Try again.
 * The same rule that refuses a file here refuses it on the server
 * (`@bitbaum/threadkit` `checkAttachment`), so the two cannot disagree.
 */
export declare function useUploads({ transport, conversationId, options, labels, failedText, }: {
    transport: MessengerTransport;
    conversationId: string | null;
    options?: UploadOptions;
    labels: MessengerRefusalLabels;
    /** "{name} could not be uploaded." */
    failedText: string;
}): UploadsController;
//# sourceMappingURL=use-uploads.d.ts.map