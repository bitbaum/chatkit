import { type ClipboardEvent } from "react";
import { type Attachment, type AttachmentLimits, type StagedAttachment } from "../attachments.js";
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
export declare function useAttachments(limits?: Partial<AttachmentLimits>): AttachmentsController;
//# sourceMappingURL=use-attachments.d.ts.map