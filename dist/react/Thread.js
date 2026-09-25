"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Markdown, defaultRenderLink } from "./Markdown.js";
import { useClipboard, useStickToBottom } from "./hooks.js";
import { IconArrowDown, IconCheck, IconCopy, IconRetry, IconStop } from "./icons.js";
export const DEFAULT_THREAD_LABELS = {
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
export function ChatMessage({ message, onRetry, renderLink = defaultRenderLink, showSpeaker = true, footer, last = false, labels = DEFAULT_THREAD_LABELS, }) {
    const { copied, copy } = useClipboard();
    if (message.role === "user") {
        return (_jsx("div", { className: "ck-turn ck-turn-user", children: _jsx("div", { className: "ck-bubble", children: message.content }) }));
    }
    const cls = ["ck-turn", "ck-turn-answer"];
    if (message.speaker?.id)
        cls.push(`ck-from-${message.speaker.id}`);
    // A failed turn and the latest answer never hide their buttons: Retry after
    // a failure is the one thing the reader needs, and a hover it cannot do on
    // a phone must not stand between them.
    if (last || message.failed)
        cls.push("ck-turn-pinned");
    return (_jsxs("div", { className: cls.join(" "), children: [showSpeaker && message.speaker && _jsx("span", { className: "ck-speaker", children: message.speaker.name }), message.failed ? (_jsx("p", { className: "ck-failed", role: "status", children: message.content || labels.failed })) : (_jsx(Markdown, { text: message.content, citations: message.citations, renderLink: renderLink })), footer, _jsxs("div", { className: "ck-turn-actions", children: [!message.failed && (_jsxs("button", { type: "button", className: "ck-action", onClick: () => copy(message.content), "aria-label": copied ? labels.copied : labels.copy, children: [copied ? _jsx(IconCheck, {}) : _jsx(IconCopy, {}), _jsx("span", { children: copied ? labels.copied : labels.copy })] })), onRetry && (_jsxs("button", { type: "button", className: "ck-action", onClick: onRetry, children: [_jsx(IconRetry, {}), _jsx("span", { children: labels.retry })] }))] })] }));
}
/**
 * The conversation. Follows new tokens only while the reader is at the
 * bottom, with a button back down once they are not; a turn in flight can be
 * stopped from where it is being written.
 */
export function ChatThread({ messages, live = null, loading = false, stopped = false, onStop, onRetry, renderLink = defaultRenderLink, renderFooter, showSpeakers, empty, children, labels: labelOverrides, }) {
    const labels = { ...DEFAULT_THREAD_LABELS, ...labelOverrides };
    const { scrollRef, endRef, following, onScroll, jumpToBottom } = useStickToBottom([messages.length, live?.text, live?.status, stopped], messages.length);
    if (loading) {
        return (_jsx("div", { className: "ck-thread-loading", role: "status", children: labels.loading }));
    }
    if (messages.length === 0 && !live && !stopped)
        return _jsx(_Fragment, { children: empty ?? null });
    const speakers = new Set([...messages.map((m) => m.speaker?.name), live?.speaker?.name].filter(Boolean));
    const named = showSpeakers ?? speakers.size > 1;
    const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant");
    return (_jsxs("div", { className: "ck-thread-wrap", children: [_jsx("div", { ref: scrollRef, className: "ck-thread", onScroll: onScroll, children: _jsxs("div", { className: "ck-thread-inner", children: [messages.map((m) => (_jsx(ChatMessage, { message: m, onRetry: onRetry && m.id === lastAnswer?.id && !live ? onRetry : undefined, renderLink: renderLink, showSpeaker: named, footer: renderFooter?.(m), last: m.id === lastAnswer?.id, labels: labels }, m.id))), live && (_jsxs("div", { className: "ck-turn ck-turn-answer", children: [named && live.speaker && _jsx("span", { className: "ck-speaker", children: live.speaker.name }), live.text ? (_jsx(Markdown, { text: live.text, renderLink: renderLink })) : (_jsxs("p", { className: "ck-live", role: "status", "aria-live": "polite", children: [_jsxs("span", { className: "ck-dots", "aria-hidden": true, children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }), live.status ?? labels.working] })), onStop && (_jsxs("button", { type: "button", className: "ck-stop", onClick: onStop, children: [_jsx(IconStop, {}), labels.stop] }))] })), stopped && !live && (_jsx("p", { className: "ck-stopped", role: "status", children: labels.stopped })), children, _jsx("div", { ref: endRef })] }) }), !following && (_jsx("button", { type: "button", className: "ck-jump", onClick: jumpToBottom, "aria-label": labels.jump, title: labels.jump, children: _jsx(IconArrowDown, {}) }))] }));
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