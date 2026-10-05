"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [open, setOpen] = useState(false);
  const inputs = useRef<Partial<Record<AttachSource, HTMLInputElement | null>>>({});
  const sheet = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const pick = (source: AttachSource) => {
    setOpen(false);
    inputs.current[source]?.click();
  };

  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector<HTMLButtonElement>(".ck-attach-source")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
        ref={trigger}
        type="button"
        className="ck-icon-btn"
        onClick={() => (prefersSheet() ? setOpen(true) : pick("files"))}
        disabled={disabled}
        aria-label={labels.attach}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={labels.attach}
      >
        <IconPaperclip />
      </button>
      {/* Portalled to <body>: a composer often sits inside a transformed or
          overflow-clipped panel (a drawer, a floating rail), and a fixed
          sheet inside one is pinned to the panel instead of the screen. */}
      {open &&
        createPortal(
          <div className="ck-sheet-root">
            <div className="ck-sheet-scrim" onClick={() => setOpen(false)} aria-hidden />
            <div
              ref={sheet}
              className="ck-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={labels.title}
            >
              <div className="ck-sheet-head">
                <span className="ck-sheet-title">{labels.title}</span>
                <button
                  type="button"
                  className="ck-icon-btn ck-sheet-close"
                  onClick={() => setOpen(false)}
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
          </div>,
          document.body,
        )}
    </>
  );
}
