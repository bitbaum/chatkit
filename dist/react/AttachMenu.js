"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef } from "react";
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
 * The sheet is a native `<dialog>` opened with `showModal()`: it renders in the
 * browser's top layer, so a composer inside a transformed or overflow-clipped
 * panel (a drawer, a floating rail) still gets a full-screen sheet — and the
 * browser supplies Escape, the focus trap and focus restore.
 *
 * Every app that attaches anything gets this from the composer. An app with a
 * custom box renders `<AttachMenu>` itself rather than a bare file input.
 */
export function AttachMenu({ onFiles, disabled = false, labels = DEFAULT_ATTACH_MENU_LABELS, sources = SOURCES, trigger, }) {
    const inputs = useRef({});
    const dialog = useRef(null);
    const close = () => dialog.current?.close();
    const pick = (source) => {
        close();
        inputs.current[source]?.click();
    };
    const open = () => {
        const d = dialog.current;
        if (sources.length > 1 && prefersSheet() && d && typeof d.showModal === "function")
            d.showModal();
        // A mouse gets the broadest picker offered: Files when it is one of the
        // sources, else the last one (Photos, for an image uploader).
        else
            pick(sources.includes("files") ? "files" : sources[sources.length - 1]);
    };
    return (_jsxs(_Fragment, { children: [sources.map((source) => (_jsx("input", { ref: (el) => {
                    inputs.current[source] = el;
                }, type: "file", hidden: true, multiple: source !== "camera", "data-ck-source": source, ...ATTACH_SOURCE_INPUT[source], onChange: (e) => {
                    onFiles(e.target.files);
                    e.target.value = "";
                } }, source))), _jsx("button", { type: "button", className: trigger ? "ck-attach-trigger" : "ck-icon-btn", onClick: open, disabled: disabled, "aria-label": labels.attach, "aria-haspopup": "dialog", title: labels.attach, children: trigger ?? _jsx(IconPaperclip, {}) }), _jsx("dialog", { ref: dialog, className: "ck-sheet", "aria-label": labels.title, 
                // A tap on the backdrop lands on the <dialog> itself, never on the
                // panel inside it: that is the scrim.
                onClick: (e) => {
                    if (e.target === e.currentTarget)
                        close();
                }, children: _jsxs("div", { className: "ck-sheet-panel", children: [_jsxs("div", { className: "ck-sheet-head", children: [_jsx("span", { className: "ck-sheet-title", children: labels.title }), _jsx("button", { type: "button", className: "ck-icon-btn ck-sheet-close", onClick: close, "aria-label": labels.close, title: labels.close, children: _jsx(IconX, {}) })] }), _jsx("div", { className: "ck-attach-sources", children: sources.map((source) => {
                                const Icon = ICONS[source];
                                return (_jsxs("button", { type: "button", className: "ck-attach-source", "data-ck-source": source, onClick: () => pick(source), children: [_jsx(Icon, {}), _jsx("span", { children: labels.sources[source] })] }, source));
                            }) })] }) })] }));
}
//# sourceMappingURL=AttachMenu.js.map