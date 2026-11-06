import { type ComposerVoice } from "./Composer.js";
export type CommentItem = {
    id: string;
    /** The name readers see. */
    author: string;
    /** Plain text; line breaks are kept. */
    body: string;
    createdAt: string | number | Date;
};
/**
 * Where comments go. The component owns the list, the optimistic removal and
 * every failure message; the app owns the database and who may do what.
 */
export type CommentTransport = {
    /** Store the comment and return it as stored (its id, its author, its time). Throw to refuse. */
    post: (text: string) => Promise<CommentItem>;
    /** Delete one. Omit and nobody gets a Remove button. */
    remove?: (id: string) => Promise<void>;
};
export type CommentThreadLabels = {
    /** The heading: "No comments yet", "1 comment", "7 comments". */
    count: (n: number) => string;
    placeholder: string;
    ariaLabel: string;
    send: string;
    signIn: string;
    remove: string;
    postFailed: string;
    removeFailed: string;
    postedAs: (name: string) => string;
};
export declare const DEFAULT_COMMENT_THREAD_LABELS: CommentThreadLabels;
export type CommentThreadProps = {
    /** The comments as loaded, oldest first. Re-mount (a `key`) to load a new set. */
    comments: readonly CommentItem[];
    transport: CommentTransport;
    /** Who is looking. `null`: readers see the thread and a sign-in link, not the box. */
    viewer: {
        name: string;
    } | null;
    /** Where "Sign in to comment" goes. Required for a signed-out reader to have a way forward. */
    signInHref?: string;
    /** Who may remove which comment (its author; the page's owner). Default: nobody. */
    canRemove?: (comment: CommentItem) => boolean;
    /** The microphone of the box. Pass `{ transcribeUrl }` for the server leg. */
    voice?: ComposerVoice | false;
    /**
     * How a time reads. Default: `locale` in `timeZone` (UTC when none is given,
     * so the server's and the browser's markup agree). Pass your own to match
     * the rest of the product.
     */
    formatTime?: (at: Date) => string;
    locale?: string;
    timeZone?: string;
    /** Heading level. Default 2. */
    headingLevel?: 2 | 3 | 4;
    labels?: Partial<CommentThreadLabels>;
    className?: string;
};
/**
 * The conversation under anything: an article, a page, a listing. Comments
 * read oldest first, the box is chatkit's `Composer` (so it has the
 * microphone, 16px text and Enter-to-send like every other box in the fleet),
 * and a person can remove what they wrote. Reading needs nothing; writing
 * needs `viewer`, and a signed-out reader is shown the way to sign in on the
 * same screen, never a dead end.
 */
export declare function CommentThread({ comments, transport, viewer, signInHref, canRemove, voice, formatTime, locale, timeZone, headingLevel, labels: overrides, className, }: CommentThreadProps): import("react").JSX.Element;
//# sourceMappingURL=CommentThread.d.ts.map