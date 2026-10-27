import { type DependencyList, type RefObject } from "react";
/**
 * Copy + a checkmark that resets. Failures are swallowed on purpose (insecure
 * origin, denied permission): the text stays selectable, so a failed copy
 * blocks nothing — `copied` simply never flips.
 */
export declare function useClipboard(resetMs?: number): {
    copied: boolean;
    copy: (text: string) => void;
};
/**
 * Follow the thread until the reader scrolls up. The scroll owner may be the
 * thread, a bounded ancestor, or the document (a conversation embedded in a
 * case page). Never scroll other ancestors as a side effect of following.
 * `grew` counts new user turns: an arriving assistant turn is not permission
 * to take the reader away from an older answer.
 */
export declare function useStickToBottom(changes: DependencyList, grew: number): {
    scrollRef: RefObject<HTMLDivElement | null>;
    endRef: RefObject<HTMLDivElement | null>;
    following: boolean;
    pageScroll: boolean;
    onScroll: () => void;
    jumpToBottom: () => void;
};
/**
 * Publishes the VISUAL viewport height as `--ck-viewport-height`.
 *
 * `100dvh` does not shrink when the Android soft keyboard opens; only
 * `visualViewport` does. A chat column sized `100dvh` keeps its height while
 * the keyboard covers the bottom of it, so the composer ends up behind the
 * keyboard (orangecat `ViewportHeightSync`, #1094). Rounded down: sub-pixel
 * heights leave a 1px seam under the composer on some devices.
 */
export declare function useViewportHeight(target?: RefObject<HTMLElement | null>, enabled?: boolean): void;
/** Grow a textarea to its content up to `max` px, keyed on the VALUE so a
 *  prefill, a dictated transcript or the clear after send resize it too.
 *
 *  An EMPTY box is always one line. Chromium counts the placeholder in
 *  `scrollHeight`, so a box measured while it was narrow — mid-transition,
 *  inside a sheet still opening — read its wrapped placeholder as content and
 *  locked at `max` with nothing typed: half a phone screen of blank composer
 *  (Loki, 2026-10-09). And the box re-measures when its WIDTH changes, since a
 *  width measured once is wrong after the layout settles or the phone turns. */
export declare function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, max?: number): void;
//# sourceMappingURL=hooks.d.ts.map