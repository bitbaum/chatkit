"use client";

import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from "react";
import { shrinkImage as shrink } from "../image.js";
import {
  DEFAULT_ATTACHMENT_LIMITS,
  DEFAULT_ATTACHMENT_NOTES,
  attachmentKey,
  isImageMime,
  isTextFile,
  stripDataUrlBase64,
  toWire,
  type Attachment,
  type AttachmentLimits,
  type AttachmentNotes,
  type StagedAttachment,
} from "../attachments.js";

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
export function useAttachments(
  limits: Partial<AttachmentLimits> = {},
  notes: Partial<AttachmentNotes> = {},
): AttachmentsController {
  const lim: AttachmentLimits = { ...DEFAULT_ATTACHMENT_LIMITS, ...limits };
  const { maxFiles, maxImageBytes, maxTextChars, maxImageEdge } = lim;
  // Mirrored in a ref so a new `notes` object every render does not rebuild
  // every callback below.
  const say = useRef<AttachmentNotes>(DEFAULT_ATTACHMENT_NOTES);
  useEffect(() => {
    say.current = { ...DEFAULT_ATTACHMENT_NOTES, ...notes };
  });
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const previews = useRef<Set<string>>(new Set());
  const count = useRef(0);

  useEffect(() => {
    count.current = attachments.length;
  }, [attachments.length]);

  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const add = useCallback(
    (item: StagedAttachment) =>
      setAttachments((prev) => {
        if (prev.length >= maxFiles) return prev;
        if (prev.some((p) => attachmentKey(p) === attachmentKey(item))) return prev;
        return [...prev, item];
      }),
    [maxFiles],
  );

  const stage = useCallback(
    (file: File) => {
      const limits = { maxFiles, maxImageBytes, maxImageEdge, maxTextChars };
      void readAttachmentFile(file, limits, say.current, { preview: true }).then((read) => {
        if (read.note !== undefined) {
          setNote(read.note);
          return;
        }
        if (read.attachment.previewUrl) previews.current.add(read.attachment.previewUrl);
        add(read.attachment);
      });
    },
    [add, maxFiles, maxImageBytes, maxImageEdge, maxTextChars],
  );

  const addFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      setNote(null);
      const room = maxFiles - count.current;
      if (room <= 0) {
        setNote(say.current.tooMany(maxFiles));
        return;
      }
      for (const file of Array.from(files).slice(0, room)) {
        stage(file);
      }
    },
    [maxFiles, stage],
  );

  const addFromPaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return false;
      const images = Array.from(items).filter((i) => i.type.startsWith("image/"));
      if (images.length === 0) return false;
      setNote(null);
      for (const item of images) {
        const file = item.getAsFile();
        if (file) stage(file);
      }
      return true;
    },
    [stage],
  );

  const revoke = (a: StagedAttachment) => {
    if (!a.previewUrl) return;
    URL.revokeObjectURL(a.previewUrl);
    previews.current.delete(a.previewUrl);
  };

  const remove = useCallback((key: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => attachmentKey(a) === key);
      if (target) revoke(target);
      return prev.filter((a) => attachmentKey(a) !== key);
    });
  }, []);

  const clear = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach(revoke);
      return [];
    });
    setNote(null);
  }, []);

  return {
    attachments,
    note,
    clearNote: () => setNote(null),
    addFiles,
    addFromPaste,
    remove,
    clear,
    toWire: () => toWire(attachments),
    keyOf: attachmentKey,
    full: attachments.length >= maxFiles,
    limits: lim,
  };
}

export type ReadAttachment =
  { attachment: StagedAttachment; note?: undefined } | { attachment?: undefined; note: string };

/**
 * One file read the way the composer stages it: an image shrunk to
 * `maxImageEdge` and judged by its size after that, a text file read up to
 * `maxTextChars`, anything else refused — with the reason as a sentence from
 * `notes`, never a throw. `preview: true` adds an object URL the caller must
 * revoke. `useAttachments` and `ChatApp`'s `send` both read files through it.
 */
export async function readAttachmentFile(
  file: File,
  limits: Partial<AttachmentLimits> = {},
  notes: Partial<AttachmentNotes> = {},
  { preview = false }: { preview?: boolean } = {},
): Promise<ReadAttachment> {
  const { maxImageBytes, maxTextChars, maxImageEdge } = { ...DEFAULT_ATTACHMENT_LIMITS, ...limits };
  const say = { ...DEFAULT_ATTACHMENT_NOTES, ...notes };
  const previewOf = () => (preview ? URL.createObjectURL(file) : undefined);
  if (isImageMime(file.type)) {
    const name = file.name || "screenshot.png";
    const tooLarge = { note: say.imageTooLarge(name, Math.round(maxImageBytes / 1_000_000)) };
    try {
      if (maxImageEdge > 0) {
        // Shrink first, then judge the size: a 4 MB screenshot is fine once it
        // is the 300 KB it needed to be.
        const dataUrl = await shrink(file, maxImageEdge, maxImageBytes);
        if (!dataUrl) return tooLarge;
        return {
          attachment: {
            kind: "image",
            name: name.replace(/\.(png|gif|webp|jpe?g)$/i, "") + ".jpg",
            mimeType: "image/jpeg",
            dataBase64: stripDataUrlBase64(dataUrl),
            previewUrl: previewOf(),
          },
        };
      }
      if (file.size > maxImageBytes) return tooLarge;
      const dataUrl = await readAs(file, "dataUrl");
      return {
        attachment: {
          kind: "image",
          name,
          mimeType: file.type,
          dataBase64: stripDataUrlBase64(dataUrl),
          previewUrl: previewOf(),
        },
      };
    } catch {
      return { note: say.unreadable(name) };
    }
  }
  if (!isTextFile(file.name, file.type)) return { note: say.wrongType(file.name) };
  if (file.size > maxTextChars) {
    return { note: say.textTooLarge(file.name, Math.round(maxTextChars / 1000)) };
  }
  try {
    const content = await readAs(file, "text");
    return {
      attachment: { kind: "text", name: file.name, content: content.slice(0, maxTextChars) },
    };
  } catch {
    return { note: say.unreadable(file.name) };
  }
}

function readAs(file: File, as: "text" | "dataUrl"): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    if (as === "text") reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}
