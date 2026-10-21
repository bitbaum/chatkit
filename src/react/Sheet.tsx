"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconX } from "./icons.js";

/**
 * A sheet from the bottom edge on a phone, a centred panel on a desktop: the
 * attach menu, the sources of an answer, anything a tap opens that is more
 * than a menu. A native `<dialog>` opened with `showModal()`: it renders in
 * the browser's top layer, so a composer inside a transformed or
 * overflow-clipped panel still gets a full sheet, and the browser supplies
 * Escape, the focus trap and focus restore.
 */
export function Sheet({
  open,
  onClose,
  title,
  closeLabel = "Close",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open && typeof d.showModal === "function") d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="ck-sheet"
      aria-label={title}
      onClose={onClose}
      // A tap on the backdrop lands on the <dialog> itself, never on the
      // panel inside it: that is the scrim.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ck-sheet-panel">
        <div className="ck-sheet-head">
          <span className="ck-sheet-title">{title}</span>
          <button
            type="button"
            className="ck-icon-btn ck-sheet-close"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
          >
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** A touch screen gets the sheet; a mouse gets the plainer thing (a file
 *  dialog, a row of chips) in one click. */
export function prefersSheet(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}
