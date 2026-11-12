"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { fitMedia, formatBytes, formatDuration, type MessengerAttachment } from "../messenger.js";
import {
  IconArrowLeft,
  IconChevron,
  IconDownload,
  IconFile,
  IconPlay,
  IconVideo,
  IconX,
} from "./icons.js";
import type { MessengerLabels } from "./messenger-labels.js";

/**
 * A face in the Messenger. A person is a circle, an agent a rounded square:
 * the shape says which before any word is read. Without a picture, a person
 * is their initials and an agent is `fallback` (the product's own mark, or
 * the package's).
 */
export function MessengerAvatar({
  name,
  src,
  agent = false,
  size = "md",
  online,
  fallback,
}: {
  name: string;
  src?: string | null;
  agent?: boolean;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  fallback?: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span
      className={`ck-msgr-avatar ck-msgr-avatar-${size}${agent ? " ck-msgr-avatar-agent" : ""}`}
      aria-hidden="true"
    >
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        (fallback ?? initials)
      )}
      {online && <span className="ck-msgr-online" />}
    </span>
  );
}

/** How wide and tall a single picture may be drawn in a thread, in CSS pixels. */
const ONE_MAX = { width: 288, height: 360 };

function MediaTile({
  attachment,
  onOpen,
  labels,
  alone,
  more,
}: {
  attachment: MessengerAttachment;
  onOpen: () => void;
  labels: MessengerLabels;
  alone: boolean;
  /** "+3" over the last tile when there are more than fit. */
  more?: number;
}) {
  const [gone, setGone] = useState(false);
  const video = attachment.kind === "video";
  const picture = video ? attachment.posterUrl : attachment.url;
  const size = alone
    ? fitMedia(attachment.width, attachment.height, ONE_MAX.width, ONE_MAX.height)
    : null;
  return (
    <button
      type="button"
      className={`ck-msgr-media${alone ? " ck-msgr-media-one" : ""}`}
      style={
        size ? { width: size.width, aspectRatio: `${size.width} / ${size.height}` } : undefined
      }
      onClick={onOpen}
      aria-label={video ? labels.playVideo : labels.open.replace("{name}", attachment.name)}
    >
      {picture && !gone ? (
        <img
          src={picture}
          alt=""
          loading="lazy"
          decoding="async"
          width={size?.width}
          height={size?.height}
          onError={() => setGone(true)}
        />
      ) : (
        <span className="ck-msgr-media-blank">{video ? <IconVideo /> : <IconFile />}</span>
      )}
      {video && (
        <>
          <span className="ck-msgr-play">
            <IconPlay />
          </span>
          {attachment.durationMs !== undefined && (
            <span className="ck-msgr-duration">{formatDuration(attachment.durationMs)}</span>
          )}
        </>
      )}
      {more !== undefined && more > 0 && <span className="ck-msgr-more-media">+{more}</span>}
    </button>
  );
}

function FileRow({
  attachment,
  labels,
}: {
  attachment: MessengerAttachment;
  labels: MessengerLabels;
}) {
  return (
    <a
      className="ck-msgr-file"
      href={attachment.downloadUrl ?? attachment.url}
      // Never opened in place: a file from storage is not the app's page.
      download={attachment.name}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${labels.download}: ${attachment.name}`}
    >
      <span className="ck-msgr-file-icon">
        <IconFile />
      </span>
      <span className="ck-msgr-file-text">
        <span className="ck-truncate">{attachment.name}</span>
        <small>{formatBytes(attachment.bytes)}</small>
      </span>
      <span className="ck-msgr-file-get">
        <IconDownload />
      </span>
    </a>
  );
}

/** At most this many pictures are drawn on a message; the rest are "+n". */
const GRID_MAX = 4;

/**
 * What was sent with a message: pictures and films as tiles (one large, more
 * as a grid) that open in the viewer, a recording as a player, anything else
 * as a row that downloads. A film is drawn as its still and loads nothing
 * until it is opened.
 */
export function MessageAttachments({
  attachments,
  labels,
  caption,
}: {
  attachments: readonly MessengerAttachment[];
  labels: MessengerLabels;
  /** Shown in the viewer under the picture: who sent it, and when. */
  caption?: string;
}) {
  const media = attachments.filter((a) => a.kind === "image" || a.kind === "video");
  const audio = attachments.filter((a) => a.kind === "audio");
  const files = attachments.filter((a) => a.kind === "file");
  const [viewing, setViewing] = useState<number | null>(null);
  const shown = media.slice(0, GRID_MAX);
  return (
    <div className="ck-msgr-attachments">
      {media.length > 0 && (
        <div
          className={media.length === 1 ? "ck-msgr-grid ck-msgr-grid-one" : "ck-msgr-grid"}
          data-count={Math.min(media.length, GRID_MAX)}
        >
          {shown.map((a, i) => (
            <MediaTile
              key={a.id}
              attachment={a}
              labels={labels}
              alone={media.length === 1}
              onOpen={() => setViewing(i)}
              more={i === GRID_MAX - 1 ? media.length - GRID_MAX : undefined}
            />
          ))}
        </div>
      )}
      {audio.map((a) => (
        <audio
          key={a.id}
          className="ck-msgr-audio"
          controls
          preload="none"
          src={a.url}
          aria-label={a.name}
        />
      ))}
      {files.map((a) => (
        <FileRow key={a.id} attachment={a} labels={labels} />
      ))}
      {viewing !== null && media[viewing] && (
        <MediaViewer
          media={media}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          labels={labels}
          caption={caption}
        />
      )}
    </div>
  );
}

/**
 * A picture or a film, the whole screen. A native `<dialog>`: Escape, the
 * focus trap and focus coming back to the tile are the browser's. Left and
 * right move through what the message carried.
 */
export function MediaViewer({
  media,
  index,
  onIndex,
  onClose,
  labels,
  caption,
}: {
  media: readonly MessengerAttachment[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  labels: MessengerLabels;
  caption?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open && typeof d.showModal === "function") d.showModal();
  }, []);
  useEffect(() => setFailed(false), [index]);
  const current = media[index]!;
  const many = media.length > 1;
  const step = (by: number) => onIndex((index + by + media.length) % media.length);
  return (
    <dialog
      ref={ref}
      className="ck-msgr-viewer"
      aria-label={labels.viewer}
      onClose={onClose}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowLeft") step(-1);
        else if (e.key === "ArrowRight") step(1);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ck-msgr-viewer-bar">
        <button
          type="button"
          className="ck-msgr-viewer-btn"
          onClick={onClose}
          aria-label={labels.close}
          title={labels.close}
        >
          <IconX />
        </button>
        <span className="ck-msgr-viewer-title">
          <span className="ck-truncate">{caption ?? current.name}</span>
          {many && (
            <small>
              {labels.position
                .replace("{i}", String(index + 1))
                .replace("{n}", String(media.length))}
            </small>
          )}
        </span>
        <a
          className="ck-msgr-viewer-btn"
          href={current.downloadUrl ?? current.url}
          download={current.name}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={labels.download}
          title={labels.download}
        >
          <IconDownload />
        </a>
      </div>
      <div
        className="ck-msgr-viewer-stage"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {failed ? (
          <p className="ck-msgr-viewer-gone" role="status">
            {labels.unavailable}
          </p>
        ) : current.kind === "video" ? (
          <video
            key={current.id}
            src={current.url}
            poster={current.posterUrl}
            controls
            autoPlay
            playsInline
            onError={() => setFailed(true)}
          />
        ) : (
          <img
            key={current.id}
            src={current.url}
            alt={current.name}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {many && (
        <>
          <button
            type="button"
            className="ck-msgr-viewer-btn ck-msgr-viewer-prev"
            onClick={() => step(-1)}
            aria-label={labels.previous}
            title={labels.previous}
          >
            <IconArrowLeft />
          </button>
          <button
            type="button"
            className="ck-msgr-viewer-btn ck-msgr-viewer-next"
            onClick={() => step(1)}
            aria-label={labels.next}
            title={labels.next}
          >
            <IconChevron />
          </button>
        </>
      )}
    </dialog>
  );
}
