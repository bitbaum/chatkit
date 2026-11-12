"use client";

import { createElement, useId, useState, type ReactNode } from "react";
import { Composer, type ComposerVoice } from "./Composer.js";

export type CommentItem = {
  id: string;
  /** The name readers see. */
  author: string;
  /** Plain text; line breaks are kept. */
  body: string;
  createdAt: string | number | Date;
};

/**
 * Where comments go. The component owns the list, the optimistic removal and
 * every failure message; the app owns the database and who may do what.
 */
export type CommentTransport = {
  /**
   * Store the comment and return it as stored (its id, its author, its time).
   * Throw to refuse: a `CommentRefused` with the reason the reader should see.
   */
  post: (text: string) => Promise<CommentItem>;
  /** Delete one. Omit and nobody gets a Remove button. */
  remove?: (id: string) => Promise<void>;
};

/**
 * Throw this from `transport.post` or `transport.remove` to say why in the
 * reader's words: the thread shows `message` under the box instead of its
 * generic `postFailed` / `removeFailed`, so "Write a longer comment" or "You
 * have posted a lot this hour" reaches the reader rather than "try again",
 * which would fail the same way forever. Any other error shows the label: a
 * raw `TypeError` or a server's English is never shown (the same rule as
 * `ChatTurnError`).
 */
export class CommentRefused extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "CommentRefused";
  }
}

/** What a failed post or removal says: a `CommentRefused`'s words, else the label. */
export function commentFailure(error: unknown, fallback: string): string {
  return error instanceof CommentRefused && error.message.trim() ? error.message : fallback;
}

export type CommentThreadLabels = {
  /** The heading: "No comments yet", "1 comment", "7 comments". */
  count: (n: number) => string;
  placeholder: string;
  ariaLabel: string;
  send: string;
  signIn: string;
  remove: string;
  postFailed: string;
  removeFailed: string;
  postedAs: (name: string) => string;
};

export const DEFAULT_COMMENT_THREAD_LABELS: CommentThreadLabels = {
  count: (n) => (n === 0 ? "No comments yet" : n === 1 ? "1 comment" : `${n} comments`),
  placeholder: "Say something about this…",
  ariaLabel: "Write a comment",
  send: "Comment",
  signIn: "Sign in to comment",
  remove: "Remove",
  postFailed: "The comment could not be posted. Your text is still in the box; try again.",
  removeFailed: "The comment could not be removed. Try again.",
  postedAs: (name) => `Posted as ${name}.`,
};

export type CommentThreadProps = {
  /** The comments as loaded, oldest first. Re-mount (a `key`) to load a new set. */
  comments: readonly CommentItem[];
  transport: CommentTransport;
  /** Who is looking. `null`: readers see the thread and a sign-in link, not the box. */
  viewer: { name: string } | null;
  /** Where "Sign in to comment" goes. Required for a signed-out reader to have a way forward. */
  signInHref?: string;
  /** Who may remove which comment (its author; the page's owner). Default: nobody. */
  canRemove?: (comment: CommentItem) => boolean;
  /** The microphone of the box. Pass `{ transcribeUrl }` for the server leg. */
  voice?: ComposerVoice | false;
  /**
   * How a time reads. Default: `locale` in `timeZone` (UTC when none is given,
   * so the server's and the browser's markup agree). Pass your own to match
   * the rest of the product.
   */
  formatTime?: (at: Date) => string;
  locale?: string;
  timeZone?: string;
  /** Heading level. Default 2. */
  headingLevel?: 2 | 3 | 4;
  labels?: Partial<CommentThreadLabels>;
  className?: string;
};

function defaultTime(locale: string | undefined, timeZone: string | undefined) {
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timeZone ?? "UTC",
  });
  return (at: Date) => fmt.format(at);
}

/**
 * The conversation under anything: an article, a page, a listing. Comments
 * read oldest first, the box is chatkit's `Composer` (so it has the
 * microphone, 16px text and Enter-to-send like every other box in the fleet),
 * and a person can remove what they wrote. Reading needs nothing; writing
 * needs `viewer`, and a signed-out reader is shown the way to sign in on the
 * same screen, never a dead end.
 */
export function CommentThread({
  comments,
  transport,
  viewer,
  signInHref,
  canRemove,
  voice,
  formatTime,
  locale,
  timeZone,
  headingLevel = 2,
  labels: overrides,
  className,
}: CommentThreadProps) {
  const labels: CommentThreadLabels = { ...DEFAULT_COMMENT_THREAD_LABELS, ...overrides };
  const [list, setList] = useState<CommentItem[]>(() => [...comments]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();
  const time = formatTime ?? defaultTime(locale, timeZone);

  const post = async (text: string): Promise<boolean> => {
    setError(null);
    setSending(true);
    try {
      const created = await transport.post(text);
      setList((current) => [...current, created]);
      return true;
    } catch (e) {
      setError(commentFailure(e, labels.postFailed));
      return false;
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    if (!transport.remove) return;
    setError(null);
    const before = list;
    setList((current) => current.filter((c) => c.id !== id));
    try {
      await transport.remove(id);
    } catch (e) {
      setList(before);
      setError(commentFailure(e, labels.removeFailed));
    }
  };

  const heading: ReactNode = createElement(
    `h${headingLevel}`,
    { id: headingId, className: "ck-comments-title" },
    labels.count(list.length),
  );

  return (
    <section
      className={className ? `ck-comments ${className}` : "ck-comments"}
      aria-labelledby={headingId}
    >
      {heading}
      {list.length > 0 && (
        <ol className="ck-comment-list">
          {list.map((c) => {
            const at = new Date(c.createdAt);
            return (
              <li key={c.id} className="ck-comment">
                <p className="ck-comment-meta">
                  <strong>{c.author}</strong>
                  <span aria-hidden> · </span>
                  <time dateTime={at.toISOString()}>{time(at)}</time>
                  {transport.remove && canRemove?.(c) && (
                    <>
                      <span aria-hidden> · </span>
                      <button
                        type="button"
                        className="ck-comment-remove"
                        onClick={() => void remove(c.id)}
                      >
                        {labels.remove}
                      </button>
                    </>
                  )}
                </p>
                <p className="ck-comment-body">{c.body}</p>
              </li>
            );
          })}
        </ol>
      )}
      {error && (
        <p className="ck-problem" role="alert">
          <span>{error}</span>
        </p>
      )}
      {viewer ? (
        <div className="ck-comment-box">
          <Composer
            onSend={post}
            placeholder={labels.placeholder}
            ariaLabel={labels.ariaLabel}
            sending={sending}
            value={draft}
            onValueChange={setDraft}
            attach={false}
            voice={voice}
            labels={{ send: labels.send }}
            hint={labels.postedAs(viewer.name)}
          />
        </div>
      ) : (
        signInHref && (
          <p className="ck-comment-signin">
            <a className="ck-comment-signin-link" href={signInHref}>
              {labels.signIn}
            </a>
          </p>
        )
      )}
    </section>
  );
}
