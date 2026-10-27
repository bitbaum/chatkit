"use client";

import { useRef, useState, type ReactNode } from "react";
import { ATTACH_SOURCE_INPUT, type AttachSource } from "../attachments.js";
import { IconCamera, IconFileUp, IconImage, IconPaperclip } from "./icons.js";
import { Sheet, prefersSheet } from "./Sheet.js";

export type AttachMenuLabels = {
  /** The paperclip's name. */
  attach: string;
  /** The sheet's title. */
  title: string;
  close: string;
  sources: Record<AttachSource, string>;
};

export const DEFAULT_ATTACH_MENU_LABELS: AttachMenuLabels = {
  attach: "Attach a screenshot or file",
  title: "Add to message",
  close: "Close",
  sources: { camera: "Camera", photos: "Photos", files: "Files" },
};

/**
 * One of the app's own rows in the attach sheet, under Camera · Photos ·
 * Files: an icon, what it adds (`label`), an optional second line. Every row
 * has this one anatomy, so a product's "Your things" reads as part of the
 * same sheet, not a second menu. Picking a row closes the sheet first.
 */
export type AttachExtra = {
  id: string;
  label: string;
  detail?: string;
  icon?: ReactNode;
  onPick: () => void;
};

const SOURCES: readonly AttachSource[] = ["camera", "photos", "files"];
const ICONS: Record<AttachSource, () => React.JSX.Element> = {
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
export function AttachMenu({
  onFiles,
  disabled = false,
  labels = DEFAULT_ATTACH_MENU_LABELS,
  sources = SOURCES,
  trigger,
  extra,
  rows,
  onOpenChange,
}: {
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
  /** The app's rows as data — drawn with one anatomy (see `AttachExtra`).
   *  With them the sheet opens on every pointer; with no `sources` it holds
   *  only them. */
  rows?: readonly AttachExtra[];
  onOpenChange?: (open: boolean) => void;
}) {
  const inputs = useRef<Partial<Record<AttachSource, HTMLInputElement | null>>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const setOpen = (next: boolean) => {
    setSheetOpen(next);
    onOpenChange?.(next);
  };
  const close = () => setOpen(false);
  const pick = (source: AttachSource) => {
    close();
    inputs.current[source]?.click();
  };
  const hasRows = Boolean(extra) || (rows?.length ?? 0) > 0;
  const open = () => {
    if (hasRows || (sources.length > 1 && prefersSheet())) setOpen(true);
    // A mouse gets the broadest picker offered: Files when it is one of the
    // sources, else the last one (Photos, for an image uploader).
    else pick(sources.includes("files") ? "files" : sources[sources.length - 1]!);
  };

  return (
    <>
      {sources.map((source) => (
        <input
          key={source}
          ref={(el) => {
            inputs.current[source] = el;
          }}
          type="file"
          hidden
          multiple={source !== "camera"}
          data-ck-source={source}
          {...ATTACH_SOURCE_INPUT[source]}
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      ))}
      <button
        type="button"
        className={trigger ? "ck-attach-trigger" : "ck-icon-btn"}
        onClick={open}
        disabled={disabled}
        aria-label={labels.attach}
        aria-haspopup="dialog"
        title={labels.attach}
      >
        {trigger ?? <IconPaperclip />}
      </button>
      <Sheet open={sheetOpen} onClose={close} title={labels.title} closeLabel={labels.close}>
        {sources.length > 0 && (
          <div className="ck-attach-sources">
            {sources.map((source) => {
              const Icon = ICONS[source];
              return (
                <button
                  key={source}
                  type="button"
                  className="ck-attach-source"
                  data-ck-source={source}
                  onClick={() => pick(source)}
                >
                  <Icon />
                  <span>{labels.sources[source]}</span>
                </button>
              );
            })}
          </div>
        )}
        {hasRows && (
          <div className={sources.length > 0 ? "ck-sheet-extra" : "ck-sheet-extra ck-sheet-only"}>
            {rows?.map((row) => (
              <button
                key={row.id}
                type="button"
                className="ck-attach-extra"
                data-ck-extra={row.id}
                onClick={() => {
                  close();
                  row.onPick();
                }}
              >
                <span className="ck-attach-extra-icon" aria-hidden>
                  {row.icon ?? <IconPaperclip />}
                </span>
                <span className="ck-attach-extra-text">
                  <span className="ck-truncate">{row.label}</span>
                  {row.detail && <small className="ck-truncate">{row.detail}</small>}
                </span>
              </button>
            ))}
            {extra?.(close)}
          </div>
        )}
      </Sheet>
    </>
  );
}
