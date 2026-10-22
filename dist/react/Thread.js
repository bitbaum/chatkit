"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Markdown, defaultRenderLink } from "./Markdown.js";
import { useStickToBottom } from "./hooks.js";
import { extractReplies } from "../replies.js";
import { AnswerActions, DEFAULT_ANSWER_ACTIONS_LABELS, } from "./AnswerActions.js";
import { IconArrowDown, IconChevron, IconRetry, IconStop } from "./icons.js";
/** "3m 38s", "42s", "1h 02m" — the ChatGPT app's unit words, so a product
 *  translating the labels still gets one shape. */
export function formatThinkingDuration(ms) {
    const s = Math.max(1, Math.round(ms / 1000));
    if (s < 60)
        return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60)
        return `${m}m ${String(s % 60).padStart(2, "0")}s`;
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
export const DEFAULT_THREAD_LABELS = {
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
export function ChatMessage({ message, onRetry, renderLink = defaultRenderLink, showSpeaker = true, footer, last = false, onReply, speaker, share, onFeedback, labels = DEFAULT_THREAD_LABELS, }) {
    if (message.role === "user") {
        return (_jsx("div", { className: "ck-turn ck-turn-user", children: _jsx("div", { className: "ck-bubble", children: message.content }) }));
    }
    const parsed = extractReplies(message.content);
    const replies = message.replies ?? parsed.replies;
    const cls = ["ck-turn", "ck-turn-answer"];
    if (message.speaker?.id)
        cls.push(`ck-from-${message.speaker.id}`);
    // A failed turn and the latest answer never hide their buttons: Retry after
    // a failure is the one thing the reader needs, and a hover it cannot do on
    // a phone must not stand between them.
    if (last || message.failed)
        cls.push("ck-turn-pinned");
    return (_jsxs("div", { className: cls.join(" "), children: [showSpeaker && message.speaker && _jsx("span", { className: "ck-speaker", children: message.speaker.name }), message.thinking && _jsx(ThinkingRow, { thinking: message.thinking, labels: labels }), message.failed ? (_jsx("p", { className: "ck-failed", role: "status", children: message.content || labels.failed })) : (_jsx(Markdown, { text: parsed.text, citations: message.citations, renderLink: renderLink, onReply: last ? onReply : undefined })), footer, message.failed ? (onRetry && (_jsx("div", { className: "ck-turn-actions", children: _jsxs("button", { type: "button", className: "ck-action", onClick: onRetry, children: [_jsx(IconRetry, {}), _jsx("span", { children: labels.retry })] }) }))) : (_jsx(AnswerActions, { text: parsed.text, onRetry: onRetry, speaker: speaker, share: share, labels: labels, messageId: message.id, onFeedback: onFeedback })), last && onReply && !message.failed && replies.length > 0 && (_jsx(ChatReplies, { replies: replies, onPick: onReply, label: labels.replies }))] }));
}
/**
 * The replies under an answer. Exported for apps that render their own
 * thread, so the buttons look and behave the same in every product.
 */
export function ChatReplies({ replies, onPick, label = DEFAULT_THREAD_LABELS.replies, disabled = false, }) {
    if (replies.length === 0)
        return null;
    return (_jsx("div", { className: "ck-replies", role: "group", "aria-label": label, children: replies.map((r, i) => (_jsx("button", { type: "button", className: i === 0 ? "ck-reply ck-reply-lead" : "ck-reply", disabled: disabled, onClick: () => onPick(r), children: r }, r))) }));
}
/**
 * "Thought for 3m 38s ›" above an answer, opening to the steps; while a turn
 * runs, the same row open with the steps arriving and the newest one marked.
 */
export function ThinkingRow({ thinking, live = false, labels = DEFAULT_THREAD_LABELS, }) {
    const steps = thinking.steps ?? [];
    if (!live && steps.length === 0 && !thinking.summary && thinking.durationMs === undefined)
        return null;
    const title = live
        ? labels.thinking
        : thinking.durationMs !== undefined
            ? labels.thoughtFor.replace("{time}", formatThinkingDuration(thinking.durationMs))
            : labels.thought;
    const body = steps.length > 0 || thinking.summary ? (_jsxs("div", { className: "ck-thinking-body", children: [thinking.summary && _jsx("p", { children: thinking.summary }), steps.length > 0 && (_jsx("ol", { className: "ck-thinking-steps", children: steps.map((step, i) => (_jsxs("li", { className: live && i === steps.length - 1 ? "ck-thinking-now" : undefined, children: [_jsx("span", { children: step.label }), step.detail && _jsx("small", { children: step.detail })] }, i))) }))] })) : null;
    if (live)
        return (_jsxs("div", { className: "ck-thinking ck-thinking-live", role: "status", "aria-live": "polite", children: [_jsxs("span", { className: "ck-thinking-title", children: [_jsxs("span", { className: "ck-dots", "aria-hidden": true, children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }), title] }), body] }));
    if (!body)
        return (_jsx("p", { className: "ck-thinking", children: _jsx("span", { className: "ck-thinking-title", children: title }) }));
    return (_jsxs("details", { className: "ck-thinking", children: [_jsxs("summary", { className: "ck-thinking-title", children: [title, _jsx(IconChevron, {})] }), body] }));
}
/**
 * The conversation. Follows new tokens only while the reader is at the
 * bottom, with a button back down once they are not; a turn in flight can be
 * stopped from where it is being written.
 */
export function ChatThread({ messages, live = null, loading = false, stopped = false, onStop, onRetry, onReply, renderLink = defaultRenderLink, renderFooter, showSpeakers, speaker, share, onFeedback, empty, children, labels: labelOverrides, }) {
    const labels = { ...DEFAULT_THREAD_LABELS, ...labelOverrides };
    const { scrollRef, endRef, following, onScroll, jumpToBottom } = useStickToBottom([messages.length, live?.text, live?.status, live?.steps?.length, stopped], messages.length);
    if (loading) {
        return (_jsx("div", { className: "ck-thread-loading", role: "status", children: labels.loading }));
    }
    if (messages.length === 0 && !live && !stopped)
        return _jsx(_Fragment, { children: empty ?? null });
    const speakers = new Set([...messages.map((m) => m.speaker?.name), live?.speaker?.name].filter(Boolean));
    const named = showSpeakers ?? speakers.size > 1;
    const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant");
    return (_jsxs("div", { className: "ck-thread-wrap", children: [_jsx("div", { ref: scrollRef, className: "ck-thread", onScroll: onScroll, children: _jsxs("div", { className: "ck-thread-inner", children: [messages.map((m) => (_jsx(ChatMessage, { message: m, onRetry: onRetry && m.id === lastAnswer?.id && !live ? onRetry : undefined, renderLink: renderLink, showSpeaker: named, footer: renderFooter?.(m), last: m.id === lastAnswer?.id, onReply: live || stopped ? undefined : onReply, speaker: speaker, share: share, onFeedback: onFeedback, labels: labels }, m.id))), live && (_jsxs("div", { className: "ck-turn ck-turn-answer", children: [named && live.speaker && _jsx("span", { className: "ck-speaker", children: live.speaker.name }), live.steps && live.steps.length > 0 && (_jsx(ThinkingRow, { thinking: { steps: live.steps }, live: true, labels: labels })), live.text ? (_jsx(Markdown, { text: extractReplies(live.text).text, renderLink: renderLink })) : live.steps && live.steps.length > 0 ? null : (_jsxs("p", { className: "ck-live", role: "status", "aria-live": "polite", children: [_jsxs("span", { className: "ck-dots", "aria-hidden": true, children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }), live.status ?? labels.working] })), onStop && (_jsxs("button", { type: "button", className: "ck-stop", onClick: onStop, children: [_jsx(IconStop, {}), labels.stop] }))] })), stopped && !live && (_jsx("p", { className: "ck-stopped", role: "status", children: labels.stopped })), children, _jsx("div", { ref: endRef })] }) }), !following && (_jsx("button", { type: "button", className: "ck-jump", onClick: jumpToBottom, "aria-label": labels.jump, title: labels.jump, children: _jsx(IconArrowDown, {}) }))] }));
}
/** The empty state that starts a conversation. It disappears once one has. */
export function ChatStarters({ starters, onPick, title, }) {
    return (_jsxs("div", { className: "ck-starters", children: [title && _jsx("div", { className: "ck-starters-title", children: title }), _jsx("div", { className: "ck-starters-list", children: starters.map((s, i) => {
                    const label = typeof s === "string" ? s : s.label;
                    const prompt = typeof s === "string" ? s : (s.prompt ?? s.label);
                    return (_jsx("button", { type: "button", className: "ck-starter", onClick: () => onPick(prompt), children: label }, i));
                }) })] }));
}
//# sourceMappingURL=Thread.js.map