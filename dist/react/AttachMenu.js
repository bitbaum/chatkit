"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useState } from "react";
import { ATTACH_SOURCE_INPUT } from "../attachments.js";
import { IconCamera, IconFileUp, IconImage, IconPaperclip } from "./icons.js";
import { Sheet, prefersSheet } from "./Sheet.js";
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
 * custom box renders `<AttachMenu>` itself rather than a bare file input, and
 * an app with more to bring into a message than files — one of the person's
 * own things, a note the model reads every time — puts those rows in `extra`:
 * they sit under Camera · Photos · Files in the same sheet, on every pointer,
 * since a mouse cannot reach them through a file dialog.
 */
export function AttachMenu({ onFiles, disabled = false, labels = DEFAULT_ATTACH_MENU_LABELS, sources = SOURCES, trigger, extra, onOpenChange, }) {
    const inputs = useRef({});
    const [sheetOpen, setSheetOpen] = useState(false);
    const setOpen = (next) => {
        setSheetOpen(next);
        onOpenChange?.(next);
    };
    const close = () => setOpen(false);
    const pick = (source) => {
        close();
        inputs.current[source]?.click();
    };
    const open = () => {
        if (extra || (sources.length > 1 && prefersSheet()))
            setOpen(true);
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
                } }, source))), _jsx("button", { type: "button", className: trigger ? "ck-attach-trigger" : "ck-icon-btn", onClick: open, disabled: disabled, "aria-label": labels.attach, "aria-haspopup": "dialog", title: labels.attach, children: trigger ?? _jsx(IconPaperclip, {}) }), _jsxs(Sheet, { open: sheetOpen, onClose: close, title: labels.title, closeLabel: labels.close, children: [_jsx("div", { className: "ck-attach-sources", children: sources.map((source) => {
                            const Icon = ICONS[source];
                            return (_jsxs("button", { type: "button", className: "ck-attach-source", "data-ck-source": source, onClick: () => pick(source), children: [_jsx(Icon, {}), _jsx("span", { children: labels.sources[source] })] }, source));
                        }) }), extra && _jsx("div", { className: "ck-sheet-extra", children: extra(close) })] })] }));
}
//# sourceMappingURL=AttachMenu.js.map