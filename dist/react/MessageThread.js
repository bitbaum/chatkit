"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { clockTime, dayLabel, isAgent, linkify, needsNames, participantOf, quoteText, receiptOf, soleAgent, threadItems, typingLabel, } from "../messenger.js";
import { useStickToBottom } from "./hooks.js";
import { IconAgent, IconAlert, IconArrowDown, IconCheck, IconChecks, IconClock, IconMore, IconSpinner, } from "./icons.js";
import { Markdown, defaultRenderLink } from "./Markdown.js";
import { MessageAttachments, MessengerAvatar } from "./MessageAttachments.js";
import { DEFAULT_MESSENGER_LABELS } from "./messenger-labels.js";
const LONG_PRESS_MS = 420;
/** The message this one answers, above it. A button: it leads there. */
function Quote({ quote, name, text, label, onOpen, }) {
    return (_jsxs("button", { type: "button", className: "ck-msgr-quote", onClick: onOpen, title: label, "data-quote": quote.id, children: [_jsx("span", { className: "ck-msgr-quote-name ck-truncate", children: name }), _jsx("span", { className: "ck-msgr-quote-text ck-truncate", children: text })] }));
}
/** Something of value in the thread: one shape for every kind. */
function Card({ card, renderLink, children, }) {
    return (_jsxs("div", { className: "ck-msgr-card", "data-kind": card.kind, "data-tone": card.tone ?? "neutral", children: [_jsx("span", { className: "ck-msgr-card-title", children: card.title }), card.amount && _jsx("span", { className: "ck-msgr-card-amount", children: card.amount }), card.note && _jsx("span", { className: "ck-msgr-card-note", children: card.note }), card.status && _jsx("span", { className: "ck-msgr-card-status", children: card.status }), card.action &&
                renderLink({
                    href: card.action.href,
                    internal: card.action.href.startsWith("/"),
                    children: card.action.label,
                    className: "ck-msgr-btn ck-msgr-card-action",
                }), children] }));
}
/** A person's words: exactly as typed, with addresses made links. */
function PlainText({ text, renderLink }) {
    return (_jsx(_Fragment, { children: linkify(text).map((part, i) => part.type === "link" ? (_jsx("span", { children: renderLink({
                href: part.href,
                internal: false,
                className: "ck-msgr-link",
                children: part.text,
            }) }, i)) : (_jsx("span", { children: part.text }, i))) }));
}
function Dots() {
    return (_jsxs("span", { className: "ck-dots", "aria-hidden": "true", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }));
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
export function MessageThread({ conversation, viewerId, messages, agents = [], status = "ready", onReload, hasOlder = false, loadingOlder = false, olderFailed = false, onLoadOlder, unreadFrom = null, typing = [], awaited = [], onDismissAgent, onRetry, onDiscard, onAction, onReact, renderCardAction, onSeen, onFollowingChange, renderLink = defaultRenderLink, agentMark, locale, timeZone, labels = DEFAULT_MESSENGER_LABELS, }) {
    const items = useMemo(() => threadItems(messages, { viewerId, timeZone, unreadFrom }), [messages, viewerId, timeZone, unreadFrom]);
    const named = needsNames(conversation, viewerId);
    // When the viewer last wrote. It grows only when they send — never when
    // earlier messages (their own among them) load above: counting their
    // messages instead pulled the reader to the end of the thread every time a
    // page of history arrived (found by test/browser-messenger.mjs).
    const own = messages.reduce((latest, m) => (m.authorId === viewerId ? Math.max(latest, m.createdAt.getTime()) : latest), 0);
    const newest = messages[messages.length - 1];
    const { scrollRef, endRef, following, onScroll, jumpToBottom } = useStickToBottom([messages.length, newest?.id, newest?.delivery, typing.length, awaited.length, status], own);
    // Earlier messages arrive ABOVE what is being read. The reader's place is
    // kept by hand: not every browser anchors a scroller for us.
    const first = messages[0]?.id;
    const before = useRef({
        first,
        height: 0,
    });
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        const was = before.current;
        if (was.first !== undefined && first !== was.first && !following) {
            el.scrollTop += el.scrollHeight - was.height;
        }
        before.current = { first, height: el.scrollHeight };
    });
    // Reaching the top loads the page before it.
    const olderRef = useRef(null);
    const loadOlder = useRef(onLoadOlder);
    useEffect(() => {
        loadOlder.current = onLoadOlder;
    });
    useEffect(() => {
        const target = olderRef.current;
        const root = scrollRef.current;
        if (!target || !root || !hasOlder || loadingOlder || olderFailed)
            return;
        if (typeof IntersectionObserver === "undefined")
            return;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting))
                loadOlder.current?.();
        }, { root, rootMargin: "200px 0px 0px 0px" });
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
        if (following && status === "ready" && newest)
            seen.current?.();
    }, [following, status, newest?.id, newest]);
    const now = new Date();
    const nameOf = (actorId) => {
        const p = participantOf(conversation, actorId);
        return p?.name || agents.find((a) => a.id === actorId)?.name || p?.handle || "";
    };
    const press = useRef(null);
    const cancelPress = () => {
        if (press.current)
            clearTimeout(press.current);
        press.current = null;
    };
    useEffect(() => cancelPress, []);
    // A quote leads to its message when that message is loaded, and marks it
    // for a moment so the eye finds it.
    const showMessage = (id) => {
        const root = scrollRef.current;
        if (!root)
            return;
        for (const el of root.querySelectorAll("[data-message]")) {
            if (el.dataset.message !== id)
                continue;
            el.scrollIntoView({ block: "center" });
            el.classList.add("ck-msgr-found");
            setTimeout(() => el.classList.remove("ck-msgr-found"), 1600);
            return;
        }
    };
    const empty = status === "ready" && messages.length === 0;
    // Alone with an agent, every message is for it: no mention to explain.
    const alone = soleAgent(conversation, viewerId, agents);
    // An agent that is awaited already says it is thinking; one line, not two.
    const typingNames = typing
        .filter((id) => !awaited.some((w) => w.agentId === id))
        .map(nameOf)
        .filter(Boolean);
    return (_jsxs("div", { className: "ck-msgr-thread-wrap", children: [_jsx("div", { className: "ck-msgr-scroll", ref: scrollRef, onScroll: onScroll, role: "log", "aria-live": "polite", "aria-relevant": "additions", tabIndex: 0, children: _jsxs("div", { className: "ck-msgr-thread-inner", children: [hasOlder && messages.length > 0 && (_jsx("button", { ref: olderRef, type: "button", className: "ck-msgr-older", onClick: () => onLoadOlder?.(), disabled: loadingOlder, children: loadingOlder ? (_jsxs(_Fragment, { children: [_jsx(IconSpinner, {}), " ", labels.loadingOlder] })) : olderFailed ? (labels.olderFailed) : (labels.loadOlder) })), status === "loading" && messages.length === 0 && (_jsxs("div", { className: "ck-msgr-state", role: "status", children: [_jsx(IconSpinner, {}), _jsx("span", { className: "ck-msgr-sr", children: labels.loading })] })), status === "failed" && messages.length === 0 && (_jsxs("div", { className: "ck-msgr-state", role: "alert", children: [_jsx("p", { children: labels.threadFailed }), onReload && (_jsx("button", { type: "button", className: "ck-msgr-btn", onClick: onReload, children: labels.retry }))] })), empty && (_jsxs("div", { className: "ck-msgr-state", children: [_jsx("p", { children: labels.threadEmpty }), alone ? (_jsx("p", { className: "ck-msgr-hint", children: labels.agentDirect.replace("{name}", alone.name) })) : (agents.map((agent) => (_jsx("p", { className: "ck-msgr-hint", children: labels.agentHint
                                        .replace("{mention}", agent.mention)
                                        .replace("{name}", agent.name) }, agent.id))))] })), items.map((item) => {
                            if (item.type === "day") {
                                return (_jsx("div", { className: "ck-msgr-day", role: "separator", children: _jsx("span", { children: dayLabel(item.date, now, labels.days, locale, timeZone) }) }, item.key));
                            }
                            if (item.type === "unread") {
                                return (_jsx("div", { className: "ck-msgr-unread-line", role: "separator", children: _jsx("span", { children: labels.newMessages }) }, item.key));
                            }
                            const author = participantOf(conversation, item.authorId);
                            const agent = isAgent(conversation, item.authorId, agents);
                            const name = nameOf(item.authorId);
                            const face = !item.own && (named || agent);
                            const last = item.messages[item.messages.length - 1];
                            const forWhom = last.onBehalfOf ? nameOf(last.onBehalfOf) : "";
                            const time = clockTime(last.createdAt, locale, timeZone);
                            const pending = last.delivery === "sending";
                            const failed = item.messages.some((m) => m.delivery === "failed");
                            const receipt = item.own && !last.delivery ? receiptOf(conversation, last, agents) : null;
                            return (_jsxs("div", { className: [
                                    "ck-msgr-run",
                                    item.own ? "ck-msgr-own" : "ck-msgr-other",
                                    agent ? "ck-msgr-from-agent" : "",
                                ]
                                    .filter(Boolean)
                                    .join(" "), role: "group", "aria-label": `${item.own ? labels.you : name}, ${time}`, "data-author": item.authorId, children: [face && (_jsx(MessengerAvatar, { name: name, src: author?.avatarUrl ?? agents.find((a) => a.id === item.authorId)?.avatarUrl, agent: agent, size: "sm", fallback: agent ? (agentMark ?? _jsx(IconAgent, {})) : undefined })), _jsxs("div", { className: "ck-msgr-run-body", children: [face && (_jsxs("span", { className: agent ? "ck-speaker ck-speaker-agent" : "ck-speaker", children: [name, agent && _jsx("span", { className: "ck-speaker-kind", children: labels.agent }), agent && forWhom && (_jsxs("span", { className: "ck-speaker-for", children: [" · ", labels.onBehalfOf.replace("{name}", forWhom)] }))] })), item.messages.map((message) => {
                                                const actable = Boolean(onAction) && !message.delivery;
                                                return (_jsxs("div", { className: message.delivery
                                                        ? `ck-msgr-msg ck-msgr-${message.delivery}`
                                                        : "ck-msgr-msg", "data-message": message.id, onContextMenu: actable
                                                        ? (e) => {
                                                            e.preventDefault();
                                                            onAction?.(message);
                                                        }
                                                        : undefined, onTouchStart: actable
                                                        ? () => {
                                                            cancelPress();
                                                            press.current = setTimeout(() => onAction?.(message), LONG_PRESS_MS);
                                                        }
                                                        : undefined, onTouchMove: actable ? cancelPress : undefined, onTouchEnd: actable ? cancelPress : undefined, onTouchCancel: actable ? cancelPress : undefined, children: [message.replyTo && (_jsx(Quote, { quote: message.replyTo, name: message.replyTo.authorId === viewerId
                                                                ? labels.you
                                                                : nameOf(message.replyTo.authorId), text: quoteText(message.replyTo, labels.preview), label: labels.quoted, onOpen: () => showMessage(message.replyTo.id) })), message.card && (_jsx(Card, { card: message.card, renderLink: renderLink, children: renderCardAction?.(message.card, message) })), message.attachments && message.attachments.length > 0 && (_jsx(MessageAttachments, { attachments: message.attachments, labels: labels, caption: `${item.own ? labels.you : name} · ${clockTime(message.createdAt, locale, timeZone)}` })), message.body && (_jsx("div", { className: "ck-msgr-bubble", children: agent ? (_jsx(Markdown, { text: message.body, renderLink: renderLink, sources: false })) : (_jsx(PlainText, { text: message.body, renderLink: renderLink })) })), message.reactions && message.reactions.length > 0 && (_jsx("div", { className: "ck-msgr-reactions", children: message.reactions.map((reaction) => {
                                                                const mine = reaction.actorIds.includes(viewerId);
                                                                return (_jsxs("button", { type: "button", className: "ck-msgr-reaction", "aria-pressed": mine, disabled: !onReact || Boolean(message.delivery), onClick: () => onReact?.(message, reaction.emoji), "aria-label": labels.reactionCount
                                                                        .replace("{emoji}", reaction.emoji)
                                                                        .replace("{n}", String(reaction.actorIds.length)), title: reaction.actorIds.map(nameOf).filter(Boolean).join(", "), children: [_jsx("span", { "aria-hidden": true, children: reaction.emoji }), reaction.actorIds.length > 1 && (_jsx("span", { "aria-hidden": true, children: reaction.actorIds.length }))] }, reaction.emoji));
                                                            }) })), actable && (_jsx("button", { type: "button", className: "ck-msgr-act", onClick: () => onAction?.(message), "aria-label": labels.actions, title: labels.actions, children: _jsx(IconMore, {}) })), message.delivery === "failed" && (_jsxs("div", { className: "ck-msgr-failed-row", role: "alert", children: [_jsx(IconAlert, {}), _jsx("span", { children: labels.notSent }), onRetry && (_jsx("button", { type: "button", onClick: () => onRetry(message), children: labels.retrySend })), onDiscard && (_jsx("button", { type: "button", onClick: () => onDiscard(message), children: labels.discard }))] }))] }, message.id));
                                            }), !failed && (_jsxs("div", { className: "ck-msgr-meta", children: [_jsx("time", { dateTime: last.createdAt.toISOString(), children: time }), last.editedAt && _jsx("span", { children: labels.edited }), pending && (_jsx("span", { className: "ck-msgr-tick", role: "img", "aria-label": labels.sending, children: _jsx(IconClock, {}) })), receipt === "none" && (_jsx("span", { className: "ck-msgr-tick", role: "img", "aria-label": labels.sent, children: _jsx(IconCheck, {}) })), (receipt === "some" || receipt === "all") && (_jsx("span", { className: receipt === "all" ? "ck-msgr-tick ck-msgr-tick-read" : "ck-msgr-tick", role: "img", "aria-label": labels.read, children: _jsx(IconChecks, {}) }))] }))] })] }, item.key));
                        }), awaited.map((entry) => {
                            const agent = agents.find((a) => a.id === entry.agentId);
                            if (!agent)
                                return null;
                            return (_jsxs("div", { className: "ck-msgr-run ck-msgr-other ck-msgr-from-agent ck-msgr-awaited", role: "status", children: [_jsx(MessengerAvatar, { name: agent.name, src: agent.avatarUrl, agent: true, size: "sm", fallback: agentMark ?? _jsx(IconAgent, {}) }), entry.state === "thinking" ? (_jsxs("span", { className: "ck-msgr-waiting", children: [labels.thinking.replace("{name}", agent.name), _jsx(Dots, {})] })) : (_jsxs("span", { className: "ck-msgr-waiting", children: [labels.agentQuiet.replace("{name}", agent.name), onDismissAgent && (_jsx("button", { type: "button", onClick: () => onDismissAgent(agent.id), children: labels.dismiss }))] }))] }, entry.agentId));
                        }), typingNames.length > 0 && (_jsxs("div", { className: "ck-msgr-typing", role: "status", children: [_jsx(Dots, {}), _jsx("span", { children: typingLabel(typingNames, labels.typing) })] })), _jsx("div", { ref: endRef })] }) }), !following && messages.length > 0 && (_jsx("button", { type: "button", className: "ck-jump", onClick: jumpToBottom, "aria-label": labels.jump, title: labels.jump, children: _jsx(IconArrowDown, {}) }))] }));
}
//# sourceMappingURL=MessageThread.js.map