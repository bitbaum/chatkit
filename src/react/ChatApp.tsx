"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ConversationStore, ConversationSummary } from "../conversations.js";
import { localConversationStore } from "../stores.js";
import type { Speaker } from "../speech.js";
import type { AnswerFeedback } from "../review.js";
import { ChatScreen } from "./Screen.js";
import {
  ChatStarters,
  ChatThread,
  type ChatMessageData,
  type Starter,
  type ThreadLabels,
} from "./Thread.js";
import { Composer, type ComposerProps } from "./Composer.js";
import { ChatHistory } from "./ChatHistory.js";
import { useViewportHeight } from "./hooks.js";
import type { RenderLink } from "./Markdown.js";
import type { RichRenderers } from "./renderers.js";
import { IconGhost, IconMenu, IconMore, IconNewChat, IconX } from "./icons.js";
import { useChatApp, type ChatAppProblem, type ChatTransport } from "./use-chat-app.js";

export type ChatAppLabels = {
  chats: string;
  openChats: string;
  closeChats: string;
  newChat: string;
  /** The title of a chat nobody has named and that has no words yet. */
  untitled: string;
  more: string;
  temporary: string;
  /** Under the title while a chat is temporary. */
  temporaryNote: string;
  share: string;
  rename: string;
  renameField: string;
  delete: string;
  deleteAsk: (title: string) => string;
  save: string;
  cancel: string;
  search: string;
  today: string;
  yesterday: string;
  earlier: string;
  noChats: string;
  noMatch: (query: string) => string;
  loadingChats: string;
  listFailed: string;
  tryAgain: string;
  answering: string;
  chatActions: (title: string) => string;
  queued: string;
  unqueue: (text: string) => string;
  dismiss: string;
  problems: Record<ChatAppProblem, string>;
};

export const DEFAULT_CHAT_APP_LABELS: ChatAppLabels = {
  chats: "Chats",
  openChats: "Open your chats",
  closeChats: "Close chats",
  newChat: "New chat",
  untitled: "New chat",
  more: "More for this chat",
  temporary: "Temporary chat",
  temporaryNote: "Not saved. Gone when you leave it.",
  share: "Share this chat",
  rename: "Rename",
  renameField: "Name of this chat",
  delete: "Delete",
  deleteAsk: (title) => `Delete “${title}”?`,
  save: "Save",
  cancel: "Cancel",
  search: "Search chats",
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
  noChats: "No chats yet. What you ask is kept here.",
  noMatch: (q) => `No chat is called “${q}”.`,
  loadingChats: "Loading your chats…",
  listFailed: "Your chats did not load.",
  tryAgain: "Try again",
  answering: "Answering…",
  chatActions: (title) => `Rename or delete “${title}”`,
  queued: "Sends when this answer is done",
  unqueue: (text) => `Do not send “${text}”`,
  dismiss: "Dismiss",
  problems: {
    load: "Your chats did not load.",
    save: "That was not saved. Check the connection and try again.",
    open: "That chat did not open. Try again.",
  },
};

export type ChatAppProps = {
  /** Send a turn and resolve with the answer (stream through `turn.update`). */
  transport: ChatTransport;
  /** Where chats live. Default: on this device (`localConversationStore`). */
  store?: ConversationStore;
  /** The composer's placeholder. */
  placeholder?: string;
  /** Over a new chat, where a chat's title goes (the product's name). */
  name?: string;
  /** Name a chat after its first answer. Without it, the first message names it. */
  makeTitle?: (first: { text: string; answer: string }) => string | null | Promise<string | null>;
  /** Starters on an empty chat; or your own `empty`. */
  starters?: readonly Starter[];
  startersTitle?: ReactNode;
  empty?: ReactNode;
  /** Composer options: `voice` (give it `transcribeUrl`), `attach` (on by
   *  default; `false` only when the product's API takes no files), `tools`,
   *  `labels`… Sending, Stop and the queue are ChatApp's. */
  composer?: Partial<Omit<ComposerProps, "onSend" | "sending" | "onStop" | "queue">>;
  /** Thread options, passed to ChatThread. */
  thread?: {
    renderLink?: RenderLink;
    renderFooter?: (m: ChatMessageData) => ReactNode;
    renderers?: RichRenderers;
    speaker?: Speaker | null;
    share?: { title?: string; url?: string } | false;
    onFeedback?: (feedback: AnswerFeedback & { conversationId: string | null }) => void;
    labels?: Partial<ThreadLabels>;
  };
  /** One quiet line under the composer. */
  footnote?: ReactNode;
  /** "viewport" (default) follows the visual viewport, above the phone keyboard. */
  fill?: "viewport" | "parent";
  /** Offer Temporary chat. Default true. */
  temporaryChats?: boolean;
  /** Offer "Share this chat" in the header's menu. */
  onShare?: (chat: { id: string; title: string; messages: ChatMessageData[] }) => void;
  /** The open chat, when the product keeps it in its URL; `null` = a new chat. */
  conversationId?: string | null;
  onConversationChange?: (id: string | null) => void;
  /** Device key that remembers the open chat across a reload; `null` = never. */
  rememberKey?: string | null;
  /** Your own list search (e.g. `@bitbaum/searchkit`); default: every word in the title. */
  search?: (list: ConversationSummary[], query: string) => ConversationSummary[];
  /** Product controls in the header: before the title, and before New chat. */
  headerStart?: ReactNode;
  headerEnd?: ReactNode;
  /** Dates in the list. Default: the browser's. */
  locale?: string;
  /** When the chat list stops being a drawer and stays open beside the chat. */
  railQuery?: string;
  labels?: Partial<ChatAppLabels>;
  className?: string;
};

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const sync = () => setMatch(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return match;
}

let fallbackStore: ConversationStore | null = null;

/**
 * The whole chat app, the way the Claude, ChatGPT and Grok phone apps are
 * laid out: the conversation edge to edge, a frosted header (Chats · title ·
 * New chat · More), the chat list in a drawer on a phone and a rail beside
 * the chat from a wide screen, and the composer floating at the bottom with
 * the microphone, Camera · Photos · Files and the queue.
 *
 * A product gives it two things — a `transport` that answers a turn, and a
 * `store` that keeps chats (or nothing: the device then keeps them) — plus
 * its words. Everything a person sees and does is the same in every product.
 */
export function ChatApp({
  transport,
  store: givenStore,
  placeholder = "Ask anything",
  name = "",
  makeTitle,
  starters,
  startersTitle,
  empty,
  composer,
  thread,
  footnote,
  fill = "viewport",
  temporaryChats = true,
  onShare,
  conversationId,
  onConversationChange,
  rememberKey = "ck-chat:open",
  search,
  headerStart,
  headerEnd,
  locale,
  railQuery = "(min-width: 64rem)",
  labels: labelOverrides,
  className,
}: ChatAppProps) {
  const labels: ChatAppLabels = {
    ...DEFAULT_CHAT_APP_LABELS,
    ...labelOverrides,
    problems: { ...DEFAULT_CHAT_APP_LABELS.problems, ...labelOverrides?.problems },
  };
  const store = useMemo(
    () => givenStore ?? (fallbackStore ??= localConversationStore()),
    [givenStore],
  );
  const app = useChatApp({
    store,
    transport,
    makeTitle,
    conversationId,
    onConversationChange,
    rememberKey,
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  useViewportHeight(rootRef, fill === "viewport");
  const wide = useMediaQuery(railQuery);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const d = drawerRef.current;
    if (!d) return;
    if (drawerOpen && !d.open && typeof d.showModal === "function") {
      d.showModal();
      // Focus the close button, never the search box: on a phone that would
      // throw the keyboard over the list the person came to read.
      d.querySelector<HTMLElement>("[data-ck-initial-focus]")?.focus();
    } else if (!drawerOpen && d.open) d.close();
  }, [drawerOpen]);
  useEffect(() => {
    if (wide) setDrawerOpen(false);
  }, [wide]);

  const current = app.list.find((c) => c.id === app.activeId);
  const title = app.temporary
    ? labels.temporary
    : current
      ? current.title.trim() || labels.untitled
      : app.activeId
        ? labels.untitled
        : name;
  const inStored = !!app.stored && !!current;

  const history = (
    <ChatHistory
      conversations={app.list}
      state={app.listState}
      activeId={app.activeId}
      busyIds={app.busyIds}
      onOpen={(id) => {
        setDrawerOpen(false);
        app.open(id);
      }}
      onNew={() => {
        setDrawerOpen(false);
        app.newChat();
      }}
      onRename={(id, t) => void app.rename(id, t)}
      onRemove={(id) => void app.remove(id)}
      onRetry={app.reloadList}
      onClose={wide ? undefined : () => setDrawerOpen(false)}
      search={search}
      locale={locale}
      labels={labels}
    />
  );

  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menu: MenuItem[] = [];
  if (temporaryChats)
    menu.push({
      label: labels.temporary,
      checked: app.temporary,
      onSelect: app.toggleTemporary,
    });
  if (onShare && app.activeId && app.messages.length > 0)
    menu.push({
      label: labels.share,
      onSelect: () => onShare({ id: app.activeId!, title, messages: app.messages }),
    });
  if (inStored) {
    menu.push({ label: labels.rename, onSelect: () => setRenaming(true) });
    menu.push({ label: labels.delete, danger: true, onSelect: () => setDeleting(true) });
  }

  const header = (
    <>
      {!wide && (
        <button
          type="button"
          className="ck-glass ck-app-icon"
          aria-label={labels.openChats}
          title={labels.openChats}
          aria-haspopup="dialog"
          onClick={() => setDrawerOpen(true)}
        >
          <IconMenu />
        </button>
      )}
      {headerStart}
      <div className="ck-app-title">
        {renaming && current ? (
          <form
            className="ck-app-rename"
            onSubmit={(e) => {
              e.preventDefault();
              const v = String(new FormData(e.currentTarget).get("title") ?? "").trim();
              if (v) void app.rename(current.id, v);
              setRenaming(false);
            }}
          >
            <input
              name="title"
              defaultValue={current.title}
              aria-label={labels.renameField}
              autoFocus
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              onKeyDown={(e) => {
                if (e.key === "Escape") setRenaming(false);
              }}
            />
          </form>
        ) : (
          <>
            <span className="ck-app-title-text">
              {app.temporary && <IconGhost />}
              <span className="ck-truncate">{title}</span>
            </span>
            {app.temporary && <span className="ck-app-title-note">{labels.temporaryNote}</span>}
          </>
        )}
      </div>
      {headerEnd}
      <button
        type="button"
        className="ck-glass ck-app-icon"
        aria-label={labels.newChat}
        title={labels.newChat}
        onClick={app.newChat}
      >
        <IconNewChat />
      </button>
      {menu.length > 0 && <HeaderMenu label={labels.more} items={menu} />}
    </>
  );

  const above =
    deleting && current ? (
      <div className="ck-app-confirm" role="group" aria-label={labels.deleteAsk(title)}>
        <p>{labels.deleteAsk(title)}</p>
        <div className="ck-history-pair">
          <button
            type="button"
            className="ck-history-danger"
            onClick={() => {
              setDeleting(false);
              void app.remove(current.id);
            }}
          >
            {labels.delete}
          </button>
          <button type="button" onClick={() => setDeleting(false)}>
            {labels.cancel}
          </button>
        </div>
      </div>
    ) : null;

  const dock = (
    <>
      {above}
      {app.problem && (
        <p className="ck-problem" role="status">
          <span>{labels.problems[app.problem]}</span>
          <button
            type="button"
            className="ck-problem-x"
            onClick={app.clearProblem}
            aria-label={labels.dismiss}
          >
            <IconX />
          </button>
        </p>
      )}
      {app.queued.length > 0 && (
        <ul className="ck-app-queue" aria-label={labels.queued}>
          {app.queued.map((q) => (
            <li key={q.id}>
              <span className="ck-app-queue-text">
                <span className="ck-truncate">{q.text}</span>
                <small>{labels.queued}</small>
              </span>
              <button
                type="button"
                className="ck-icon-btn"
                onClick={() => app.unqueue(q.id)}
                aria-label={labels.unqueue(q.text)}
                title={labels.unqueue(q.text)}
              >
                <IconX />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Composer
        placeholder={placeholder}
        attach
        stagedPosition="above"
        {...composer}
        onSend={(text, attachments) => app.send(text, attachments)}
        sending={app.busy}
        onStop={app.stop}
        queue
      />
    </>
  );

  const lastFailed = app.messages[app.messages.length - 1]?.failed;
  const onFeedback = thread?.onFeedback;
  const cls = ["ck-app"];
  if (fill === "viewport") cls.push("ck-app-viewport");
  if (wide) cls.push("ck-app-wide");
  if (className) cls.push(className);

  return (
    <div ref={rootRef} className={cls.join(" ")}>
      {wide ? (
        <aside className="ck-app-rail">{history}</aside>
      ) : (
        <dialog
          ref={drawerRef}
          className="ck-app-drawer"
          aria-label={labels.chats}
          onClose={() => setDrawerOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          {drawerOpen && <div className="ck-app-drawer-panel">{history}</div>}
        </dialog>
      )}
      <ChatScreen
        fill="parent"
        className="ck-app-screen"
        header={header}
        composer={dock}
        footnote={footnote}
        renderers={thread?.renderers}
      >
        <ChatThread
          key={app.activeId ?? (app.temporary ? "temporary" : "new")}
          messages={app.messages}
          loading={app.loading}
          live={app.live}
          stopped={app.stopped}
          onStop={app.stop}
          onRetry={lastFailed || app.stopped ? app.retry : undefined}
          onReply={(text) => void app.send(text)}
          renderLink={thread?.renderLink}
          renderFooter={thread?.renderFooter}
          speaker={thread?.speaker}
          share={thread?.share}
          onFeedback={
            onFeedback ? (f) => onFeedback({ ...f, conversationId: app.stored }) : undefined
          }
          labels={thread?.labels}
          empty={
            empty ??
            (starters && starters.length > 0 ? (
              <ChatStarters
                starters={starters}
                title={startersTitle}
                onPick={(text) => void app.send(text)}
              />
            ) : (
              <div className="ck-starters">
                {startersTitle && <div className="ck-starters-title">{startersTitle}</div>}
              </div>
            ))
          }
        />
      </ChatScreen>
    </div>
  );
}

type MenuItem = {
  label: string;
  onSelect: () => void;
  checked?: boolean;
  danger?: boolean;
};

/** The header's "…": a small menu under the button. Escape and a tap
 *  outside close it and give focus back to the button; arrows move. */
function HeaderMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const first = wrap.current?.querySelector<HTMLElement>("[role^=menuitem]");
    first?.focus();
    const outside = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div
      ref={wrap}
      className="ck-app-menu-wrap"
      onKeyDown={(e) => {
        if (!open) return;
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const all = [...(wrap.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
          const i = all.indexOf(document.activeElement as HTMLElement);
          const next = all[(i + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length];
          next?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="ck-glass ck-app-icon"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <IconMore />
      </button>
      {open && (
        <div className="ck-app-menu" role="menu" aria-label={label}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
              aria-checked={item.checked}
              className={item.danger ? "ck-app-menu-item ck-history-danger" : "ck-app-menu-item"}
              onClick={() => {
                close();
                item.onSelect();
              }}
            >
              <span>{item.label}</span>
              {item.checked && <span className="ck-app-menu-check" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
