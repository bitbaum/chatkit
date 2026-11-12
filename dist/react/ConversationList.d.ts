import { type ReactNode } from "react";
import { type MessengerAgent, type MessengerConversation } from "../messenger.js";
import { type MessengerLabels } from "./messenger-labels.js";
export type ConversationListProps = {
    conversations: readonly MessengerConversation[];
    viewerId: string;
    agents?: readonly MessengerAgent[];
    status?: "loading" | "ready" | "failed";
    selectedId?: string | null;
    onSelect: (id: string) => void;
    /** Given, the list offers "New". */
    onNew?: () => void;
    onReload?: () => void;
    /** Who is typing where: conversation id → actor ids. */
    typing?: Record<string, readonly string[]>;
    /** The product's own search (typo-tolerant, server-side). The default finds
     *  every word in names and the newest message, accents ignored. */
    search?: (conversations: readonly MessengerConversation[], query: string) => readonly MessengerConversation[];
    /** Under the title row: a product's own line (who you are writing as). */
    header?: ReactNode;
    agentMark?: ReactNode;
    locale?: string;
    timeZone?: string;
    labels?: MessengerLabels;
};
/**
 * The list of conversations. One row anatomy, always: a face, the name and
 * when it last spoke, the newest message under it, the unread count at the
 * end. A conversation with several people shows a group face; one that an
 * agent has joined says so on the face.
 */
export declare function ConversationList({ conversations, viewerId, agents, status, selectedId, onSelect, onNew, onReload, typing, search, header, agentMark, locale, timeZone, labels, }: ConversationListProps): import("react").JSX.Element;
//# sourceMappingURL=ConversationList.d.ts.map