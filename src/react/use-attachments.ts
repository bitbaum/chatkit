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
  type AttachOptions,
  type AttachmentLimits,
  type AttachmentNotes,
  type AttachmentReader,
  type FileReadContext,
  type FileReadResult,
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
  options: AttachOptions = {},
  notes: Partial<AttachmentNotes> = {},
): AttachmentsController {
  const { readFile, ...given } = options;
  const lim: AttachmentLimits = { ...DEFAULT_ATTACHMENT_LIMITS, ...given };
  const { maxFiles, maxImageBytes, maxTextChars, maxImageEdge } = lim;
  // Mirrored in a ref so a new `notes` or `readFile` object every render does
  // not rebuild every callback below.
  const say = useRef<AttachmentNotes>(DEFAULT_ATTACHMENT_NOTES);
  const reader = useRef<AttachmentReader | undefined>(undefined);
  useEffect(() => {
    say.current = { ...DEFAULT_ATTACHMENT_NOTES, ...notes };
    reader.current = readFile;
  });
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const previews = useRef<Set<string>>(new Set());
  // The staged list, kept in a ref too: files are read one at a time and each
  // read must see what the one before it staged.
  const staged = useRef<StagedAttachment[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback((next: StagedAttachment[]) => {
    staged.current = next;
    setAttachments(next);
  }, []);

  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const add = useCallback(
    (item: StagedAttachment) => {
      const prev = staged.current;
      if (prev.length >= maxFiles) return;
      if (prev.some((p) => attachmentKey(p) === attachmentKey(item))) return;
      commit([...prev, item]);
    },
    [commit, maxFiles],
  );

  const stage = useCallback(
    async (file: File) => {
      const limits = { maxFiles, maxImageBytes, maxImageEdge, maxTextChars };
      const read = await readAttachmentFiles(file, limits, say.current, {
        preview: true,
        readFile: reader.current,
        images: staged.current.filter((a) => a.kind === "image").length,
        room: maxFiles - staged.current.length,
        progress: setNote,
      });
      setNote(read.note ?? null);
      for (const item of read.attachments) {
        if (item.previewUrl?.startsWith("blob:")) previews.current.add(item.previewUrl);
        add(item);
      }
    },
    [add, maxFiles, maxImageBytes, maxImageEdge, maxTextChars],
  );

  // One file at a time: a PDF that becomes pictures needs to know how many
  // pictures the files before it left room for.
  const enqueue = useCallback(
    (file: File) => {
      queue.current = queue.current.then(() => stage(file)).catch(() => undefined);
    },
    [stage],
  );

  const addFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      setNote(null);
      if (maxFiles - staged.current.length <= 0) {
        setNote(say.current.tooMany(maxFiles));
        return;
      }
      for (const file of Array.from(files)) enqueue(file);
    },
    [enqueue, maxFiles],
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
        if (file) enqueue(file);
      }
      return true;
    },
    [enqueue],
  );

  const revoke = (a: StagedAttachment) => {
    if (!a.previewUrl) return;
    URL.revokeObjectURL(a.previewUrl);
    previews.current.delete(a.previewUrl);
  };

  const remove = useCallback(
    (key: string) => {
      const target = staged.current.find((a) => attachmentKey(a) === key);
      if (target) revoke(target);
      commit(staged.current.filter((a) => attachmentKey(a) !== key));
    },
    [commit],
  );

  const clear = useCallback(() => {
    staged.current.forEach(revoke);
    commit([]);
    setNote(null);
  }, [commit]);

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

/**
 * `readAttachmentFile`, with the app's own reader first. The reader may turn
 * one file into several attachments (a PDF of slide pictures) or into text, or
 * decline with `undefined`, in which case chatkit's reader decides. A reader
 * that throws gives the "could not read" note, never an exception.
 */
export async function readAttachmentFiles(
  file: File,
  limits: Partial<AttachmentLimits> = {},
  notes: Partial<AttachmentNotes> = {},
  options: {
    preview?: boolean;
    readFile?: AttachmentReader;
    images?: number;
    room?: number;
    progress?: (note: string) => void;
  } = {},
): Promise<FileReadResult> {
  const full: AttachmentLimits = { ...DEFAULT_ATTACHMENT_LIMITS, ...limits };
  const say = { ...DEFAULT_ATTACHMENT_NOTES, ...notes };
  if (options.readFile) {
    const ctx: FileReadContext = {
      limits: full,
      notes: say,
      images: options.images ?? 0,
      room: options.room ?? full.maxFiles,
      progress: options.progress ?? (() => undefined),
    };
    try {
      const mine = await options.readFile(file, ctx);
      if (mine) {
        return {
          attachments: mine.attachments.slice(0, Math.max(0, ctx.room)),
          ...(mine.note ? { note: mine.note } : {}),
        };
      }
    } catch {
      return { attachments: [], note: say.unreadable(file.name) };
    }
  }
  const one = await readAttachmentFile(file, full, say, { preview: options.preview });
  return one.note !== undefined
    ? { attachments: [], note: one.note }
    : { attachments: [one.attachment] };
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
