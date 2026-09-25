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
 * Follow the conversation only while the reader is at the bottom, and offer a
 * way back once they are not. Pinned in a layout effect so the view settles
 * before the new token paints — in a passive effect the content lands first
 * and the scroll catches up, which reads as a shudder on every chunk.
 *
 * `grew` should change when a NEW turn is added (message count): sending is an
 * unambiguous "show me the reply", so it re-arms following.
 */
export declare function useStickToBottom(changes: DependencyList, grew: number): {
    scrollRef: RefObject<HTMLDivElement | null>;
    endRef: RefObject<HTMLDivElement | null>;
    following: boolean;
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
export declare function useViewportHeight(target?: RefObject<HTMLElement | null>): void;
/** Grow a textarea to its content up to `max` px, keyed on the VALUE so a
 *  prefill, a dictated transcript or the clear after send resize it too. */
export declare function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, max?: number): void;
//# sourceMappingURL=hooks.d.ts.map