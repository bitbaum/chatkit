"use client";

import { useRef } from "react";
import { ATTACH_SOURCE_INPUT, type AttachSource } from "../attachments.js";
import { IconCamera, IconFileUp, IconImage, IconPaperclip, IconX } from "./icons.js";

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

const SOURCES: readonly AttachSource[] = ["camera", "photos", "files"];
const ICONS: Record<AttachSource, () => React.JSX.Element> = {
  camera: IconCamera,
  photos: IconImage,
  files: IconFileUp,
};

/** A touch screen gets the sheet; a mouse gets the file dialog in one click,
 *  because on a desktop Camera / Photos / Files are all the same dialog. */
function prefersSheet(): boolean {
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
export function AttachMenu({
  onFiles,
  disabled = false,
  labels = DEFAULT_ATTACH_MENU_LABELS,
}: {
  onFiles: (files: FileList | null) => void;
  disabled?: boolean;
  labels?: AttachMenuLabels;
}) {
  const inputs = useRef<Partial<Record<AttachSource, HTMLInputElement | null>>>({});
  const dialog = useRef<HTMLDialogElement>(null);

  const close = () => dialog.current?.close();
  const pick = (source: AttachSource) => {
    close();
    inputs.current[source]?.click();
  };
  const open = () => {
    const d = dialog.current;
    if (prefersSheet() && d && typeof d.showModal === "function") d.showModal();
    else pick("files");
  };

  return (
    <>
      {SOURCES.map((source) => (
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
        className="ck-icon-btn"
        onClick={open}
        disabled={disabled}
        aria-label={labels.attach}
        aria-haspopup="dialog"
        title={labels.attach}
      >
        <IconPaperclip />
      </button>
      <dialog
        ref={dialog}
        className="ck-sheet"
        aria-label={labels.title}
        // A tap on the backdrop lands on the <dialog> itself, never on the
        // panel inside it: that is the scrim.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="ck-sheet-panel">
          <div className="ck-sheet-head">
            <span className="ck-sheet-title">{labels.title}</span>
            <button
              type="button"
              className="ck-icon-btn ck-sheet-close"
              onClick={close}
              aria-label={labels.close}
              title={labels.close}
            >
              <IconX />
            </button>
          </div>
          <div className="ck-attach-sources">
            {SOURCES.map((source) => {
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
        </div>
      </dialog>
    </>
  );
}
