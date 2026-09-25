import type { ReactNode } from "react";
import { type CitationMap, type RenderLink } from "./Markdown.js";
export type ChatSpeaker = {
    /** Shown above the message when more than one agent can answer. */
    name: string;
    /** Stable id for styling (`ck-from-<id>`), e.g. "cat" or "loki". */
    id?: string;
};
export type ChatMessageData = {
    id: string;
    role: "user" | "assistant";
    content: string;
    speaker?: ChatSpeaker;
    citations?: CitationMap;
    /** The turn failed: shown as a failure with Retry, never as silence. */
    failed?: boolean;
};
export type ThreadLabels = {
    copy: string;
    copied: string;
    retry: string;
    stop: string;
    working: string;
    stopped: string;
    jump: string;
    failed: string;
    loading: string;
};
export declare const DEFAULT_THREAD_LABELS: ThreadLabels;
/**
 * One turn. The asymmetry is deliberate: the person's own words get a pill —
 * a short aside they already know — and the answer gets the full column with
 * no box, because it is the thing being READ. Copy is on every answer; Retry
 * only on the last one (retrying an older turn would fork the thread).
 */
export declare function ChatMessage({ message, onRetry, renderLink, showSpeaker, footer, last, labels, }: {
    message: ChatMessageData;
    /** The latest answer: its actions stay visible (they are what you want next). */
    last?: boolean;
    onRetry?: () => void;
    renderLink?: RenderLink;
    /** Hide the name when only one agent ever speaks. */
    showSpeaker?: boolean;
    /** Under the answer: provenance, sources, an action card. */
    footer?: ReactNode;
    labels?: ThreadLabels;
}): import("react").JSX.Element;
export type LiveTurn = {
    /** What has streamed in so far. */
    text?: string;
    /** What it is doing before the first word ("Reading the fleet map"). */
    status?: string;
    speaker?: ChatSpeaker;
};
/**
 * The conversation. Follows new tokens only while the reader is at the
 * bottom, with a button back down once they are not; a turn in flight can be
 * stopped from where it is being written.
 */
export declare function ChatThread({ messages, live, loading, stopped, onStop, onRetry, renderLink, renderFooter, showSpeakers, empty, children, labels: labelOverrides, }: {
    messages: ChatMessageData[];
    live?: LiveTurn | null;
    loading?: boolean;
    /** The person stopped the last turn themselves. */
    stopped?: boolean;
    onStop?: () => void;
    /** Retry the last answer (offered on it, and on a failed one). */
    onRetry?: () => void;
    renderLink?: RenderLink;
    /** App-specific content under an answer (sources, an action card). */
    renderFooter?: (m: ChatMessageData) => ReactNode;
    /** Default: shown when more than one speaker appears in the thread. */
    showSpeakers?: boolean;
    /** Shown instead of the thread before the first message (starters). */
    empty?: ReactNode;
    /** After the last turn (a note, a picker). */
    children?: ReactNode;
    labels?: Partial<ThreadLabels>;
}): import("react").JSX.Element;
export type Starter = string | {
    label: string;
    prompt?: string;
};
/** The empty state that starts a conversation. It disappears once one has. */
export declare function ChatStarters({ starters, onPick, title, }: {
    starters: readonly Starter[];
    onPick: (prompt: string) => void;
    title?: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=Thread.d.ts.map