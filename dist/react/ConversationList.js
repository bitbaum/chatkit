"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { agentsPresent, conversationPreview, conversationTitle, listTime, otherPeople, searchConversations, typingLabel, } from "../messenger.js";
import { IconAgent, IconPencil, IconPlus, IconSearch, IconSpinner, IconUsers } from "./icons.js";
import { MessengerAvatar } from "./MessageAttachments.js";
import { DEFAULT_MESSENGER_LABELS } from "./messenger-labels.js";
/**
 * The list of conversations. One row anatomy, always: a face, the name and
 * when it last spoke, the newest message under it, the unread count at the
 * end. A conversation with several people shows a group face; one that an
 * agent has joined says so on the face.
 */
export function ConversationList({ conversations, viewerId, agents = [], status = "ready", selectedId = null, onSelect, onNew, onReload, typing = {}, search, header, agentMark, locale, timeZone, labels = DEFAULT_MESSENGER_LABELS, }) {
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("all");
    const title = (c) => conversationTitle(c, viewerId, labels.titles, agents);
    const shown = useMemo(() => {
        const matched = query.trim()
            ? search
                ? search(conversations, query)
                : searchConversations(conversations, query, (c) => conversationTitle(c, viewerId, labels.titles, agents))
            : conversations;
        return filter === "unread" ? matched.filter((c) => (c.unread ?? 0) > 0) : matched;
    }, [conversations, query, filter, search, viewerId, labels.titles, agents]);
    const now = new Date();
    const anyUnread = conversations.some((c) => (c.unread ?? 0) > 0);
    return (_jsxs("nav", { className: "ck-msgr-list", "aria-label": labels.conversations, children: [_jsxs("div", { className: "ck-msgr-list-head", children: [_jsx("h1", { className: "ck-msgr-list-title", children: labels.title }), onNew && (_jsxs("button", { type: "button", className: "ck-msgr-btn ck-msgr-btn-primary", onClick: onNew, children: [_jsx(IconPlus, {}), labels.newConversation] }))] }), header, _jsxs("div", { className: "ck-msgr-list-tools", children: [_jsxs("label", { className: "ck-msgr-search", children: [_jsx(IconSearch, {}), _jsx("span", { className: "ck-msgr-sr", children: labels.search }), _jsx("input", { type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: labels.searchPlaceholder, enterKeyHint: "search" })] }), (anyUnread || filter === "unread") && (_jsx("div", { className: "ck-msgr-filter", role: "group", "aria-label": labels.filter, children: ["all", "unread"].map((value) => (_jsx("button", { type: "button", "aria-pressed": filter === value, onClick: () => setFilter(value), children: value === "all" ? labels.filterAll : labels.filterUnread }, value))) }))] }), _jsxs("div", { className: "ck-msgr-list-body", children: [status === "loading" && conversations.length === 0 && (_jsxs("div", { className: "ck-msgr-state", role: "status", children: [_jsx(IconSpinner, {}), _jsx("span", { className: "ck-msgr-sr", children: labels.loading })] })), status === "failed" && conversations.length === 0 && (_jsxs("div", { className: "ck-msgr-state", role: "alert", children: [_jsx("p", { children: labels.listFailed }), onReload && (_jsx("button", { type: "button", className: "ck-msgr-btn", onClick: onReload, children: labels.retry }))] })), status === "ready" && conversations.length === 0 && (_jsxs("div", { className: "ck-msgr-state", children: [_jsx("p", { children: labels.listEmpty }), onNew && (_jsx("button", { type: "button", className: "ck-msgr-btn ck-msgr-btn-primary", onClick: onNew, children: labels.listEmptyAction }))] })), conversations.length > 0 && shown.length === 0 && (_jsx("div", { className: "ck-msgr-state", children: _jsx("p", { children: query.trim() ? labels.noMatch.replace("{query}", query.trim()) : labels.noUnread }) })), shown.length > 0 && (_jsx("ul", { className: "ck-msgr-rows", children: shown.map((c) => {
                            const people = otherPeople(c, viewerId, agents);
                            const present = agentsPresent(c, agents);
                            // The face of a conversation: the other person; several people
                            // share a group mark; alone with an agent, the agent.
                            const face = people.length === 1 ? people[0] : undefined;
                            const onlyAgent = people.length === 0 ? present[0] : undefined;
                            const unread = c.unread ?? 0;
                            const typers = (typing[c.id] ?? [])
                                .map((id) => c.participants.find((p) => p.actorId === id)?.name ?? "")
                                .filter(Boolean);
                            const name = title(c);
                            return (_jsx("li", { children: _jsxs("button", { type: "button", className: unread > 0 ? "ck-msgr-row ck-msgr-row-unread" : "ck-msgr-row", "aria-current": c.id === selectedId ? "true" : undefined, onClick: () => onSelect(c.id), children: [_jsxs("span", { className: "ck-msgr-row-face", children: [face ? (_jsx(MessengerAvatar, { name: face.name, src: face.avatarUrl, online: face.online, size: "lg" })) : onlyAgent ? (_jsx(MessengerAvatar, { name: onlyAgent.name, src: onlyAgent.avatarUrl, agent: true, size: "lg", fallback: agentMark ?? _jsx(IconAgent, {}) })) : (_jsx(MessengerAvatar, { name: name, size: "lg", 
                                                    // Several people share a group mark; a conversation
                                                    // with nobody else is the viewer's own notes.
                                                    fallback: people.length > 1 ? _jsx(IconUsers, {}) : _jsx(IconPencil, {}) })), present.length > 0 && !onlyAgent && (_jsx("span", { className: "ck-msgr-row-agent", title: present[0].name, children: agentMark ?? _jsx(IconAgent, {}) }))] }), _jsxs("span", { className: "ck-msgr-row-text", children: [_jsxs("span", { className: "ck-msgr-row-top", children: [_jsx("span", { className: "ck-msgr-row-name ck-truncate", children: name }), c.last && (_jsx("time", { dateTime: c.last.createdAt.toISOString(), children: listTime(c.last.createdAt, now, labels.days, locale, timeZone) }))] }), _jsxs("span", { className: "ck-msgr-row-bottom", children: [_jsx("span", { className: "ck-msgr-row-preview ck-truncate", children: typers.length > 0
                                                                ? typingLabel(typers, labels.typing)
                                                                : conversationPreview(c, viewerId, labels.preview) }), unread > 0 && (_jsx("span", { className: "ck-msgr-badge", "aria-label": labels.unread.replace("{n}", String(unread)), children: unread > 99 ? "99+" : unread }))] })] })] }) }, c.id));
                        }) }))] })] }));
}
//# sourceMappingURL=ConversationList.js.map