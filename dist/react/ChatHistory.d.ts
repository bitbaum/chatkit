import { type ConversationSummary } from "../conversations.js";
import type { ChatAppLabels } from "./ChatApp.js";
export type ChatHistoryProps = {
    conversations: ConversationSummary[];
    state: "loading" | "ready" | "error";
    activeId: string | null;
    /** Conversations with a turn running: their row says so instead of a date. */
    busyIds: ReadonlySet<string>;
    onOpen: (id: string) => void;
    onNew: () => void;
    onRename: (id: string, title: string) => void;
    onRemove: (id: string) => void;
    onRetry: () => void;
    /** The drawer's close button; absent on the always-open rail. */
    onClose?: () => void;
    search?: (list: ConversationSummary[], query: string) => ConversationSummary[];
    locale?: string;
    labels: ChatAppLabels;
};
/**
 * The chat list — the same in every product: New chat, a search box, the
 * chats under Today / Yesterday / Earlier. Every row has ONE anatomy: the
 * title, the date (or "Answering…"), and one "…" that opens the row's two
 * actions, Rename and Delete, as two equal cells under it. A delete asks
 * once, in the row.
 */
export declare function ChatHistory({ conversations, state, activeId, busyIds, onOpen, onNew, onRename, onRemove, onRetry, onClose, search, locale, labels, }: ChatHistoryProps): import("react").JSX.Element;
//# sourceMappingURL=ChatHistory.d.ts.map