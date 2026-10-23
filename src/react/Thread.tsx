"use client";

import type { ReactNode } from "react";
import { Markdown, defaultRenderLink, type CitationMap, type RenderLink } from "./Markdown.js";
import { useStickToBottom } from "./hooks.js";
import { dropReplyLabel, extractReplies } from "../replies.js";
import type { Speaker } from "../speech.js";
import {
  AnswerActions,
  DEFAULT_ANSWER_ACTIONS_LABELS,
  type AnswerActionsLabels,
} from "./AnswerActions.js";
import type { AnswerFeedback } from "../review.js";
import type { RichRenderers } from "./renderers.js";
import { IconArrowDown, IconChevron, IconRetry, IconStop } from "./icons.js";

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
  /**
   * What the person is likely to say next, as one-tap buttons under the
   * latest answer. Leave it out and a `quick_replies` block in `content` is
   * used instead (see `REPLIES_INSTRUCTION`).
   */
  replies?: readonly string[];
  /**
   * What the model did before answering — "Thought for 3m 38s ›" with the
   * steps under it, the way the ChatGPT and Claude apps show it. Closed by
   * default; the answer is what the reader came for.
   */
  thinking?: Thinking;
};

export type ThinkingStep = {
  label: string;
  detail?: string;
};
export type Thinking = {
  /** How long it took, in milliseconds. */
  durationMs?: number;
  /** The steps, in order: searches, tool calls, reasoning in one line each. */
  steps?: readonly ThinkingStep[];
  /** A short summary of the reasoning, if the model gives one. */
  summary?: string;
};

/** "3m 38s", "42s", "1h 02m" — the ChatGPT app's unit words, so a product
 *  translating the labels still gets one shape. */
export function formatThinkingDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export type ThreadLabels = AnswerActionsLabels & {
  /** "Thought for {time}" — `{time}` is replaced; without a duration, `thought`. */
  thoughtFor: string;
  thought: string;
  thinking: string;
  working: string;
  stopped: string;
  jump: string;
  failed: string;
  loading: string;
  replies: string;
};

export const DEFAULT_THREAD_LABELS: ThreadLabels = {
  ...DEFAULT_ANSWER_ACTIONS_LABELS,
  thoughtFor: "Thought for {time}",
  thought: "What it did",
  thinking: "Thinking",
  working: "Working on it",
  stopped: "Stopped. Send it again to retry.",
  jump: "Jump to the latest message",
  failed: "That did not go through.",
  loading: "Loading conversation",
  replies: "Suggested replies",
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
  onReply,
  speaker,
  share,
  onFeedback,
  renderers,
  labels = DEFAULT_THREAD_LABELS,
}: {
  message: ChatMessageData;
  /** Thumbs under the answer; the product keeps and exports what it learns. */
  onFeedback?: (feedback: AnswerFeedback) => void;
  /** The app's drawing for chart blocks (`{ chart }`); without it, a table. */
  renderers?: RichRenderers;
  /** The app's voice for Listen (the browser's without it). */
  speaker?: Speaker | null;
  /** What Share hands to the system sheet. `false` hides Share. */
  share?: { title?: string; url?: string } | false;
  /** Send a suggested reply. Without it no reply buttons are shown. */
  onReply?: (text: string) => void;
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
  if (message.role === "user") {
    return (
      <div className="ck-turn ck-turn-user">
        <div className="ck-bubble">{message.content}</div>
      </div>
    );
  }

  const parsed = extractReplies(message.content);
  const replies = message.replies ?? parsed.replies;
  // Replies handed in by the app still get no heading drawn over them.
  if (message.replies && message.replies.length > 0) parsed.text = dropReplyLabel(parsed.text);
  const cls = ["ck-turn", "ck-turn-answer"];
  if (message.speaker?.id) cls.push(`ck-from-${message.speaker.id}`);
  // A failed turn and the latest answer never hide their buttons: Retry after
  // a failure is the one thing the reader needs, and a hover it cannot do on
  // a phone must not stand between them.
  if (last || message.failed) cls.push("ck-turn-pinned");
  return (
    <div className={cls.join(" ")}>
      {showSpeaker && message.speaker && <span className="ck-speaker">{message.speaker.name}</span>}
      {message.thinking && <ThinkingRow thinking={message.thinking} labels={labels} />}
      {message.failed ? (
        <p className="ck-failed" role="status">
          {message.content || labels.failed}
        </p>
      ) : (
        <Markdown
          text={parsed.text}
          citations={message.citations}
          renderLink={renderLink}
          onReply={last ? onReply : undefined}
          renderers={renderers}
        />
      )}
      {footer}
      {message.failed ? (
        onRetry && (
          <div className="ck-turn-actions">
            <button type="button" className="ck-action" onClick={onRetry}>
              <IconRetry />
              <span>{labels.retry}</span>
            </button>
          </div>
        )
      ) : (
        <AnswerActions
          text={parsed.text}
          onRetry={onRetry}
          speaker={speaker}
          share={share}
          labels={labels}
          messageId={message.id}
          onFeedback={onFeedback}
        />
      )}
      {last && onReply && !message.failed && replies.length > 0 && (
        <ChatReplies replies={replies} onPick={onReply} label={labels.replies} />
      )}
    </div>
  );
}

/**
 * The replies under an answer. Exported for apps that render their own
 * thread, so the buttons look and behave the same in every product.
 */
export function ChatReplies({
  replies,
  onPick,
  label = DEFAULT_THREAD_LABELS.replies,
  disabled = false,
}: {
  replies: readonly string[];
  onPick: (text: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  if (replies.length === 0) return null;
  return (
    <div className="ck-replies" role="group" aria-label={label}>
      {replies.map((r, i) => (
        // The first reply is the model's recommendation — what the person
        // would most likely say next — and is drawn as the lead, so "what do
        // I do now?" always has an answer under the answer.
        <button
          key={r}
          type="button"
          className={i === 0 ? "ck-reply ck-reply-lead" : "ck-reply"}
          disabled={disabled}
          onClick={() => onPick(r)}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

export type LiveTurn = {
  /** What has streamed in so far. */
  text?: string;
  /** What it is doing before the first word ("Reading the fleet map"). */
  status?: string;
  /** The steps so far, newest last; shown open while the turn runs. */
  steps?: readonly ThinkingStep[];
  speaker?: ChatSpeaker;
};

/**
 * "Thought for 3m 38s ›" above an answer, opening to the steps; while a turn
 * runs, the same row open with the steps arriving and the newest one marked.
 */
export function ThinkingRow({
  thinking,
  live = false,
  labels = DEFAULT_THREAD_LABELS,
}: {
  thinking: Thinking;
  live?: boolean;
  labels?: ThreadLabels;
}) {
  const steps = thinking.steps ?? [];
  if (!live && steps.length === 0 && !thinking.summary && thinking.durationMs === undefined)
    return null;
  const title = live
    ? labels.thinking
    : thinking.durationMs !== undefined
      ? labels.thoughtFor.replace("{time}", formatThinkingDuration(thinking.durationMs))
      : labels.thought;
  const body =
    steps.length > 0 || thinking.summary ? (
      <div className="ck-thinking-body">
        {thinking.summary && <p>{thinking.summary}</p>}
        {steps.length > 0 && (
          <ol className="ck-thinking-steps">
            {steps.map((step, i) => (
              <li
                key={i}
                className={live && i === steps.length - 1 ? "ck-thinking-now" : undefined}
              >
                <span>{step.label}</span>
                {step.detail && <small>{step.detail}</small>}
              </li>
            ))}
          </ol>
        )}
      </div>
    ) : null;
  if (live)
    return (
      <div className="ck-thinking ck-thinking-live" role="status" aria-live="polite">
        <span className="ck-thinking-title">
          <span className="ck-dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          {title}
        </span>
        {body}
      </div>
    );
  if (!body)
    return (
      <p className="ck-thinking">
        <span className="ck-thinking-title">{title}</span>
      </p>
    );
  return (
    <details className="ck-thinking">
      <summary className="ck-thinking-title">
        {title}
        <IconChevron />
      </summary>
      {body}
    </details>
  );
}

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
  onReply,
  renderLink = defaultRenderLink,
  renderFooter,
  showSpeakers,
  speaker,
  share,
  onFeedback,
  renderers,
  empty,
  children,
  labels: labelOverrides,
}: {
  messages: ChatMessageData[];
  /** Thumbs under every answer (chatkit's feedback loop, README). */
  onFeedback?: (feedback: AnswerFeedback) => void;
  /**
   * The app's drawing for chart blocks: `{ chart: (block) => <Chart … /> }`.
   * Without it (or when it returns null) chatkit shows the caption and a
   * table of the data. `ChatScreen renderers` sets the same for every answer.
   */
  renderers?: RichRenderers;
  /** The app's voice for Listen under every answer (the browser's without it). */
  speaker?: Speaker | null;
  /** What Share hands to the system sheet. `false` hides Share. */
  share?: { title?: string; url?: string } | false;
  live?: LiveTurn | null;
  loading?: boolean;
  /** The person stopped the last turn themselves. */
  stopped?: boolean;
  onStop?: () => void;
  /** Retry the last answer (offered on it, and on a failed one). */
  onRetry?: () => void;
  /**
   * Send a suggested reply — usually the same function the Composer's
   * `onSend` calls. Buttons appear under the latest answer only, and never
   * while a turn is in flight.
   */
  onReply?: (text: string) => void;
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
    [messages.length, live?.text, live?.status, live?.steps?.length, stopped],
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
              onReply={live || stopped ? undefined : onReply}
              speaker={speaker}
              share={share}
              onFeedback={onFeedback}
              renderers={renderers}
              labels={labels}
            />
          ))}
          {live && (
            <div className="ck-turn ck-turn-answer">
              {named && live.speaker && <span className="ck-speaker">{live.speaker.name}</span>}
              {live.steps && live.steps.length > 0 && (
                <ThinkingRow thinking={{ steps: live.steps }} live labels={labels} />
              )}
              {live.text ? (
                <Markdown
                  text={extractReplies(live.text, { streaming: true }).text}
                  renderLink={renderLink}
                  renderers={renderers}
                />
              ) : live.steps && live.steps.length > 0 ? null : (
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
