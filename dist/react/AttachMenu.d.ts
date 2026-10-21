import { type ReactNode } from "react";
import { type AttachSource } from "../attachments.js";
export type AttachMenuLabels = {
    /** The paperclip's name. */
    attach: string;
    /** The sheet's title. */
    title: string;
    close: string;
    sources: Record<AttachSource, string>;
};
export declare const DEFAULT_ATTACH_MENU_LABELS: AttachMenuLabels;
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
export declare function AttachMenu({ onFiles, disabled, labels, sources, trigger, extra, onOpenChange, }: {
    onFiles: (files: FileList | null) => void;
    disabled?: boolean;
    labels?: AttachMenuLabels;
    /** Which sources to offer, in order. An avatar or product-photo uploader
     *  passes `["camera", "photos"]`; one source skips the sheet entirely. */
    sources?: readonly AttachSource[];
    /** The button's content. Defaults to a paperclip icon; an uploader passes
     *  its own ("Add photo"). The button keeps chatkit's 44px target. */
    trigger?: ReactNode;
    /** The app's own rows under the three sources (see above). With it the
     *  sheet opens on every pointer. A row that should close the sheet calls
     *  the `close` it is given. */
    extra?: (close: () => void) => ReactNode;
    onOpenChange?: (open: boolean) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=AttachMenu.d.ts.map