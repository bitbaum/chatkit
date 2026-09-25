"use client";

import type { ReactNode } from "react";
import { Markdown, defaultRenderLink, type CitationMap, type RenderLink } from "./Markdown.js";
import { useClipboard, useStickToBottom } from "./hooks.js";
import { IconArrowDown, IconCheck, IconCopy, IconRetry, IconStop } from "./icons.js";

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

export const DEFAULT_THREAD_LABELS: ThreadLabels = {
  copy: "Copy",
  copied: "Copied",
  retry: "Try again",
  stop: "Stop",
  working: "Working on it",
  stopped: "Stopped. Send it again to retry.",
  jump: "Jump to the latest message",
  failed: "That did not go through.",
  loading: "Loading conversation",
};

/**
 * One turn. The asymmetry is deliberate: the person's own words get a pill —
 * a short aside they already know — and the answer gets the full column with
 * no box, because it is the thing being READ. Copy is on every answer; Retry
 * only on the last one (retrying an older turn would fork the thread).
 */
export function ChatMessage({
  message,
  onRetry,
  renderLink = defaultRenderLink,
  showSpeaker = true,
  footer,
  last = false,
  labels = DEFAULT_THREAD_LABELS,
}: {
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
}) {
  const { copied, copy } = useClipboard();

  if (message.role === "user") {
    return (
      <div className="ck-turn ck-turn-user">
        <div className="ck-bubble">{message.content}</div>
      </div>
    );
  }

  const cls = ["ck-turn", "ck-turn-answer"];
  if (message.speaker?.id) cls.push(`ck-from-${message.speaker.id}`);
  // A failed turn and the latest answer never hide their buttons: Retry after
  // a failure is the one thing the reader needs, and a hover it cannot do on
  // a phone must not stand between them.
  if (last || message.failed) cls.push("ck-turn-pinned");
  return (
    <div className={cls.join(" ")}>
      {showSpeaker && message.speaker && <span className="ck-speaker">{message.speaker.name}</span>}
      {message.failed ? (
        <p className="ck-failed" role="status">
          {message.content || labels.failed}
        </p>
      ) : (
        <Markdown text={message.content} citations={message.citations} renderLink={renderLink} />
      )}
      {footer}
      <div className="ck-turn-actions">
        {!message.failed && (
          <button
            type="button"
            className="ck-action"
            onClick={() => copy(message.content)}
            aria-label={copied ? labels.copied : labels.copy}
          >
            {copied ? <IconCheck /> : <IconCopy />}
            <span>{copied ? labels.copied : labels.copy}</span>
          </button>
        )}
        {onRetry && (
          <button type="button" className="ck-action" onClick={onRetry}>
            <IconRetry />
            <span>{labels.retry}</span>
          </button>
        )}
      </div>
    </div>
  );
}

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
export function ChatThread({
  messages,
  live = null,
  loading = false,
  stopped = false,
  onStop,
  onRetry,
  renderLink = defaultRenderLink,
  renderFooter,
  showSpeakers,
  empty,
  children,
  labels: labelOverrides,
}: {
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
}) {
  const labels = { ...DEFAULT_THREAD_LABELS, ...labelOverrides };
  const { scrollRef, endRef, following, onScroll, jumpToBottom } = useStickToBottom(
    [messages.length, live?.text, live?.status, stopped],
    messages.length,
  );

  if (loading) {
    return (
      <div className="ck-thread-loading" role="status">
        {labels.loading}
      </div>
    );
  }
  if (messages.length === 0 && !live && !stopped) return <>{empty ?? null}</>;

  const speakers = new Set(
    [...messages.map((m) => m.speaker?.name), live?.speaker?.name].filter(Boolean),
  );
  const named = showSpeakers ?? speakers.size > 1;
  const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="ck-thread-wrap">
      <div ref={scrollRef} className="ck-thread" onScroll={onScroll}>
        <div className="ck-thread-inner">
          {messages.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              onRetry={onRetry && m.id === lastAnswer?.id && !live ? onRetry : undefined}
              renderLink={renderLink}
              showSpeaker={named}
              footer={renderFooter?.(m)}
              last={m.id === lastAnswer?.id}
              labels={labels}
            />
          ))}
          {live && (
            <div className="ck-turn ck-turn-answer">
              {named && live.speaker && <span className="ck-speaker">{live.speaker.name}</span>}
              {live.text ? (
                <Markdown text={live.text} renderLink={renderLink} />
              ) : (
                <p className="ck-live" role="status" aria-live="polite">
                  <span className="ck-dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                  {live.status ?? labels.working}
                </p>
              )}
              {onStop && (
                <button type="button" className="ck-stop" onClick={onStop}>
                  <IconStop />
                  {labels.stop}
                </button>
              )}
            </div>
          )}
          {stopped && !live && (
            <p className="ck-stopped" role="status">
              {labels.stopped}
            </p>
          )}
          {children}
          <div ref={endRef} />
        </div>
      </div>
      {!following && (
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

export type Starter = string | { label: string; prompt?: string };

/** The empty state that starts a conversation. It disappears once one has. */
export function ChatStarters({
  starters,
  onPick,
  title,
}: {
  starters: readonly Starter[];
  onPick: (prompt: string) => void;
  title?: ReactNode;
}) {
  return (
    <div className="ck-starters">
      {title && <div className="ck-starters-title">{title}</div>}
      <div className="ck-starters-list">
        {starters.map((s, i) => {
          const label = typeof s === "string" ? s : s.label;
          const prompt = typeof s === "string" ? s : (s.prompt ?? s.label);
          return (
            <button key={i} type="button" className="ck-starter" onClick={() => onPick(prompt)}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
