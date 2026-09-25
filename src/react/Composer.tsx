"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  appendTranscript,
  composerCanSend,
  composerOutgoingText,
  formatElapsed,
  shouldClearDraft,
  type ComposerMode,
  type ComposerSendResult,
} from "../composer.js";
import { DEFAULT_DICTATION_MESSAGES, type DictationProblem } from "../dictation.js";
import type { Attachment, AttachmentLimits } from "../attachments.js";
import { useDictation, type UseDictationOptions } from "./use-dictation.js";
import { useAttachments, type AttachmentsController } from "./use-attachments.js";
import { useAutoGrow } from "./hooks.js";
import {
  IconArrowUp,
  IconCheck,
  IconFile,
  IconMic,
  IconPaperclip,
  IconSpinner,
  IconStop,
  IconX,
} from "./icons.js";

export type ComposerLabels = {
  send: string;
  stop: string;
  voice: string;
  voiceStop: string;
  cancelRecording: string;
  confirmRecording: string;
  listening: string;
  transcribing: string;
  attach: string;
  remove: (name: string) => string;
  dismiss: string;
  dictation: Record<DictationProblem, string>;
};

export const DEFAULT_COMPOSER_LABELS: ComposerLabels = {
  send: "Send",
  stop: "Stop generating",
  voice: "Speak instead of typing",
  voiceStop: "Stop recording",
  cancelRecording: "Cancel recording",
  confirmRecording: "Done — use what I said",
  listening: "Listening…",
  transcribing: "Transcribing…",
  attach: "Attach a screenshot or file",
  remove: (name) => `Remove ${name}`,
  dismiss: "Dismiss",
  dictation: DEFAULT_DICTATION_MESSAGES,
};

export type ComposerVoice = Omit<UseDictationOptions, "onText">;

export type ComposerProps = {
  /** Deliver what was written. Return `false` (or resolve to it) to keep the
   *  draft — a failed send is retried from the same box, not retyped. */
  onSend: (
    text: string,
    attachments: Attachment[],
  ) => ComposerSendResult | Promise<ComposerSendResult>;
  placeholder: string;
  ariaLabel?: string;
  disabled?: boolean;
  /** Typing is fine, sending is not — shown as the send button's title. */
  sendBlockedReason?: string | null;
  sending?: boolean;
  /** Given, the send slot becomes Stop while `sending`: a turn you cannot
   *  cancel is what makes a slow answer feel broken. */
  onStop?: () => void;
  /** What an attachments-only send says. Omit and empty text cannot send. */
  attachmentOnlyText?: string;
  /** Attachments on, optionally with the app's own limits. Off by default:
   *  only offer what the app's API accepts. */
  attach?: boolean | Partial<AttachmentLimits>;
  /** The microphone. On by default. Pass `transcribeUrl` (or `transcribe`) so
   *  it still works where the browser recogniser does not — that fallback is
   *  what makes the mic never a dead button. `false` only for a surface that
   *  truly cannot take speech. */
  voice?: ComposerVoice | false;
  modes?: readonly ComposerMode[];
  mode?: string;
  onModeChange?: (id: string) => void;
  /** "/" typed into an empty composer — open a library instead of typing. */
  onEmptySlash?: () => void;
  value?: string;
  onValueChange?: (text: string) => void;
  defaultValue?: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  density?: "comfortable" | "compact";
  /** Outside the box, above it (suggestion chips). */
  above?: ReactNode;
  /** Inside the box, above the text (scope pills, an error). */
  header?: ReactNode;
  /** Extra tools after attach and voice (a model picker, a library). */
  tools?: ReactNode;
  /** Just before the send button. */
  trailing?: ReactNode;
  /** Inside the box, under the controls. */
  footer?: ReactNode;
  hint?: string;
  labels?: Partial<ComposerLabels>;
  autoFocus?: boolean;
};

function AttachmentStrip({
  attachments,
  labels,
}: {
  attachments: AttachmentsController;
  labels: ComposerLabels;
}) {
  if (attachments.attachments.length === 0 && !attachments.note) return null;
  return (
    <div className="ck-attach-strip">
      {attachments.attachments.map((a) => {
        const key = attachments.keyOf(a);
        return (
          <div key={key} className="ck-attach-item">
            {a.kind === "image" && a.previewUrl ? (
              <img src={a.previewUrl} alt={a.name} className="ck-attach-thumb" />
            ) : (
              <span className="ck-attach-file">
                <IconFile />
                <span className="ck-truncate">{a.name}</span>
              </span>
            )}
            <button
              type="button"
              className="ck-attach-remove"
              onClick={() => attachments.remove(key)}
              aria-label={labels.remove(a.name)}
              title={labels.remove(a.name)}
            >
              <IconX />
            </button>
          </div>
        );
      })}
      {attachments.note && (
        <button type="button" className="ck-note" onClick={attachments.clearNote}>
          {attachments.note}
        </button>
      )}
    </div>
  );
}

function Elapsed({ since }: { since: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [since]);
  return (
    <span className="ck-voice-timer">
      {formatElapsed(since === null ? 0 : (now - since) / 1000)}
    </span>
  );
}

/**
 * THE composer: write words — or say them, or paste a screenshot — and send
 * them. Enter sends, Shift+Enter breaks the line, an IME composition never
 * sends half a word. 16px text, so iOS never zooms the page on focus.
 *
 * Extracted from loki `components/composer/Composer.tsx` (itself the merge of
 * four composers in one app), with heidi's microphone and orangecat's lessons.
 */
export function Composer({
  onSend,
  placeholder,
  ariaLabel,
  disabled = false,
  sendBlockedReason = null,
  sending = false,
  onStop,
  attachmentOnlyText,
  attach = false,
  voice = {},
  modes,
  mode,
  onModeChange,
  onEmptySlash,
  value,
  onValueChange,
  defaultValue = "",
  inputRef,
  density = "comfortable",
  above,
  header,
  tools,
  trailing,
  footer,
  hint,
  labels: labelOverrides,
  autoFocus,
}: ComposerProps) {
  const labels: ComposerLabels = {
    ...DEFAULT_COMPOSER_LABELS,
    ...labelOverrides,
    dictation: { ...DEFAULT_COMPOSER_LABELS.dictation, ...labelOverrides?.dictation },
  };
  const [ownText, setOwnText] = useState(defaultValue);
  const controlled = value !== undefined;
  const text = controlled ? value : ownText;
  // Mirrored so an async send compares against the CURRENT draft, not the one
  // its closure captured. Written in an effect, never during render.
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  });
  const setText = (next: string | ((prev: string) => string)) => {
    const resolved = typeof next === "function" ? next(textRef.current) : next;
    textRef.current = resolved;
    if (!controlled) setOwnText(resolved);
    onValueChange?.(resolved);
  };

  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = inputRef ?? localRef;
  useAutoGrow(textareaRef, text);

  const attachOn = attach !== false;
  const attachments = useAttachments(typeof attach === "object" ? attach : {});

  const dictation = useDictation({
    ...(voice || {}),
    onText: (said) => setText((prev) => appendTranscript(prev, said)),
  });
  const voiceOn = voice !== false && dictation.supported;
  const listening = dictation.status === "listening";
  const transcribing = dictation.status === "transcribing";

  const attachCount = attachOn ? attachments.attachments.length : 0;
  const canSend = composerCanSend({
    text,
    attachmentCount: attachCount,
    attachmentOnlyText,
    sending,
    disabled,
    blocked: Boolean(sendBlockedReason),
  });

  const submit = async () => {
    if (!canSend) return;
    const sent = text;
    const outgoing = composerOutgoingText(sent, attachCount, attachmentOnlyText);
    const result = await onSend(outgoing, attachOn ? attachments.toWire() : []);
    if (!shouldClearDraft(result)) return;
    // Only clear what was sent: words typed while a slow send was in flight
    // are the next message.
    if (textRef.current === sent) setText("");
    attachments.clear();
  };

  const fileInput = useRef<HTMLInputElement>(null);
  const showModes = Boolean(modes && modes.length > 1);

  return (
    <div className="ck-composer-wrap">
      {above}
      <div className="ck-composer-frame">
        {(listening || transcribing) && (
          <div className="ck-voice-bar" role="status" aria-live="polite">
            {listening ? (
              <>
                <span className="ck-voice-dot" aria-hidden />
                <span className="ck-voice-wave" aria-hidden>
                  {Array.from({ length: 9 }).map((_, i) => (
                    <span key={i} />
                  ))}
                </span>
                <Elapsed since={dictation.startedAt} />
                <button
                  type="button"
                  className="ck-icon-btn"
                  onClick={dictation.cancel}
                  aria-label={labels.cancelRecording}
                  title={labels.cancelRecording}
                >
                  <IconX />
                </button>
                <button
                  type="button"
                  className="ck-voice-confirm"
                  onClick={dictation.stop}
                  aria-label={labels.confirmRecording}
                  title={labels.confirmRecording}
                >
                  <IconCheck />
                </button>
              </>
            ) : (
              <>
                <IconSpinner />
                <span className="ck-voice-timer">{labels.transcribing}</span>
              </>
            )}
          </div>
        )}

        <div className={density === "compact" ? "ck-composer ck-composer-compact" : "ck-composer"}>
          {showModes && (
            <div className="ck-modes" role="group">
              {modes!.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="ck-mode"
                  aria-pressed={m.id === mode}
                  title={m.hint}
                  onClick={() => onModeChange?.(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {header}

          <textarea
            ref={textareaRef}
            className="ck-input"
            rows={1}
            value={text}
            autoFocus={autoFocus}
            disabled={disabled || transcribing}
            placeholder={listening ? labels.listening : placeholder}
            aria-label={ariaLabel ?? placeholder}
            enterKeyHint="send"
            onChange={(e) => {
              const next = e.target.value;
              if (onEmptySlash && next === "/" && text === "") {
                onEmptySlash();
                return;
              }
              setText(next);
            }}
            onPaste={(e) => {
              if (attachOn && attachments.addFromPaste(e)) e.preventDefault();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
          />

          {attachOn && <AttachmentStrip attachments={attachments} labels={labels} />}

          <div className="ck-actions">
            <div className="ck-tools">
              {attachOn && (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    hidden
                    accept="image/*,text/*,.md,.txt,.json,.csv,.log"
                    onChange={(e) => {
                      attachments.addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className="ck-icon-btn"
                    onClick={() => fileInput.current?.click()}
                    disabled={disabled || attachments.full}
                    aria-label={labels.attach}
                    title={labels.attach}
                  >
                    <IconPaperclip />
                  </button>
                </>
              )}
              {voiceOn && (
                <button
                  type="button"
                  className={listening ? "ck-icon-btn ck-mic ck-mic-on" : "ck-icon-btn ck-mic"}
                  onClick={dictation.toggle}
                  disabled={disabled || transcribing}
                  aria-label={listening ? labels.voiceStop : labels.voice}
                  aria-pressed={listening}
                  title={listening ? labels.voiceStop : labels.voice}
                >
                  {transcribing ? <IconSpinner /> : <IconMic />}
                </button>
              )}
              {tools}
              {hint && <span className="ck-hint">{hint}</span>}
            </div>
            <div className="ck-submit">
              {trailing}
              {/* Send and Stop share ONE slot, so the button you want never
                  moves depending on state. */}
              {sending && onStop ? (
                <button
                  type="button"
                  className="ck-send ck-send-stop"
                  onClick={onStop}
                  aria-label={labels.stop}
                  title={labels.stop}
                >
                  <IconStop />
                </button>
              ) : (
                !listening && (
                  <button
                    type="button"
                    className="ck-send"
                    disabled={!canSend}
                    onClick={() => void submit()}
                    aria-label={labels.send}
                    title={sendBlockedReason ?? labels.send}
                  >
                    {sending ? <IconSpinner /> : <IconArrowUp />}
                  </button>
                )
              )}
            </div>
          </div>
          {footer}
        </div>
      </div>
      {dictation.problem && (
        <p className="ck-problem" role="status">
          <span>{labels.dictation[dictation.problem]}</span>
          <button
            type="button"
            className="ck-problem-x"
            onClick={dictation.clearProblem}
            aria-label={labels.dismiss}
          >
            <IconX />
          </button>
        </p>
      )}
    </div>
  );
}
