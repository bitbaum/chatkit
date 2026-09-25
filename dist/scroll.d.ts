/**
 * How close to the bottom still counts as "following the conversation". Above
 * this, the reader is reading something older and must not be yanked back
 * every time a token arrives — the bug in every chat here except loki's and
 * orangecat's.
 */
export declare const FOLLOW_THRESHOLD_PX = 120;
export declare function isFollowing(el: {
    scrollHeight: number;
    scrollTop: number;
    clientHeight: number;
}, threshold?: number): boolean;
//# sourceMappingURL=scroll.d.ts.map