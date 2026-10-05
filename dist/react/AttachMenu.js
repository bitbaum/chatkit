"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ATTACH_SOURCE_INPUT } from "../attachments.js";
import { IconCamera, IconFileUp, IconImage, IconPaperclip, IconX } from "./icons.js";
export const DEFAULT_ATTACH_MENU_LABELS = {
    attach: "Attach a screenshot or file",
    title: "Add to message",
    close: "Close",
    sources: { camera: "Camera", photos: "Photos", files: "Files" },
};
const SOURCES = ["camera", "photos", "files"];
const ICONS = {
    camera: IconCamera,
    photos: IconImage,
    files: IconFileUp,
};
/** A touch screen gets the sheet; a mouse gets the file dialog in one click,
 *  because on a desktop Camera / Photos / Files are all the same dialog. */
function prefersSheet() {
    return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}
/**
 * The paperclip, and what it opens on a phone: a sheet with Camera, Photos and
 * Files — one input each. See `ATTACH_SOURCE_INPUT` for why three inputs and
 * not one: a single mixed-`accept` input is what made a phone offer a recorder
 * and no way to the screenshot.
 *
 * Every app that attaches anything gets this from the composer. An app with a
 * custom box renders `<AttachMenu>` itself rather than a bare file input.
 */
export function AttachMenu({ onFiles, disabled = false, labels = DEFAULT_ATTACH_MENU_LABELS, }) {
    const [open, setOpen] = useState(false);
    const inputs = useRef({});
    const sheet = useRef(null);
    const trigger = useRef(null);
    const pick = (source) => {
        setOpen(false);
        inputs.current[source]?.click();
    };
    useEffect(() => {
        if (!open)
            return;
        sheet.current?.querySelector(".ck-attach-source")?.focus();
        const onKey = (e) => {
            if (e.key === "Escape") {
                setOpen(false);
                trigger.current?.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);
    return (_jsxs(_Fragment, { children: [SOURCES.map((source) => (_jsx("input", { ref: (el) => {
                    inputs.current[source] = el;
                }, type: "file", hidden: true, multiple: source !== "camera", "data-ck-source": source, ...ATTACH_SOURCE_INPUT[source], onChange: (e) => {
                    onFiles(e.target.files);
                    e.target.value = "";
                } }, source))), _jsx("button", { ref: trigger, type: "button", className: "ck-icon-btn", onClick: () => (prefersSheet() ? setOpen(true) : pick("files")), disabled: disabled, "aria-label": labels.attach, "aria-haspopup": "dialog", "aria-expanded": open, title: labels.attach, children: _jsx(IconPaperclip, {}) }), open &&
                createPortal(_jsxs("div", { className: "ck-sheet-root", children: [_jsx("div", { className: "ck-sheet-scrim", onClick: () => setOpen(false), "aria-hidden": true }), _jsxs("div", { ref: sheet, className: "ck-sheet", role: "dialog", "aria-modal": "true", "aria-label": labels.title, children: [_jsxs("div", { className: "ck-sheet-head", children: [_jsx("span", { className: "ck-sheet-title", children: labels.title }), _jsx("button", { type: "button", className: "ck-icon-btn ck-sheet-close", onClick: () => setOpen(false), "aria-label": labels.close, title: labels.close, children: _jsx(IconX, {}) })] }), _jsx("div", { className: "ck-attach-sources", children: SOURCES.map((source) => {
                                        const Icon = ICONS[source];
                                        return (_jsxs("button", { type: "button", className: "ck-attach-source", "data-ck-source": source, onClick: () => pick(source), children: [_jsx(Icon, {}), _jsx("span", { children: labels.sources[source] })] }, source));
                                    }) })] })] }), document.body)] }));
}
//# sourceMappingURL=AttachMenu.js.map