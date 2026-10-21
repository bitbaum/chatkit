import { type ReactNode } from "react";
/**
 * A sheet from the bottom edge on a phone, a centred panel on a desktop: the
 * attach menu, the sources of an answer, anything a tap opens that is more
 * than a menu. A native `<dialog>` opened with `showModal()`: it renders in
 * the browser's top layer, so a composer inside a transformed or
 * overflow-clipped panel still gets a full sheet, and the browser supplies
 * Escape, the focus trap and focus restore.
 */
export declare function Sheet({ open, onClose, title, closeLabel, children, }: {
    open: boolean;
    onClose: () => void;
    title: string;
    closeLabel?: string;
    children: ReactNode;
}): import("react").JSX.Element;
/** A touch screen gets the sheet; a mouse gets the plainer thing (a file
 *  dialog, a row of chips) in one click. */
export declare function prefersSheet(): boolean;
//# sourceMappingURL=Sheet.d.ts.map