"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, } from "react";
import { isFollowing } from "../scroll.js";
/**
 * Copy + a checkmark that resets. Failures are swallowed on purpose (insecure
 * origin, denied permission): the text stays selectable, so a failed copy
 * blocks nothing — `copied` simply never flips.
 */
export function useClipboard(resetMs = 1500) {
    const [copied, setCopied] = useState(false);
    const timer = useRef(null);
    useEffect(() => () => {
        if (timer.current)
            clearTimeout(timer.current);
    }, []);
    const copy = useCallback((text) => {
        void Promise.resolve(navigator.clipboard?.writeText(text))
            .then(() => {
            setCopied(true);
            if (timer.current)
                clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), resetMs);
        })
            .catch(() => { });
    }, [resetMs]);
    return { copied, copy };
}
/**
 * Follow the conversation only while the reader is at the bottom, and offer a
 * way back once they are not. Pinned in a layout effect so the view settles
 * before the new token paints — in a passive effect the content lands first
 * and the scroll catches up, which reads as a shudder on every chunk.
 *
 * `grew` should change when a NEW turn is added (message count): sending is an
 * unambiguous "show me the reply", so it re-arms following.
 */
export function useStickToBottom(changes, grew) {
    const scrollRef = useRef(null);
    const endRef = useRef(null);
    const [following, setFollowing] = useState(true);
    const onScroll = useCallback(() => {
        const el = scrollRef.current;
        if (el)
            setFollowing(isFollowing(el));
    }, []);
    const jumpToBottom = useCallback(() => {
        setFollowing(true);
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, []);
    useLayoutEffect(() => {
        if (following)
            endRef.current?.scrollIntoView({ block: "end" });
    }, [following, ...changes]);
    const previous = useRef(grew);
    useEffect(() => {
        if (grew > previous.current)
            setFollowing(true);
        previous.current = grew;
    }, [grew]);
    return { scrollRef, endRef, following, onScroll, jumpToBottom };
}
/**
 * Publishes the VISUAL viewport height as `--ck-viewport-height`.
 *
 * `100dvh` does not shrink when the Android soft keyboard opens; only
 * `visualViewport` does. A chat column sized `100dvh` keeps its height while
 * the keyboard covers the bottom of it, so the composer ends up behind the
 * keyboard (orangecat `ViewportHeightSync`, #1094). Rounded down: sub-pixel
 * heights leave a 1px seam under the composer on some devices.
 */
export function useViewportHeight(target) {
    useEffect(() => {
        const vv = window.visualViewport;
        const el = target?.current ?? document.documentElement;
        const sync = () => el.style.setProperty("--ck-viewport-height", `${Math.floor(vv?.height ?? window.innerHeight)}px`);
        sync();
        vv?.addEventListener("resize", sync);
        vv?.addEventListener("scroll", sync);
        window.addEventListener("orientationchange", sync);
        return () => {
            vv?.removeEventListener("resize", sync);
            vv?.removeEventListener("scroll", sync);
            window.removeEventListener("orientationchange", sync);
            el.style.removeProperty("--ck-viewport-height");
        };
    }, [target]);
}
/** Grow a textarea to its content up to `max` px, keyed on the VALUE so a
 *  prefill, a dictated transcript or the clear after send resize it too. */
export function useAutoGrow(ref, value, max = 240) {
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    }, [ref, value, max]);
}
//# sourceMappingURL=hooks.js.map