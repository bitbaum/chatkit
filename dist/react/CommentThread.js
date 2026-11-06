"use client";
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { createElement, useId, useState } from "react";
import { Composer } from "./Composer.js";
export const DEFAULT_COMMENT_THREAD_LABELS = {
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
function defaultTime(locale, timeZone) {
    const fmt = new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timeZone ?? "UTC",
    });
    return (at) => fmt.format(at);
}
/**
 * The conversation under anything: an article, a page, a listing. Comments
 * read oldest first, the box is chatkit's `Composer` (so it has the
 * microphone, 16px text and Enter-to-send like every other box in the fleet),
 * and a person can remove what they wrote. Reading needs nothing; writing
 * needs `viewer`, and a signed-out reader is shown the way to sign in on the
 * same screen, never a dead end.
 */
export function CommentThread({ comments, transport, viewer, signInHref, canRemove, voice, formatTime, locale, timeZone, headingLevel = 2, labels: overrides, className, }) {
    const labels = { ...DEFAULT_COMMENT_THREAD_LABELS, ...overrides };
    const [list, setList] = useState(() => [...comments]);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const headingId = useId();
    const time = formatTime ?? defaultTime(locale, timeZone);
    const post = async (text) => {
        setError(null);
        setSending(true);
        try {
            const created = await transport.post(text);
            setList((current) => [...current, created]);
            return true;
        }
        catch {
            setError(labels.postFailed);
            return false;
        }
        finally {
            setSending(false);
        }
    };
    const remove = async (id) => {
        if (!transport.remove)
            return;
        setError(null);
        const before = list;
        setList((current) => current.filter((c) => c.id !== id));
        try {
            await transport.remove(id);
        }
        catch {
            setList(before);
            setError(labels.removeFailed);
        }
    };
    const heading = createElement(`h${headingLevel}`, { id: headingId, className: "ck-comments-title" }, labels.count(list.length));
    return (_jsxs("section", { className: className ? `ck-comments ${className}` : "ck-comments", "aria-labelledby": headingId, children: [heading, list.length > 0 && (_jsx("ol", { className: "ck-comment-list", children: list.map((c) => {
                    const at = new Date(c.createdAt);
                    return (_jsxs("li", { className: "ck-comment", children: [_jsxs("p", { className: "ck-comment-meta", children: [_jsx("strong", { children: c.author }), _jsx("span", { "aria-hidden": true, children: " \u00B7 " }), _jsx("time", { dateTime: at.toISOString(), children: time(at) }), transport.remove && canRemove?.(c) && (_jsxs(_Fragment, { children: [_jsx("span", { "aria-hidden": true, children: " \u00B7 " }), _jsx("button", { type: "button", className: "ck-comment-remove", onClick: () => void remove(c.id), children: labels.remove })] }))] }), _jsx("p", { className: "ck-comment-body", children: c.body })] }, c.id));
                }) })), error && (_jsx("p", { className: "ck-problem", role: "alert", children: _jsx("span", { children: error }) })), viewer ? (_jsx("div", { className: "ck-comment-box", children: _jsx(Composer, { onSend: post, placeholder: labels.placeholder, ariaLabel: labels.ariaLabel, sending: sending, value: draft, onValueChange: setDraft, attach: false, voice: voice, labels: { send: labels.send }, hint: labels.postedAs(viewer.name) }) })) : (signInHref && (_jsx("p", { className: "ck-comment-signin", children: _jsx("a", { className: "ck-comment-signin-link", href: signInHref, children: labels.signIn }) })))] }));
}
//# sourceMappingURL=CommentThread.js.map