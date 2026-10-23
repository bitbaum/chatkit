"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLayoutEffect, useRef } from "react";
import { useViewportHeight } from "./hooks.js";
import { RichRenderersContext } from "./renderers.js";
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
export function ChatScreen({ header, composer, footnote, children, fill = "parent", className, renderers, }) {
    const rootRef = useRef(null);
    const headerRef = useRef(null);
    const dockRef = useRef(null);
    useViewportHeight(rootRef, fill === "viewport");
    const hasHeader = header != null && header !== false;
    // Measured, not guessed: the composer grows with a long draft, a staged
    // screenshot or a dictation problem, and the reading has to move with it.
    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root)
            return;
        const sync = () => {
            root.style.setProperty("--ck-top-inset", `${headerRef.current?.offsetHeight ?? 0}px`);
            root.style.setProperty("--ck-bottom-inset", `${dockRef.current?.offsetHeight ?? 0}px`);
        };
        sync();
        if (typeof ResizeObserver === "undefined")
            return;
        const observer = new ResizeObserver(sync);
        if (headerRef.current)
            observer.observe(headerRef.current);
        if (dockRef.current)
            observer.observe(dockRef.current);
        return () => observer.disconnect();
    }, [hasHeader]);
    const cls = ["ck-screen"];
    if (fill === "viewport")
        cls.push("ck-screen-viewport");
    if (className)
        cls.push(className);
    return (_jsxs("div", { ref: rootRef, className: cls.join(" "), children: [_jsx("div", { className: "ck-screen-body", children: renderers ? (_jsx(RichRenderersContext.Provider, { value: renderers, children: children })) : (children) }), hasHeader && (_jsx("div", { ref: headerRef, className: "ck-screen-header", children: _jsx("div", { className: "ck-screen-header-row", children: header }) })), _jsx("div", { ref: dockRef, className: "ck-screen-dock", children: _jsxs("div", { className: "ck-screen-column", children: [composer, footnote != null && _jsx("p", { className: "ck-screen-footnote", children: footnote })] }) })] }));
}
//# sourceMappingURL=Screen.js.map