"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { IconX } from "./icons.js";
/**
 * A sheet from the bottom edge on a phone, a centred panel on a desktop: the
 * attach menu, the sources of an answer, anything a tap opens that is more
 * than a menu. A native `<dialog>` opened with `showModal()`: it renders in
 * the browser's top layer, so a composer inside a transformed or
 * overflow-clipped panel still gets a full sheet, and the browser supplies
 * Escape, the focus trap and focus restore.
 */
export function Sheet({ open, onClose, title, closeLabel = "Close", children, }) {
    const ref = useRef(null);
    useEffect(() => {
        const d = ref.current;
        if (!d)
            return;
        if (open && !d.open && typeof d.showModal === "function")
            d.showModal();
        else if (!open && d.open)
            d.close();
    }, [open]);
    return (_jsx("dialog", { ref: ref, className: "ck-sheet", "aria-label": title, onClose: onClose, 
        // A tap on the backdrop lands on the <dialog> itself, never on the
        // panel inside it: that is the scrim.
        onClick: (e) => {
            if (e.target === e.currentTarget)
                onClose();
        }, children: _jsxs("div", { className: "ck-sheet-panel", children: [_jsxs("div", { className: "ck-sheet-head", children: [_jsx("span", { className: "ck-sheet-title", children: title }), _jsx("button", { type: "button", className: "ck-icon-btn ck-sheet-close", onClick: onClose, "aria-label": closeLabel, title: closeLabel, children: _jsx(IconX, {}) })] }), children] }) }));
}
/** A touch screen gets the sheet; a mouse gets the plainer thing (a file
 *  dialog, a row of chips) in one click. */
export function prefersSheet() {
    return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}
//# sourceMappingURL=Sheet.js.map