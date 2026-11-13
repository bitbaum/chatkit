import { type ReactNode } from "react";
import { type MessengerAgent, type MessengerConversation, type MessengerCard, type MessengerMessage } from "../messenger.js";
import type { MessengerAwaited } from "../messenger-state.js";
import { type RenderLink } from "./Markdown.js";
import { type MessengerLabels } from "./messenger-labels.js";
export type MessageThreadProps = {
    conversation: MessengerConversation;
    /** The id the viewer's own messages carry. */
    viewerId: string;
    /** Oldest first. */
    messages: readonly MessengerMessage[];
    agents?: readonly MessengerAgent[];
    status?: "loading" | "ready" | "failed";
    onReload?: () => void;
    /** There are earlier messages to load. */
    hasOlder?: boolean;
    loadingOlder?: boolean;
    olderFailed?: boolean;
    onLoadOlder?: () => void;
    /** The viewer's read mark when the thread was opened: where "New" is drawn. */
    unreadFrom?: Date | null;
    /** Actor ids of the people typing now. */
    typing?: readonly string[];
    /** Agents somebody just called on. */
    awaited?: readonly MessengerAwaited[];
    onDismissAgent?: (agentId: string) => void;
    onRetry?: (message: MessengerMessage) => void;
    onDiscard?: (message: MessengerMessage) => void;
    /** Open what can be done to a message (copy, edit, delete). Given, a
     *  message answers a long press, a right click and its "…" button. */
    onAction?: (message: MessengerMessage) => void;
    /** Tap a reaction chip: put the same emoji on, or take the viewer's off. */
    onReact?: (message: MessengerMessage, emoji: string) => void;
    /** At the end of a card: what the app adds to it for this reader. */
    renderCardAction?: (card: MessengerCard, message: MessengerMessage) => ReactNode;
    /** The viewer is at the newest message and it is on screen. */
    onSeen?: () => void;
    onFollowingChange?: (following: boolean) => void;
    renderLink?: RenderLink;
    /** A product's own mark for an agent with no picture. */
    agentMark?: ReactNode;
    locale?: string;
    timeZone?: string;
    labels?: MessengerLabels;
};
/**
 * A conversation between people, and the agents among them.
 *
 * What it settles so no product has to again: whose message is whose (the
 * viewer's on the right; everyone else's on the left, named whenever more
 * than one other voice is present); that an agent never passes for a person
 * (its own shape of face, an "Agent" mark, whom it answered for, its words in
 * an outlined bubble); runs of messages that share one name and one time; a
 * line where each day begins and one where the unread begin; ticks drawn from
 * threadkit's `readState`; a message that failed, kept with Try again.
 *
 * It scrolls itself: give it a box with a height. It follows new messages
 * only while the reader is at the end, and keeps its place when earlier
 * messages are loaded above.
 */
export declare function MessageThread({ conversation, viewerId, messages, agents, status, onReload, hasOlder, loadingOlder, olderFailed, onLoadOlder, unreadFrom, typing, awaited, onDismissAgent, onRetry, onDiscard, onAction, onReact, renderCardAction, onSeen, onFollowingChange, renderLink, agentMark, locale, timeZone, labels, }: MessageThreadProps): import("react").JSX.Element;
//# sourceMappingURL=MessageThread.d.ts.map