"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { fitMedia, formatBytes, formatDuration } from "../messenger.js";
import { IconArrowLeft, IconChevron, IconDownload, IconFile, IconPlay, IconVideo, IconX, } from "./icons.js";
/**
 * A face in the Messenger. A person is a circle, an agent a rounded square:
 * the shape says which before any word is read. Without a picture, a person
 * is their initials and an agent is `fallback` (the product's own mark, or
 * the package's).
 */
export function MessengerAvatar({ name, src, agent = false, size = "md", online, fallback, }) {
    const [broken, setBroken] = useState(false);
    useEffect(() => setBroken(false), [src]);
    const initials = name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => Array.from(word)[0] ?? "")
        .join("")
        .toUpperCase();
    return (_jsxs("span", { className: `ck-msgr-avatar ck-msgr-avatar-${size}${agent ? " ck-msgr-avatar-agent" : ""}`, "aria-hidden": "true", children: [src && !broken ? (_jsx("img", { src: src, alt: "", loading: "lazy", decoding: "async", onError: () => setBroken(true) })) : ((fallback ?? initials)), online && _jsx("span", { className: "ck-msgr-online" })] }));
}
/** How wide and tall a single picture may be drawn in a thread, in CSS pixels. */
const ONE_MAX = { width: 288, height: 360 };
function MediaTile({ attachment, onOpen, labels, alone, more, }) {
    const [gone, setGone] = useState(false);
    const video = attachment.kind === "video";
    const picture = video ? attachment.posterUrl : attachment.url;
    const size = alone
        ? fitMedia(attachment.width, attachment.height, ONE_MAX.width, ONE_MAX.height)
        : null;
    return (_jsxs("button", { type: "button", className: `ck-msgr-media${alone ? " ck-msgr-media-one" : ""}`, style: size ? { width: size.width, aspectRatio: `${size.width} / ${size.height}` } : undefined, onClick: onOpen, "aria-label": video ? labels.playVideo : labels.open.replace("{name}", attachment.name), children: [picture && !gone ? (_jsx("img", { src: picture, alt: "", loading: "lazy", decoding: "async", width: size?.width, height: size?.height, onError: () => setGone(true) })) : (_jsx("span", { className: "ck-msgr-media-blank", children: video ? _jsx(IconVideo, {}) : _jsx(IconFile, {}) })), video && (_jsxs(_Fragment, { children: [_jsx("span", { className: "ck-msgr-play", children: _jsx(IconPlay, {}) }), attachment.durationMs !== undefined && (_jsx("span", { className: "ck-msgr-duration", children: formatDuration(attachment.durationMs) }))] })), more !== undefined && more > 0 && _jsxs("span", { className: "ck-msgr-more-media", children: ["+", more] })] }));
}
function FileRow({ attachment, labels, }) {
    return (_jsxs("a", { className: "ck-msgr-file", href: attachment.downloadUrl ?? attachment.url, 
        // Never opened in place: a file from storage is not the app's page.
        download: attachment.name, target: "_blank", rel: "noopener noreferrer", "aria-label": `${labels.download}: ${attachment.name}`, children: [_jsx("span", { className: "ck-msgr-file-icon", children: _jsx(IconFile, {}) }), _jsxs("span", { className: "ck-msgr-file-text", children: [_jsx("span", { className: "ck-truncate", children: attachment.name }), _jsx("small", { children: formatBytes(attachment.bytes) })] }), _jsx("span", { className: "ck-msgr-file-get", children: _jsx(IconDownload, {}) })] }));
}
/** At most this many pictures are drawn on a message; the rest are "+n". */
const GRID_MAX = 4;
/**
 * What was sent with a message: pictures and films as tiles (one large, more
 * as a grid) that open in the viewer, a recording as a player, anything else
 * as a row that downloads. A film is drawn as its still and loads nothing
 * until it is opened.
 */
export function MessageAttachments({ attachments, labels, caption, }) {
    const media = attachments.filter((a) => a.kind === "image" || a.kind === "video");
    const audio = attachments.filter((a) => a.kind === "audio");
    const files = attachments.filter((a) => a.kind === "file");
    const [viewing, setViewing] = useState(null);
    const shown = media.slice(0, GRID_MAX);
    return (_jsxs("div", { className: "ck-msgr-attachments", children: [media.length > 0 && (_jsx("div", { className: media.length === 1 ? "ck-msgr-grid ck-msgr-grid-one" : "ck-msgr-grid", "data-count": Math.min(media.length, GRID_MAX), children: shown.map((a, i) => (_jsx(MediaTile, { attachment: a, labels: labels, alone: media.length === 1, onOpen: () => setViewing(i), more: i === GRID_MAX - 1 ? media.length - GRID_MAX : undefined }, a.id))) })), audio.map((a) => (_jsx("audio", { className: "ck-msgr-audio", controls: true, preload: "none", src: a.url, "aria-label": a.name }, a.id))), files.map((a) => (_jsx(FileRow, { attachment: a, labels: labels }, a.id))), viewing !== null && media[viewing] && (_jsx(MediaViewer, { media: media, index: viewing, onIndex: setViewing, onClose: () => setViewing(null), labels: labels, caption: caption }))] }));
}
/**
 * A picture or a film, the whole screen. A native `<dialog>`: Escape, the
 * focus trap and focus coming back to the tile are the browser's. Left and
 * right move through what the message carried.
 */
export function MediaViewer({ media, index, onIndex, onClose, labels, caption, }) {
    const ref = useRef(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const d = ref.current;
        if (d && !d.open && typeof d.showModal === "function")
            d.showModal();
    }, []);
    useEffect(() => setFailed(false), [index]);
    const current = media[index];
    const many = media.length > 1;
    const step = (by) => onIndex((index + by + media.length) % media.length);
    return (_jsxs("dialog", { ref: ref, className: "ck-msgr-viewer", "aria-label": labels.viewer, onClose: onClose, onKeyDown: (e) => {
            if (!many)
                return;
            if (e.key === "ArrowLeft")
                step(-1);
            else if (e.key === "ArrowRight")
                step(1);
        }, onClick: (e) => {
            if (e.target === e.currentTarget)
                onClose();
        }, children: [_jsxs("div", { className: "ck-msgr-viewer-bar", children: [_jsx("button", { type: "button", className: "ck-msgr-viewer-btn", onClick: onClose, "aria-label": labels.close, title: labels.close, children: _jsx(IconX, {}) }), _jsxs("span", { className: "ck-msgr-viewer-title", children: [_jsx("span", { className: "ck-truncate", children: caption ?? current.name }), many && (_jsx("small", { children: labels.position
                                    .replace("{i}", String(index + 1))
                                    .replace("{n}", String(media.length)) }))] }), _jsx("a", { className: "ck-msgr-viewer-btn", href: current.downloadUrl ?? current.url, download: current.name, target: "_blank", rel: "noopener noreferrer", "aria-label": labels.download, title: labels.download, children: _jsx(IconDownload, {}) })] }), _jsx("div", { className: "ck-msgr-viewer-stage", onClick: (e) => {
                    if (e.target === e.currentTarget)
                        onClose();
                }, children: failed ? (_jsx("p", { className: "ck-msgr-viewer-gone", role: "status", children: labels.unavailable })) : current.kind === "video" ? (_jsx("video", { src: current.url, poster: current.posterUrl, controls: true, autoPlay: true, playsInline: true, onError: () => setFailed(true) }, current.id)) : (_jsx("img", { src: current.url, alt: current.name, onError: () => setFailed(true) }, current.id)) }), many && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "ck-msgr-viewer-btn ck-msgr-viewer-prev", onClick: () => step(-1), "aria-label": labels.previous, title: labels.previous, children: _jsx(IconArrowLeft, {}) }), _jsx("button", { type: "button", className: "ck-msgr-viewer-btn ck-msgr-viewer-next", onClick: () => step(1), "aria-label": labels.next, title: labels.next, children: _jsx(IconChevron, {}) })] }))] }));
}
//# sourceMappingURL=MessageAttachments.js.map