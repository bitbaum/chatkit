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
 * Every app that attaches anything gets this from the composer. An app with a
 * custom box renders `<AttachMenu>` itself rather than a bare file input.
 */
export declare function AttachMenu({ onFiles, disabled, labels, }: {
    onFiles: (files: FileList | null) => void;
    disabled?: boolean;
    labels?: AttachMenuLabels;
}): import("react").JSX.Element;
//# sourceMappingURL=AttachMenu.d.ts.map