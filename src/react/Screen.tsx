"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useViewportHeight } from "./hooks.js";
import { RichRenderersContext, type RichRenderers } from "./renderers.js";

/**
 * The chat as the whole screen, the way the ChatGPT and Claude apps lay it
 * out: the conversation runs edge to edge and top to bottom, and the controls
 * FLOAT over it — a see-through header at the top, the composer at the bottom
 * — instead of each taking a strip of the screen away from the reading.
 *
 * Words scroll under both. They fade out as they pass beneath the header and
 * the composer, so the controls stay legible without an opaque bar behind
 * them; the last line of an answer always rests above the composer, never
 * behind it (the scroller is padded by the measured height of each).
 *
 * The heights are published as `--ck-top-inset` and `--ck-bottom-inset` on
 * the screen, so an app whose thread is its own scroller pads it with them:
 *
 *   .my-thread { padding-block: var(--ck-top-inset) var(--ck-bottom-inset); }
 *
 * chatkit's own `ChatThread` does that already.
 */
export function ChatScreen({
  header,
  composer,
  footnote,
  children,
  fill = "parent",
  className,
  renderers,
}: {
  /**
   * The app's drawing for chart blocks in every answer on this screen:
   * `{ chart: (block) => <Chart … /> }`. Reaches chatkit's thread and
   * `Markdown` wherever they render under it; a `renderers` prop on one of
   * them overrides it there.
   */
  renderers?: RichRenderers;
  /** Floats over the top of the conversation. Give its buttons `ck-glass`. */
  header?: ReactNode;
  /** The composer (and anything that belongs with it: an error, a queue). */
  composer: ReactNode;
  /** One quiet line under the composer ("Answers can be wrong"). */
  footnote?: ReactNode;
  /** The conversation: a `ChatThread`, or an app's own scroller. */
  children: ReactNode;
  /**
   * "parent" fills the box the app gives it. "viewport" takes the visual
   * viewport — the height that shrinks when the phone keyboard opens, so the
   * composer rides on top of the keyboard instead of behind it.
   */
  fill?: "parent" | "viewport";
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  useViewportHeight(rootRef, fill === "viewport");
  const hasHeader = header != null && header !== false;

  // Measured, not guessed: the composer grows with a long draft, a staged
  // screenshot or a dictation problem, and the reading has to move with it.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sync = () => {
      root.style.setProperty("--ck-top-inset", `${headerRef.current?.offsetHeight ?? 0}px`);
      root.style.setProperty("--ck-bottom-inset", `${dockRef.current?.offsetHeight ?? 0}px`);
    };
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    if (headerRef.current) observer.observe(headerRef.current);
    if (dockRef.current) observer.observe(dockRef.current);
    return () => observer.disconnect();
  }, [hasHeader]);

  const cls = ["ck-screen"];
  if (fill === "viewport") cls.push("ck-screen-viewport");
  if (className) cls.push(className);
  return (
    <div ref={rootRef} className={cls.join(" ")}>
      <div className="ck-screen-body">
        {renderers ? (
          <RichRenderersContext.Provider value={renderers}>
            {children}
          </RichRenderersContext.Provider>
        ) : (
          children
        )}
      </div>
      {hasHeader && (
        <div ref={headerRef} className="ck-screen-header">
          <div className="ck-screen-header-row">{header}</div>
        </div>
      )}
      <div ref={dockRef} className="ck-screen-dock">
        <div className="ck-screen-column">
          {composer}
          {footnote != null && <p className="ck-screen-footnote">{footnote}</p>}
        </div>
      </div>
    </div>
  );
}
