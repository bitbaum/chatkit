"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  agentsPresent,
  conversationPreview,
  conversationTitle,
  listTime,
  otherPeople,
  searchConversations,
  typingLabel,
  type MessengerAgent,
  type MessengerConversation,
} from "../messenger.js";
import { IconAgent, IconPencil, IconPlus, IconSearch, IconSpinner, IconUsers } from "./icons.js";
import { MessengerAvatar } from "./MessageAttachments.js";
import { DEFAULT_MESSENGER_LABELS, type MessengerLabels } from "./messenger-labels.js";

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
  search?: (
    conversations: readonly MessengerConversation[],
    query: string,
  ) => readonly MessengerConversation[];
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
export function ConversationList({
  conversations,
  viewerId,
  agents = [],
  status = "ready",
  selectedId = null,
  onSelect,
  onNew,
  onReload,
  typing = {},
  search,
  header,
  agentMark,
  locale,
  timeZone,
  labels = DEFAULT_MESSENGER_LABELS,
}: ConversationListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const title = (c: MessengerConversation) => conversationTitle(c, viewerId, labels.titles, agents);
  const shown = useMemo(() => {
    const matched = query.trim()
      ? search
        ? search(conversations, query)
        : searchConversations(conversations, query, (c) =>
            conversationTitle(c, viewerId, labels.titles, agents),
          )
      : conversations;
    return filter === "unread" ? matched.filter((c) => (c.unread ?? 0) > 0) : matched;
  }, [conversations, query, filter, search, viewerId, labels.titles, agents]);
  const now = new Date();
  const anyUnread = conversations.some((c) => (c.unread ?? 0) > 0);

  return (
    <nav className="ck-msgr-list" aria-label={labels.conversations}>
      <div className="ck-msgr-list-head">
        <h1 className="ck-msgr-list-title">{labels.title}</h1>
        {onNew && (
          <button type="button" className="ck-msgr-btn ck-msgr-btn-primary" onClick={onNew}>
            <IconPlus />
            {labels.newConversation}
          </button>
        )}
      </div>
      {header}
      <div className="ck-msgr-list-tools">
        <label className="ck-msgr-search">
          <IconSearch />
          <span className="ck-msgr-sr">{labels.search}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            enterKeyHint="search"
          />
        </label>
        {/* Two equal cells in one row: a choice of one from two. Only drawn
            when there is something unread to choose — or the choice was made. */}
        {(anyUnread || filter === "unread") && (
          <div className="ck-msgr-filter" role="group" aria-label={labels.filter}>
            {(["all", "unread"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? labels.filterAll : labels.filterUnread}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ck-msgr-list-body">
        {status === "loading" && conversations.length === 0 && (
          <div className="ck-msgr-state" role="status">
            <IconSpinner />
            <span className="ck-msgr-sr">{labels.loading}</span>
          </div>
        )}
        {status === "failed" && conversations.length === 0 && (
          <div className="ck-msgr-state" role="alert">
            <p>{labels.listFailed}</p>
            {onReload && (
              <button type="button" className="ck-msgr-btn" onClick={onReload}>
                {labels.retry}
              </button>
            )}
          </div>
        )}
        {status === "ready" && conversations.length === 0 && (
          <div className="ck-msgr-state">
            <p>{labels.listEmpty}</p>
            {onNew && (
              <button type="button" className="ck-msgr-btn ck-msgr-btn-primary" onClick={onNew}>
                {labels.listEmptyAction}
              </button>
            )}
          </div>
        )}
        {conversations.length > 0 && shown.length === 0 && (
          <div className="ck-msgr-state">
            <p>
              {query.trim() ? labels.noMatch.replace("{query}", query.trim()) : labels.noUnread}
            </p>
          </div>
        )}
        {shown.length > 0 && (
          <ul className="ck-msgr-rows">
            {shown.map((c) => {
              const people = otherPeople(c, viewerId, agents);
              const present = agentsPresent(c, agents);
              // The face of a conversation: the other person; several people
              // share a group mark; alone with an agent, the agent.
              const face = people.length === 1 ? people[0] : undefined;
              const onlyAgent = people.length === 0 ? present[0] : undefined;
              const unread = c.unread ?? 0;
              const typers = (typing[c.id] ?? [])
                .map((id) => c.participants.find((p) => p.actorId === id)?.name ?? "")
                .filter(Boolean);
              const name = title(c);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={unread > 0 ? "ck-msgr-row ck-msgr-row-unread" : "ck-msgr-row"}
                    aria-current={c.id === selectedId ? "true" : undefined}
                    onClick={() => onSelect(c.id)}
                  >
                    <span className="ck-msgr-row-face">
                      {face ? (
                        <MessengerAvatar
                          name={face.name}
                          src={face.avatarUrl}
                          online={face.online}
                          size="lg"
                        />
                      ) : onlyAgent ? (
                        <MessengerAvatar
                          name={onlyAgent.name}
                          src={onlyAgent.avatarUrl}
                          agent
                          size="lg"
                          fallback={agentMark ?? <IconAgent />}
                        />
                      ) : (
                        <MessengerAvatar
                          name={name}
                          size="lg"
                          // Several people share a group mark; a conversation
                          // with nobody else is the viewer's own notes.
                          fallback={people.length > 1 ? <IconUsers /> : <IconPencil />}
                        />
                      )}
                      {present.length > 0 && !onlyAgent && (
                        <span className="ck-msgr-row-agent" title={present[0]!.name}>
                          {agentMark ?? <IconAgent />}
                        </span>
                      )}
                    </span>
                    <span className="ck-msgr-row-text">
                      <span className="ck-msgr-row-top">
                        <span className="ck-msgr-row-name ck-truncate">{name}</span>
                        {c.last && (
                          <time dateTime={c.last.createdAt.toISOString()}>
                            {listTime(c.last.createdAt, now, labels.days, locale, timeZone)}
                          </time>
                        )}
                      </span>
                      <span className="ck-msgr-row-bottom">
                        <span className="ck-msgr-row-preview ck-truncate">
                          {typers.length > 0
                            ? typingLabel(typers, labels.typing)
                            : conversationPreview(c, viewerId, labels.preview)}
                        </span>
                        {unread > 0 && (
                          <span
                            className="ck-msgr-badge"
                            aria-label={labels.unread.replace("{n}", String(unread))}
                          >
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}
