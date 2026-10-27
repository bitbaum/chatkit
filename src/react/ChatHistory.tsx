"use client";

import { useState, type FormEvent } from "react";
import {
  filterConversations,
  formatConversationDate,
  groupConversations,
  type ConversationSummary,
} from "../conversations.js";
import { IconMore, IconNewChat, IconSearch, IconX } from "./icons.js";
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
export function ChatHistory({
  conversations,
  state,
  activeId,
  busyIds,
  onOpen,
  onNew,
  onRename,
  onRemove,
  onRetry,
  onClose,
  search = filterConversations,
  locale,
  labels,
}: ChatHistoryProps) {
  const [query, setQuery] = useState("");
  const [armed, setArmed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const now = Date.now();
  const shown = search(conversations, query);
  const groups = groupConversations(shown, now);

  const close = () => {
    setArmed(null);
    setConfirming(null);
    setEditing(null);
  };
  const submitRename = (e: FormEvent<HTMLFormElement>, id: string) => {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("title") ?? "").trim();
    if (value) onRename(id, value);
    close();
  };

  return (
    <nav className="ck-history" aria-label={labels.chats}>
      <div className="ck-history-head">
        <span className="ck-history-title">{labels.chats}</span>
        {onClose && (
          <button
            type="button"
            className="ck-icon-btn ck-history-close"
            onClick={onClose}
            aria-label={labels.closeChats}
            title={labels.closeChats}
            data-ck-initial-focus=""
          >
            <IconX />
          </button>
        )}
      </div>
      <button type="button" className="ck-history-new" onClick={onNew}>
        <IconNewChat />
        <span>{labels.newChat}</span>
      </button>
      <label className="ck-history-search">
        <IconSearch />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          enterKeyHint="search"
        />
      </label>

      <div className="ck-history-list">
        {state === "loading" && conversations.length === 0 ? (
          <p className="ck-history-empty" role="status">
            {labels.loadingChats}
          </p>
        ) : state === "error" ? (
          <div className="ck-history-empty" role="status">
            <p>{labels.listFailed}</p>
            <button type="button" className="ck-history-retry" onClick={onRetry}>
              {labels.tryAgain}
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <p className="ck-history-empty">{labels.noChats}</p>
        ) : groups.length === 0 ? (
          <p className="ck-history-empty">{labels.noMatch(query.trim())}</p>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="ck-history-group" aria-label={labels[group.key]}>
              <h3 className="ck-history-group-title">{labels[group.key]}</h3>
              <ul>
                {group.items.map((c) => {
                  const title = c.title.trim() || labels.untitled;
                  const busy = busyIds.has(c.id);
                  const active = c.id === activeId;
                  const isArmed = armed === c.id;
                  return (
                    <li
                      key={c.id}
                      className={active ? "ck-history-row ck-history-row-active" : "ck-history-row"}
                    >
                      {editing === c.id ? (
                        <form className="ck-history-rename" onSubmit={(e) => submitRename(e, c.id)}>
                          <input
                            name="title"
                            defaultValue={c.title}
                            aria-label={labels.renameField}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                close();
                              }
                            }}
                          />
                          <div className="ck-history-pair">
                            <button type="submit">{labels.save}</button>
                            <button type="button" onClick={close}>
                              {labels.cancel}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="ck-history-line">
                          <button
                            type="button"
                            className="ck-history-open"
                            aria-current={active ? "page" : undefined}
                            onClick={() => {
                              close();
                              onOpen(c.id);
                            }}
                          >
                            <span className="ck-history-name">{title}</span>
                            <span className="ck-history-date">
                              {busy
                                ? labels.answering
                                : formatConversationDate(c.updatedAt, now, locale)}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="ck-history-more"
                            aria-expanded={isArmed}
                            aria-label={labels.chatActions(title)}
                            title={labels.chatActions(title)}
                            onClick={() => {
                              setConfirming(null);
                              setArmed(isArmed ? null : c.id);
                            }}
                          >
                            <IconMore />
                          </button>
                        </div>
                      )}
                      {isArmed && editing !== c.id && confirming !== c.id && (
                        <div className="ck-history-pair">
                          <button type="button" onClick={() => setEditing(c.id)}>
                            {labels.rename}
                          </button>
                          <button type="button" onClick={() => setConfirming(c.id)}>
                            {labels.delete}
                          </button>
                        </div>
                      )}
                      {confirming === c.id && (
                        <div
                          className="ck-history-confirm"
                          role="group"
                          aria-label={labels.deleteAsk(title)}
                        >
                          <p>{labels.deleteAsk(title)}</p>
                          <div className="ck-history-pair">
                            <button
                              type="button"
                              className="ck-history-danger"
                              onClick={() => {
                                close();
                                onRemove(c.id);
                              }}
                            >
                              {labels.delete}
                            </button>
                            <button type="button" onClick={close}>
                              {labels.cancel}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </nav>
  );
}
