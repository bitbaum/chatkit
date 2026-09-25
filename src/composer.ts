/**
 * The composer's decisions, kept out of the component so they can be tested
 * without a DOM — and so every app that uses the one composer gets exactly the
 * same answer to "may this send?" and "does the draft survive?".
 *
 * From loki `src/components/composer/composer-logic.ts`, where these were
 * written after four composers in one app gave four different answers.
 */

/** A destination the same words can go to (e.g. Ask vs Inject). */
export type ComposerMode = { id: string; label: string; hint?: string };

/** `false` keeps the draft (the send failed or was refused); anything else
 *  clears it. A failed send must be retryable from the same box, not retyped. */
export type ComposerSendResult = void | boolean;

export function composerCanSend({
  text,
  attachmentCount,
  attachmentOnlyText,
  sending,
  disabled,
  blocked,
}: {
  text: string;
  attachmentCount: number;
  attachmentOnlyText?: string;
  sending: boolean;
  disabled: boolean;
  blocked: boolean;
}): boolean {
  if (sending || disabled || blocked) return false;
  if (text.trim().length > 0) return true;
  // A screenshot with no words is still a complete message — but only where
  // the app has said what that message means.
  return attachmentCount > 0 && Boolean(attachmentOnlyText);
}

/** The words actually sent: the draft, or the app's stand-in for an
 *  attachments-only send. */
export function composerOutgoingText(
  text: string,
  attachmentCount: number,
  attachmentOnlyText?: string,
): string {
  const trimmed = text.trim();
  if (trimmed) return trimmed;
  return attachmentCount > 0 && attachmentOnlyText ? attachmentOnlyText : "";
}

export function shouldClearDraft(result: ComposerSendResult): boolean {
  return result !== false;
}

/** Dictated words join the draft with one space, never glued to the last word. */
export function appendTranscript(draft: string, said: string): string {
  const t = said.trim();
  if (!t) return draft;
  return draft.trim() ? `${draft.replace(/\s+$/, "")} ${t}` : t;
}

/** `75` → `1:15`. The recording timer. */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
