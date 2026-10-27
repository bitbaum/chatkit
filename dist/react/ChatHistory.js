"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { filterConversations, formatConversationDate, groupConversations, } from "../conversations.js";
import { IconMore, IconNewChat, IconSearch, IconX } from "./icons.js";
/**
 * The chat list — the same in every product: New chat, a search box, the
 * chats under Today / Yesterday / Earlier. Every row has ONE anatomy: the
 * title, the date (or "Answering…"), and one "…" that opens the row's two
 * actions, Rename and Delete, as two equal cells under it. A delete asks
 * once, in the row.
 */
export function ChatHistory({ conversations, state, activeId, busyIds, onOpen, onNew, onRename, onRemove, onRetry, onClose, search = filterConversations, locale, labels, slot, empty, }) {
    const [query, setQuery] = useState("");
    const [armed, setArmed] = useState(null);
    const [confirming, setConfirming] = useState(null);
    const [editing, setEditing] = useState(null);
    const now = Date.now();
    const shown = search(conversations, query);
    const groups = groupConversations(shown, now);
    const close = () => {
        setArmed(null);
        setConfirming(null);
        setEditing(null);
    };
    const submitRename = (e, id) => {
        e.preventDefault();
        const value = String(new FormData(e.currentTarget).get("title") ?? "").trim();
        if (value)
            onRename(id, value);
        close();
    };
    return (_jsxs("nav", { className: "ck-history", "aria-label": labels.chats, children: [_jsxs("div", { className: "ck-history-head", children: [_jsx("span", { className: "ck-history-title", children: labels.chats }), onClose && (_jsx("button", { type: "button", className: "ck-icon-btn ck-history-close", onClick: onClose, "aria-label": labels.closeChats, title: labels.closeChats, "data-ck-initial-focus": "", children: _jsx(IconX, {}) }))] }), _jsxs("button", { type: "button", className: "ck-history-new", onClick: onNew, children: [_jsx(IconNewChat, {}), _jsx("span", { children: labels.newChat })] }), _jsxs("label", { className: "ck-history-search", children: [_jsx(IconSearch, {}), _jsx("input", { type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: labels.search, "aria-label": labels.search, enterKeyHint: "search" })] }), slot && _jsx("div", { className: "ck-history-slot", children: slot }), _jsx("div", { className: "ck-history-list", children: state === "loading" && conversations.length === 0 ? (_jsx("p", { className: "ck-history-empty", role: "status", children: labels.loadingChats })) : state === "error" ? (_jsxs("div", { className: "ck-history-empty", role: "status", children: [_jsx("p", { children: labels.listFailed }), _jsx("button", { type: "button", className: "ck-history-retry", onClick: onRetry, children: labels.tryAgain })] })) : conversations.length === 0 ? (empty ? (_jsx("div", { className: "ck-history-empty", children: empty })) : (_jsx("p", { className: "ck-history-empty", children: labels.noChats }))) : groups.length === 0 ? (_jsx("p", { className: "ck-history-empty", children: labels.noMatch(query.trim()) })) : (groups.map((group) => (_jsxs("section", { className: "ck-history-group", "aria-label": labels[group.key], children: [_jsx("h3", { className: "ck-history-group-title", children: labels[group.key] }), _jsx("ul", { children: group.items.map((c) => {
                                const title = c.title.trim() || labels.untitled;
                                const busy = busyIds.has(c.id);
                                const active = c.id === activeId;
                                const isArmed = armed === c.id;
                                return (_jsxs("li", { className: active ? "ck-history-row ck-history-row-active" : "ck-history-row", children: [editing === c.id ? (_jsxs("form", { className: "ck-history-rename", onSubmit: (e) => submitRename(e, c.id), children: [_jsx("input", { name: "title", defaultValue: c.title, "aria-label": labels.renameField, autoFocus: true, onKeyDown: (e) => {
                                                        if (e.key === "Escape") {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            close();
                                                        }
                                                    } }), _jsxs("div", { className: "ck-history-pair", children: [_jsx("button", { type: "submit", children: labels.save }), _jsx("button", { type: "button", onClick: close, children: labels.cancel })] })] })) : (_jsxs("div", { className: "ck-history-line", children: [_jsxs("button", { type: "button", className: "ck-history-open", "aria-current": active ? "page" : undefined, onClick: () => {
                                                        close();
                                                        onOpen(c.id);
                                                    }, children: [_jsx("span", { className: "ck-history-name", children: title }), _jsx("span", { className: "ck-history-date", children: busy
                                                                ? labels.answering
                                                                : formatConversationDate(c.updatedAt, now, locale) })] }), _jsx("button", { type: "button", className: "ck-history-more", "aria-expanded": isArmed, "aria-label": labels.chatActions(title), title: labels.chatActions(title), onClick: () => {
                                                        setConfirming(null);
                                                        setArmed(isArmed ? null : c.id);
                                                    }, children: _jsx(IconMore, {}) })] })), isArmed && editing !== c.id && confirming !== c.id && (_jsxs("div", { className: "ck-history-pair", children: [_jsx("button", { type: "button", onClick: () => setEditing(c.id), children: labels.rename }), _jsx("button", { type: "button", onClick: () => setConfirming(c.id), children: labels.delete })] })), confirming === c.id && (_jsxs("div", { className: "ck-history-confirm", role: "group", "aria-label": labels.deleteAsk(title), children: [_jsx("p", { children: labels.deleteAsk(title) }), _jsxs("div", { className: "ck-history-pair", children: [_jsx("button", { type: "button", className: "ck-history-danger", onClick: () => {
                                                                close();
                                                                onRemove(c.id);
                                                            }, children: labels.delete }), _jsx("button", { type: "button", onClick: close, children: labels.cancel })] })] }))] }, c.id));
                            }) })] }, group.key)))) })] }));
}
//# sourceMappingURL=ChatHistory.js.map