"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_ATTACHMENT_POLICY,
  attachmentKind,
  checkAttachment,
  type AttachmentKind,
  type AttachmentPolicy,
} from "../thread-rules.js";
import { fitWithin } from "../attachments.js";
import { newId } from "../conversations.js";
import { shrinkImage } from "../image.js";
import {
  refusalText,
  type MessengerAttachment,
  type MessengerRefusalLabels,
  type MessengerTransport,
  type MessengerUpload,
} from "../messenger.js";

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

export const DEFAULT_UPLOAD_OPTIONS: Required<Omit<UploadOptions, "policy">> = {
  imageMaxEdge: 2048,
  imageMaxBytes: 1_500_000,
};

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

/** Pictures a canvas re-encodes without losing what they are. An animated
 *  GIF would lose its animation, so it is sent as it is. */
const SHRINKABLE = /^image\/(jpeg|jpg|png|webp|heic|heif|bmp|tiff|avif)$/i;
const POSTER_EDGE = 640;
const PROBE_TIMEOUT_MS = 4_000;

type Prepared = {
  blob: Blob;
  about: MessengerUpload;
  previewUrl?: string;
};

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const comma = dataUrl.indexOf(",");
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? "application/octet-stream";
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function imageSize(blob: Blob): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

function renamed(name: string, extension: string): string {
  const dot = name.lastIndexOf(".");
  return `${dot > 0 ? name.slice(0, dot) : name}.${extension}`;
}

/**
 * A film's size, length and first frame, read in the browser. Best effort:
 * a codec the browser cannot open still uploads, as a file tile with no
 * poster, and never holds the send up for longer than the timeout.
 */
function probeVideo(
  blob: Blob,
): Promise<{ width?: number; height?: number; durationMs?: number; poster?: Blob }> {
  if (typeof document === "undefined") return Promise.resolve({});
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    let settled = false;
    const finish = (value: {
      width?: number;
      height?: number;
      durationMs?: number;
      poster?: Blob;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const facts = () => ({
      width: video.videoWidth || undefined,
      height: video.videoHeight || undefined,
      durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined,
    });
    const timer = setTimeout(() => finish(video.videoWidth ? facts() : {}), PROBE_TIMEOUT_MS);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onerror = () => finish({});
    video.onloadeddata = () => {
      // A frame a little way in: the very first one is often black.
      const at = Number.isFinite(video.duration) ? Math.min(0.5, video.duration / 2) : 0;
      if (at > 0) video.currentTime = at;
      else draw();
    };
    video.onseeked = () => draw();
    const draw = () => {
      const known = facts();
      if (!known.width || !known.height) return finish(known);
      const size = fitWithin(known.width, known.height, POSTER_EDGE);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return finish(known);
      try {
        ctx.drawImage(video, 0, 0, size.width, size.height);
        canvas.toBlob(
          (poster) => finish({ ...known, poster: poster ?? undefined }),
          "image/jpeg",
          0.7,
        );
      } catch {
        finish(known);
      }
    };
    video.src = url;
  });
}

function probeAudio(blob: Blob): Promise<number | undefined> {
  if (typeof document === "undefined") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = document.createElement("audio");
    const finish = (ms?: number) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    const timer = setTimeout(() => finish(), PROBE_TIMEOUT_MS);
    audio.preload = "metadata";
    audio.onloadedmetadata = () =>
      finish(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : undefined);
    audio.onerror = () => finish();
    audio.src = url;
  });
}

/**
 * Files on their way to a message: checked against the policy before a byte
 * moves, photos shrunk in the browser, each uploaded through the app's
 * `transport.upload` with its progress shown, a failure kept with Try again.
 * The same rule that refuses a file here refuses it on the server
 * (`@bitbaum/threadkit` `checkAttachment`), so the two cannot disagree.
 */
export function useUploads({
  transport,
  conversationId,
  options = {},
  labels,
  failedText,
}: {
  transport: MessengerTransport;
  conversationId: string | null;
  options?: UploadOptions;
  labels: MessengerRefusalLabels;
  /** "{name} could not be uploaded." */
  failedText: string;
}): UploadsController {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const live = useRef({ transport, conversationId, options, labels, failedText });
  useEffect(() => {
    live.current = { transport, conversationId, options, labels, failedText };
  });

  // What an item needs to be sent again, and how to stop it.
  const work = useRef(new Map<string, { prepared?: Prepared; abort: AbortController }>());
  const previews = useRef(new Set<string>());
  const itemsRef = useRef<UploadItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const used = useRef<Promise<number | undefined> | null>(null);

  const patch = useCallback((key: string, change: Partial<UploadItem>) => {
    setItems((current) => current.map((i) => (i.key === key ? { ...i, ...change } : i)));
  }, []);

  const drop = useCallback((key: string) => {
    const entry = work.current.get(key);
    entry?.abort.abort();
    work.current.delete(key);
    setItems((current) => {
      const gone = current.find((i) => i.key === key);
      if (gone?.previewUrl) {
        URL.revokeObjectURL(gone.previewUrl);
        previews.current.delete(gone.previewUrl);
      }
      return current.filter((i) => i.key !== key);
    });
  }, []);

  const upload = useCallback(
    async (key: string, prepared: Prepared) => {
      const { transport: t } = live.current;
      const entry = work.current.get(key);
      if (!t.upload || !entry) return;
      patch(key, { state: "uploading", progress: 0 });
      try {
        const attachment = await t.upload(prepared.blob, prepared.about, {
          signal: entry.abort.signal,
          progress: (fraction) => patch(key, { progress: Math.max(0, Math.min(1, fraction)) }),
        });
        if (entry.abort.signal.aborted) return;
        patch(key, { state: "done", progress: 1, attachment });
      } catch {
        if (entry.abort.signal.aborted) return;
        patch(key, { state: "failed" });
        setNote(live.current.failedText.replace("{name}", prepared.about.name));
      }
    },
    [patch],
  );

  const prepare = useCallback(async (file: File, key: string): Promise<Prepared | string> => {
    const { options: o, labels: l, conversationId: id, transport: t } = live.current;
    const policy = o.policy ?? DEFAULT_ATTACHMENT_POLICY;
    const edge = o.imageMaxEdge ?? DEFAULT_UPLOAD_OPTIONS.imageMaxEdge;
    const cap = o.imageMaxBytes ?? DEFAULT_UPLOAD_OPTIONS.imageMaxBytes;
    if (!id) return l.type.replace("{name}", file.name);

    let blob: Blob = file;
    let name = file.name || "file";
    let mimeType = file.type;
    let width: number | undefined;
    let height: number | undefined;

    if (SHRINKABLE.test(mimeType) && edge > 0) {
      const size = await imageSize(file);
      const accepted = attachmentKind(mimeType, policy) === "image";
      const tooBig = file.size > cap || (size && Math.max(size.width, size.height) > edge);
      if (tooBig || !accepted) {
        // Shrunk, and in passing turned into a JPEG every browser shows
        // (a phone's HEIC is opened by Safari and by nothing else).
        const dataUrl = await shrinkImage(file, edge, cap).catch(() => null);
        if (dataUrl) {
          blob = await dataUrlToBlob(dataUrl);
          mimeType = "image/jpeg";
          name = renamed(name, "jpg");
          const fitted = size ? fitWithin(size.width, size.height, edge) : null;
          width = fitted?.width;
          height = fitted?.height;
        }
      }
      if (width === undefined && size) {
        width = size.width;
        height = size.height;
      }
    }

    if (used.current === null) {
      used.current = t.usage
        ? t.usage().then(
            (u) => u.usedBytes,
            () => undefined,
          )
        : Promise.resolve(undefined);
    }
    const usedBytes = await used.current;
    const others = itemsRef.current.filter((i) => i.key !== key && i.state !== "failed");
    const check = checkAttachment(
      { mimeType, bytes: blob.size },
      {
        onMessage: others.length,
        usedBytes:
          usedBytes === undefined
            ? undefined
            : usedBytes + others.reduce((sum, i) => sum + i.bytes, 0),
      },
      // No quota is checked in the browser when the app cannot say what is
      // used; the server still decides.
      usedBytes === undefined ? { ...policy, quotaBytes: null } : policy,
    );
    if (!check.ok) return refusalText(check, name, l);

    const about: MessengerUpload = {
      conversationId: id,
      kind: check.kind,
      name,
      mimeType,
      bytes: blob.size,
      width,
      height,
    };
    let previewUrl: string | undefined;
    if (check.kind === "image") {
      if (width === undefined) {
        const size = await imageSize(blob);
        about.width = size?.width;
        about.height = size?.height;
      }
      previewUrl = URL.createObjectURL(blob);
    } else if (check.kind === "video") {
      const probed = await probeVideo(blob);
      about.width = probed.width;
      about.height = probed.height;
      about.durationMs = probed.durationMs;
      about.poster = probed.poster;
      if (probed.poster) previewUrl = URL.createObjectURL(probed.poster);
    } else if (check.kind === "audio") {
      about.durationMs = await probeAudio(blob);
    }
    if (previewUrl) previews.current.add(previewUrl);
    return { blob, about, previewUrl };
  }, []);

  const add = useCallback(
    (files: readonly File[]) => {
      if (!live.current.transport.upload) return;
      setNote(null);
      for (const file of files) {
        const key = newId("u");
        const abort = new AbortController();
        work.current.set(key, { abort });
        const placeholder: UploadItem = {
          key,
          name: file.name || "file",
          // A first guess, so the tile has a shape while the file is read.
          kind: file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("video/")
              ? "video"
              : file.type.startsWith("audio/")
                ? "audio"
                : "file",
          bytes: file.size,
          progress: 0,
          state: "preparing",
        };
        itemsRef.current = [...itemsRef.current, placeholder];
        setItems((current) => [...current, placeholder]);
        void prepare(file, key).then(
          (prepared) => {
            if (abort.signal.aborted) {
              if (typeof prepared !== "string" && prepared.previewUrl) {
                URL.revokeObjectURL(prepared.previewUrl);
                previews.current.delete(prepared.previewUrl);
              }
              return;
            }
            if (typeof prepared === "string") {
              setNote(prepared);
              drop(key);
              return;
            }
            const entry = work.current.get(key);
            if (entry) entry.prepared = prepared;
            patch(key, {
              name: prepared.about.name,
              kind: prepared.about.kind,
              bytes: prepared.about.bytes,
              previewUrl: prepared.previewUrl,
            });
            void upload(key, prepared);
          },
          () => {
            if (abort.signal.aborted) return;
            setNote(live.current.failedText.replace("{name}", file.name || "file"));
            drop(key);
          },
        );
      }
    },
    [drop, patch, prepare, upload],
  );

  const retry = useCallback(
    (key: string) => {
      const entry = work.current.get(key);
      if (!entry?.prepared) return;
      entry.abort = new AbortController();
      setNote(null);
      void upload(key, entry.prepared);
    },
    [upload],
  );

  const clear = useCallback(() => {
    for (const entry of work.current.values()) entry.abort.abort();
    work.current.clear();
    for (const url of previews.current) URL.revokeObjectURL(url);
    previews.current.clear();
    itemsRef.current = [];
    setItems([]);
  }, []);

  // Staged files belong to the conversation they were picked in.
  useEffect(() => {
    return () => clear();
  }, [conversationId, clear]);

  return {
    items,
    note,
    clearNote: useCallback(() => setNote(null), []),
    add,
    remove: drop,
    retry,
    clear,
    attachments: items.flatMap((i) => (i.state === "done" && i.attachment ? [i.attachment] : [])),
    busy: items.some((i) => i.state === "preparing" || i.state === "uploading"),
  };
}
