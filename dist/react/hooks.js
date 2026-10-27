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
 * Follow the thread until the reader scrolls up. The scroll owner may be the
 * thread, a bounded ancestor, or the document (a conversation embedded in a
 * case page). Never scroll other ancestors as a side effect of following.
 * `grew` counts new user turns: an arriving assistant turn is not permission
 * to take the reader away from an older answer.
 */
export function useStickToBottom(changes, grew) {
    const scrollRef = useRef(null);
    const endRef = useRef(null);
    const [following, setFollowing] = useState(true);
    const [pageScroll, setPageScroll] = useState(false);
    const followingRef = useRef(true);
    const owner = useRef(null);
    const previousTop = useRef(0);
    const downwardIntent = useRef(false);
    const draggingScrollbar = useRef(false);
    const cleanup = useRef(null);
    const follow = useCallback((value) => {
        followingRef.current = value;
        setFollowing(value);
    }, []);
    const onScroll = useCallback(() => {
        const el = owner.current;
        if (!el)
            return;
        const top = el.scrollTop;
        // An upward gesture must pause even within the near-bottom threshold.
        if (draggingScrollbar.current && top < previousTop.current - 1) {
            downwardIntent.current = false;
            follow(false);
        }
        else if (top > previousTop.current + 1 &&
            (downwardIntent.current || draggingScrollbar.current))
            follow(isFollowing(el));
        previousTop.current = top;
    }, [follow]);
    const pin = useCallback((smooth = false) => {
        const el = owner.current, end = endRef.current;
        if (!el || !end)
            return;
        const page = el === document.scrollingElement;
        const bottom = end.getBoundingClientRect().bottom;
        const top = page
            ? el.scrollTop + bottom - window.innerHeight
            : el.scrollTop + bottom - el.getBoundingClientRect().top - el.clientTop - el.clientHeight;
        // A thread-owned scroller includes its padding below the end marker.
        const target = el === scrollRef.current ? el.scrollHeight : top;
        el.scrollTo({ top: target, behavior: smooth ? "smooth" : "instant" });
        previousTop.current = el.scrollTop;
    }, []);
    const jumpToBottom = useCallback(() => {
        follow(true);
        pin(true);
    }, [follow, pin]);
    // Resolve on every render: an initially empty panel may become scrollable.
    useLayoutEffect(() => {
        const thread = scrollRef.current;
        if (!thread) {
            cleanup.current?.();
            cleanup.current = null;
            owner.current = null;
            return;
        }
        let selected = thread;
        while (selected &&
            !(selected.scrollHeight > selected.clientHeight + 1 &&
                /^(auto|scroll)$/.test(getComputedStyle(selected).overflowY))) {
            selected = selected.parentElement;
        }
        selected ??= document.scrollingElement;
        // Some DOM implementations (including server-side test environments) do
        // not expose a scrolling element. A formerly scrollable thread can become
        // unscrollable after its layout changes, so do not assume the fallback
        // exists when resolving its replacement.
        if (!selected) {
            cleanup.current?.();
            cleanup.current = null;
            owner.current = null;
            setPageScroll(false);
            return;
        }
        if (selected === owner.current)
            return;
        cleanup.current?.();
        owner.current = selected;
        previousTop.current = selected.scrollTop;
        setPageScroll(selected === document.scrollingElement);
        const target = selected === document.scrollingElement ? document : selected;
        const pause = () => {
            downwardIntent.current = false;
            follow(false);
        };
        const wheel = (event) => {
            if (event.deltaY < 0)
                pause();
            else if (event.deltaY > 0)
                downwardIntent.current = true;
        };
        let touchY;
        const touchStart = (event) => {
            touchY = event.touches[0]?.clientY;
        };
        const touchMove = (event) => {
            const y = event.touches[0]?.clientY;
            if (y !== undefined && touchY !== undefined) {
                if (y > touchY)
                    pause();
                else if (y < touchY)
                    downwardIntent.current = true;
            }
            touchY = y;
        };
        const key = (event) => {
            const e = event;
            const input = e.target;
            if (input?.closest('input, textarea, select, [contenteditable="true"]'))
                return;
            if (["ArrowUp", "PageUp", "Home"].includes(e.key) || (e.key === " " && e.shiftKey))
                pause();
            else if (["ArrowDown", "PageDown", "End"].includes(e.key) || e.key === " ")
                downwardIntent.current = true;
        };
        const pointer = (event) => {
            const e = event;
            const right = selected === document.scrollingElement
                ? window.innerWidth
                : selected.getBoundingClientRect().right;
            if (e.pointerType === "mouse" && e.clientX >= right - 20) {
                draggingScrollbar.current = true;
                pause();
            }
        };
        const releasePointer = () => {
            draggingScrollbar.current = false;
        };
        window.addEventListener("pointerup", releasePointer, { passive: true });
        const events = [
            ["pointerdown", pointer],
            ["scroll", onScroll],
            ["wheel", wheel],
            ["touchstart", touchStart],
            ["touchmove", touchMove],
            ["keydown", key],
        ];
        for (const [name, listener] of events)
            target.addEventListener(name, listener, { passive: true });
        const observer = typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(() => {
                if (followingRef.current)
                    pin();
            });
        observer?.observe(selected);
        if (thread.firstElementChild)
            observer?.observe(thread.firstElementChild);
        cleanup.current = () => {
            for (const [name, listener] of events)
                target.removeEventListener(name, listener);
            observer?.disconnect();
            window.removeEventListener("pointerup", releasePointer);
        };
    });
    useEffect(() => () => {
        cleanup.current?.();
        cleanup.current = null;
        owner.current = null;
    }, []);
    useLayoutEffect(() => {
        if (followingRef.current)
            pin();
    }, [following, pin, ...changes]);
    const previous = useRef(grew);
    useLayoutEffect(() => {
        if (grew > previous.current) {
            follow(true);
            pin();
        }
        previous.current = grew;
    }, [grew, follow, pin]);
    return { scrollRef, endRef, following, pageScroll, onScroll, jumpToBottom };
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
export function useViewportHeight(target, enabled = true) {
    useEffect(() => {
        if (!enabled)
            return;
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
    }, [target, enabled]);
}
/** Grow a textarea to its content up to `max` px, keyed on the VALUE so a
 *  prefill, a dictated transcript or the clear after send resize it too.
 *
 *  An EMPTY box is always one line. Chromium counts the placeholder in
 *  `scrollHeight`, so a box measured while it was narrow — mid-transition,
 *  inside a sheet still opening — read its wrapped placeholder as content and
 *  locked at `max` with nothing typed: half a phone screen of blank composer
 *  (Loki, 2026-10-09). And the box re-measures when its WIDTH changes, since a
 *  width measured once is wrong after the layout settles or the phone turns. */
export function useAutoGrow(ref, value, max = 240) {
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        const fit = () => {
            el.style.height = "auto";
            if (!el.value)
                return;
            el.style.height = `${Math.min(el.scrollHeight, max)}px`;
        };
        fit();
        if (typeof ResizeObserver === "undefined")
            return;
        // Width only: fit() changes the height, and reacting to that would loop.
        let width = el.clientWidth;
        const observer = new ResizeObserver(() => {
            if (el.clientWidth === width)
                return;
            width = el.clientWidth;
            fit();
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref, value, max]);
}
//# sourceMappingURL=hooks.js.map