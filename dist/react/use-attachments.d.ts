import { type ClipboardEvent } from "react";
import { type Attachment, type AttachOptions, type AttachmentLimits, type AttachmentNotes, type AttachmentReader, type FileReadResult, type StagedAttachment } from "../attachments.js";
export type AttachmentsController = {
    attachments: StagedAttachment[];
    /** Why something did not attach (too big, wrong type, too many). Never
     *  thrown — a rejected file must not lose the draft next to it. */
    note: string | null;
    clearNote: () => void;
    addFiles: (files: FileList | File[] | null) => void;
    /** Consumes the paste only when it carried an image. */
    addFromPaste: (e: ClipboardEvent) => boolean;
    remove: (key: string) => void;
    clear: () => void;
    toWire: () => Attachment[];
    keyOf: (a: Attachment) => string;
    full: boolean;
    limits: AttachmentLimits;
};
/**
 * Staging screenshots and text files for a composer — paste-to-attach
 * included, because on a phone that is how a screenshot arrives. Preview URLs
 * are revoked on remove, clear and unmount (a preview never revoked is a leak
 * that survives every send). From loki `hooks/use-attachments.ts`.
 */
export declare function useAttachments(options?: AttachOptions, notes?: Partial<AttachmentNotes>): AttachmentsController;
export type ReadAttachment = {
    attachment: StagedAttachment;
    note?: undefined;
} | {
    attachment?: undefined;
    note: string;
};
/**
 * One file read the way the composer stages it: an image shrunk to
 * `maxImageEdge` and judged by its size after that, a text file read up to
 * `maxTextChars`, anything else refused — with the reason as a sentence from
 * `notes`, never a throw. `preview: true` adds an object URL the caller must
 * revoke. `useAttachments` and `ChatApp`'s `send` both read files through it.
 */
export declare function readAttachmentFile(file: File, limits?: Partial<AttachmentLimits>, notes?: Partial<AttachmentNotes>, { preview }?: {
    preview?: boolean;
}): Promise<ReadAttachment>;
/**
 * `readAttachmentFile`, with the app's own reader first. The reader may turn
 * one file into several attachments (a PDF of slide pictures) or into text, or
 * decline with `undefined`, in which case chatkit's reader decides. A reader
 * that throws gives the "could not read" note, never an exception.
 */
export declare function readAttachmentFiles(file: File, limits?: Partial<AttachmentLimits>, notes?: Partial<AttachmentNotes>, options?: {
    preview?: boolean;
    readFile?: AttachmentReader;
    images?: number;
    room?: number;
    progress?: (note: string) => void;
}): Promise<FileReadResult>;
//# sourceMappingURL=use-attachments.d.ts.map