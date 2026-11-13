"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { readState } from "../thread-rules.js";
import {
  clockTime,
  dayLabel,
  isAgent,
  linkify,
  needsNames,
  participantOf,
  quoteText,
  threadItems,
  typingLabel,
  type MessengerAgent,
  type MessengerConversation,
  type MessengerCard,
  type MessengerMessage,
  type MessengerQuote,
} from "../messenger.js";
import type { MessengerAwaited } from "../messenger-state.js";
import { useStickToBottom } from "./hooks.js";
import {
  IconAgent,
  IconAlert,
  IconArrowDown,
  IconCheck,
  IconChecks,
  IconClock,
  IconMore,
  IconSpinner,
} from "./icons.js";
import { Markdown, defaultRenderLink, type RenderLink } from "./Markdown.js";
import { MessageAttachments, MessengerAvatar } from "./MessageAttachments.js";
import { DEFAULT_MESSENGER_LABELS, type MessengerLabels } from "./messenger-labels.js";

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

const LONG_PRESS_MS = 420;

/** The message this one answers, above it. A button: it leads there. */
function Quote({
  quote,
  name,
  text,
  label,
  onOpen,
}: {
  quote: MessengerQuote;
  name: string;
  text: string;
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="ck-msgr-quote"
      onClick={onOpen}
      title={label}
      data-quote={quote.id}
    >
      <span className="ck-msgr-quote-name ck-truncate">{name}</span>
      <span className="ck-msgr-quote-text ck-truncate">{text}</span>
    </button>
  );
}

/** Something of value in the thread: one shape for every kind. */
function Card({
  card,
  renderLink,
  children,
}: {
  card: MessengerCard;
  renderLink: RenderLink;
  children?: ReactNode;
}) {
  return (
    <div className="ck-msgr-card" data-kind={card.kind} data-tone={card.tone ?? "neutral"}>
      <span className="ck-msgr-card-title">{card.title}</span>
      {card.amount && <span className="ck-msgr-card-amount">{card.amount}</span>}
      {card.note && <span className="ck-msgr-card-note">{card.note}</span>}
      {card.status && <span className="ck-msgr-card-status">{card.status}</span>}
      {card.action &&
        renderLink({
          href: card.action.href,
          internal: card.action.href.startsWith("/"),
          children: card.action.label,
          className: "ck-msgr-btn ck-msgr-card-action",
        })}
      {children}
    </div>
  );
}

/** A person's words: exactly as typed, with addresses made links. */
function PlainText({ text, renderLink }: { text: string; renderLink: RenderLink }) {
  return (
    <>
      {linkify(text).map((part, i) =>
        part.type === "link" ? (
          <span key={i}>
            {renderLink({
              href: part.href,
              internal: false,
              className: "ck-msgr-link",
              children: part.text,
            })}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function Dots() {
  return (
    <span className="ck-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

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
export function MessageThread({
  conversation,
  viewerId,
  messages,
  agents = [],
  status = "ready",
  onReload,
  hasOlder = false,
  loadingOlder = false,
  olderFailed = false,
  onLoadOlder,
  unreadFrom = null,
  typing = [],
  awaited = [],
  onDismissAgent,
  onRetry,
  onDiscard,
  onAction,
  onReact,
  renderCardAction,
  onSeen,
  onFollowingChange,
  renderLink = defaultRenderLink,
  agentMark,
  locale,
  timeZone,
  labels = DEFAULT_MESSENGER_LABELS,
}: MessageThreadProps) {
  const items = useMemo(
    () => threadItems(messages, { viewerId, timeZone, unreadFrom }),
    [messages, viewerId, timeZone, unreadFrom],
  );
  const named = needsNames(conversation, viewerId);
  // When the viewer last wrote. It grows only when they send — never when
  // earlier messages (their own among them) load above: counting their
  // messages instead pulled the reader to the end of the thread every time a
  // page of history arrived (found by test/browser-messenger.mjs).
  const own = messages.reduce(
    (latest, m) => (m.authorId === viewerId ? Math.max(latest, m.createdAt.getTime()) : latest),
    0,
  );
  const newest = messages[messages.length - 1];
  const { scrollRef, endRef, following, onScroll, jumpToBottom } = useStickToBottom(
    [messages.length, newest?.id, newest?.delivery, typing.length, awaited.length, status],
    own,
  );

  // Earlier messages arrive ABOVE what is being read. The reader's place is
  // kept by hand: not every browser anchors a scroller for us.
  const first = messages[0]?.id;
  const before = useRef<{ first: string | undefined; height: number }>({
    first,
    height: 0,
  });
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const was = before.current;
    if (was.first !== undefined && first !== was.first && !following) {
      el.scrollTop += el.scrollHeight - was.height;
    }
    before.current = { first, height: el.scrollHeight };
  });

  // Reaching the top loads the page before it.
  const olderRef = useRef<HTMLButtonElement | null>(null);
  const loadOlder = useRef(onLoadOlder);
  useEffect(() => {
    loadOlder.current = onLoadOlder;
  });
  useEffect(() => {
    const target = olderRef.current;
    const root = scrollRef.current;
    if (!target || !root || !hasOlder || loadingOlder || olderFailed) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadOlder.current?.();
      },
      { root, rootMargin: "200px 0px 0px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasOlder, loadingOlder, olderFailed, scrollRef, first]);

  const seen = useRef(onSeen);
  const followed = useRef(onFollowingChange);
  useEffect(() => {
    seen.current = onSeen;
    followed.current = onFollowingChange;
  });
  useEffect(() => {
    followed.current?.(following);
  }, [following]);
  useEffect(() => {
    if (following && status === "ready" && newest) seen.current?.();
  }, [following, status, newest?.id, newest]);

  const now = new Date();
  const nameOf = (actorId: string): string => {
    const p = participantOf(conversation, actorId);
    return p?.name || agents.find((a) => a.id === actorId)?.name || p?.handle || "";
  };

  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
  };
  useEffect(() => cancelPress, []);

  // A quote leads to its message when that message is loaded, and marks it
  // for a moment so the eye finds it.
  const showMessage = (id: string) => {
    const root = scrollRef.current;
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>("[data-message]")) {
      if (el.dataset.message !== id) continue;
      el.scrollIntoView({ block: "center" });
      el.classList.add("ck-msgr-found");
      setTimeout(() => el.classList.remove("ck-msgr-found"), 1600);
      return;
    }
  };

  const empty = status === "ready" && messages.length === 0;
  const typingNames = typing.map(nameOf).filter(Boolean);

  return (
    <div className="ck-msgr-thread-wrap">
      <div
        className="ck-msgr-scroll"
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
      >
        <div className="ck-msgr-thread-inner">
          {hasOlder && messages.length > 0 && (
            <button
              ref={olderRef}
              type="button"
              className="ck-msgr-older"
              onClick={() => onLoadOlder?.()}
              disabled={loadingOlder}
            >
              {loadingOlder ? (
                <>
                  <IconSpinner /> {labels.loadingOlder}
                </>
              ) : olderFailed ? (
                labels.olderFailed
              ) : (
                labels.loadOlder
              )}
            </button>
          )}

          {status === "loading" && messages.length === 0 && (
            <div className="ck-msgr-state" role="status">
              <IconSpinner />
              <span className="ck-msgr-sr">{labels.loading}</span>
            </div>
          )}
          {status === "failed" && messages.length === 0 && (
            <div className="ck-msgr-state" role="alert">
              <p>{labels.threadFailed}</p>
              {onReload && (
                <button type="button" className="ck-msgr-btn" onClick={onReload}>
                  {labels.retry}
                </button>
              )}
            </div>
          )}
          {empty && (
            <div className="ck-msgr-state">
              <p>{labels.threadEmpty}</p>
              {agents.map((agent) => (
                <p key={agent.id} className="ck-msgr-hint">
                  {labels.agentHint
                    .replace("{mention}", agent.mention)
                    .replace("{name}", agent.name)}
                </p>
              ))}
            </div>
          )}

          {items.map((item) => {
            if (item.type === "day") {
              return (
                <div key={item.key} className="ck-msgr-day" role="separator">
                  <span>{dayLabel(item.date, now, labels.days, locale, timeZone)}</span>
                </div>
              );
            }
            if (item.type === "unread") {
              return (
                <div key={item.key} className="ck-msgr-unread-line" role="separator">
                  <span>{labels.newMessages}</span>
                </div>
              );
            }
            const author = participantOf(conversation, item.authorId);
            const agent = isAgent(conversation, item.authorId, agents);
            const name = nameOf(item.authorId);
            const face = !item.own && (named || agent);
            const last = item.messages[item.messages.length - 1]!;
            const forWhom = last.onBehalfOf ? nameOf(last.onBehalfOf) : "";
            const time = clockTime(last.createdAt, locale, timeZone);
            const pending = last.delivery === "sending";
            const failed = item.messages.some((m) => m.delivery === "failed");
            const receipt = item.own && !last.delivery ? readState(conversation, last).state : null;
            return (
              <div
                key={item.key}
                className={[
                  "ck-msgr-run",
                  item.own ? "ck-msgr-own" : "ck-msgr-other",
                  agent ? "ck-msgr-from-agent" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="group"
                aria-label={`${item.own ? labels.you : name}, ${time}`}
                data-author={item.authorId}
              >
                {face && (
                  <MessengerAvatar
                    name={name}
                    src={author?.avatarUrl ?? agents.find((a) => a.id === item.authorId)?.avatarUrl}
                    agent={agent}
                    size="sm"
                    fallback={agent ? (agentMark ?? <IconAgent />) : undefined}
                  />
                )}
                <div className="ck-msgr-run-body">
                  {face && (
                    <span className={agent ? "ck-speaker ck-speaker-agent" : "ck-speaker"}>
                      {name}
                      {agent && <span className="ck-speaker-kind">{labels.agent}</span>}
                      {agent && forWhom && (
                        <span className="ck-speaker-for">
                          {" · "}
                          {labels.onBehalfOf.replace("{name}", forWhom)}
                        </span>
                      )}
                    </span>
                  )}
                  {item.messages.map((message) => {
                    const actable = Boolean(onAction) && !message.delivery;
                    return (
                      <div
                        key={message.id}
                        className={
                          message.delivery
                            ? `ck-msgr-msg ck-msgr-${message.delivery}`
                            : "ck-msgr-msg"
                        }
                        data-message={message.id}
                        onContextMenu={
                          actable
                            ? (e) => {
                                e.preventDefault();
                                onAction?.(message);
                              }
                            : undefined
                        }
                        onTouchStart={
                          actable
                            ? () => {
                                cancelPress();
                                press.current = setTimeout(
                                  () => onAction?.(message),
                                  LONG_PRESS_MS,
                                );
                              }
                            : undefined
                        }
                        onTouchMove={actable ? cancelPress : undefined}
                        onTouchEnd={actable ? cancelPress : undefined}
                        onTouchCancel={actable ? cancelPress : undefined}
                      >
                        {message.replyTo && (
                          <Quote
                            quote={message.replyTo}
                            name={
                              message.replyTo.authorId === viewerId
                                ? labels.you
                                : nameOf(message.replyTo.authorId)
                            }
                            text={quoteText(message.replyTo, labels.preview)}
                            label={labels.quoted}
                            onOpen={() => showMessage(message.replyTo!.id)}
                          />
                        )}
                        {message.card && (
                          <Card card={message.card} renderLink={renderLink}>
                            {renderCardAction?.(message.card, message)}
                          </Card>
                        )}
                        {message.attachments && message.attachments.length > 0 && (
                          <MessageAttachments
                            attachments={message.attachments}
                            labels={labels}
                            caption={`${item.own ? labels.you : name} · ${clockTime(message.createdAt, locale, timeZone)}`}
                          />
                        )}
                        {message.body && (
                          <div className="ck-msgr-bubble">
                            {agent ? (
                              <Markdown
                                text={message.body}
                                renderLink={renderLink}
                                sources={false}
                              />
                            ) : (
                              <PlainText text={message.body} renderLink={renderLink} />
                            )}
                          </div>
                        )}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="ck-msgr-reactions">
                            {message.reactions.map((reaction) => {
                              const mine = reaction.actorIds.includes(viewerId);
                              return (
                                <button
                                  key={reaction.emoji}
                                  type="button"
                                  className="ck-msgr-reaction"
                                  aria-pressed={mine}
                                  disabled={!onReact || Boolean(message.delivery)}
                                  onClick={() => onReact?.(message, reaction.emoji)}
                                  aria-label={labels.reactionCount
                                    .replace("{emoji}", reaction.emoji)
                                    .replace("{n}", String(reaction.actorIds.length))}
                                  title={reaction.actorIds.map(nameOf).filter(Boolean).join(", ")}
                                >
                                  <span aria-hidden>{reaction.emoji}</span>
                                  {reaction.actorIds.length > 1 && (
                                    <span aria-hidden>{reaction.actorIds.length}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {actable && (
                          <button
                            type="button"
                            className="ck-msgr-act"
                            onClick={() => onAction?.(message)}
                            aria-label={labels.actions}
                            title={labels.actions}
                          >
                            <IconMore />
                          </button>
                        )}
                        {message.delivery === "failed" && (
                          <div className="ck-msgr-failed-row" role="alert">
                            <IconAlert />
                            <span>{labels.notSent}</span>
                            {onRetry && (
                              <button type="button" onClick={() => onRetry(message)}>
                                {labels.retrySend}
                              </button>
                            )}
                            {onDiscard && (
                              <button type="button" onClick={() => onDiscard(message)}>
                                {labels.discard}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!failed && (
                    <div className="ck-msgr-meta">
                      <time dateTime={last.createdAt.toISOString()}>{time}</time>
                      {last.editedAt && <span>{labels.edited}</span>}
                      {pending && (
                        <span className="ck-msgr-tick" role="img" aria-label={labels.sending}>
                          <IconClock />
                        </span>
                      )}
                      {receipt === "none" && (
                        <span className="ck-msgr-tick" role="img" aria-label={labels.sent}>
                          <IconCheck />
                        </span>
                      )}
                      {(receipt === "some" || receipt === "all") && (
                        <span
                          className={
                            receipt === "all" ? "ck-msgr-tick ck-msgr-tick-read" : "ck-msgr-tick"
                          }
                          role="img"
                          aria-label={labels.read}
                        >
                          <IconChecks />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {awaited.map((entry) => {
            const agent = agents.find((a) => a.id === entry.agentId);
            if (!agent) return null;
            return (
              <div
                key={entry.agentId}
                className="ck-msgr-run ck-msgr-other ck-msgr-from-agent ck-msgr-awaited"
                role="status"
              >
                <MessengerAvatar
                  name={agent.name}
                  src={agent.avatarUrl}
                  agent
                  size="sm"
                  fallback={agentMark ?? <IconAgent />}
                />
                {entry.state === "thinking" ? (
                  <span className="ck-msgr-waiting">
                    {labels.thinking.replace("{name}", agent.name)}
                    <Dots />
                  </span>
                ) : (
                  <span className="ck-msgr-waiting">
                    {labels.agentQuiet.replace("{name}", agent.name)}
                    {onDismissAgent && (
                      <button type="button" onClick={() => onDismissAgent(agent.id)}>
                        {labels.dismiss}
                      </button>
                    )}
                  </span>
                )}
              </div>
            );
          })}
          {typingNames.length > 0 && (
            <div className="ck-msgr-typing" role="status">
              <Dots />
              <span>{typingLabel(typingNames, labels.typing)}</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      {!following && messages.length > 0 && (
        <button
          type="button"
          className="ck-jump"
          onClick={jumpToBottom}
          aria-label={labels.jump}
          title={labels.jump}
        >
          <IconArrowDown />
        </button>
      )}
    </div>
  );
}
