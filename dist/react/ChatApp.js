"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { localConversationStore } from "../stores.js";
import { ChatScreen } from "./Screen.js";
import { ChatStarters, ChatThread, } from "./Thread.js";
import { Composer } from "./Composer.js";
import { ChatHistory } from "./ChatHistory.js";
import { useViewportHeight } from "./hooks.js";
import { IconGhost, IconMenu, IconMore, IconNewChat, IconX } from "./icons.js";
import { useChatApp } from "./use-chat-app.js";
export const DEFAULT_CHAT_APP_LABELS = {
    chats: "Chats",
    openChats: "Open your chats",
    closeChats: "Close chats",
    newChat: "New chat",
    untitled: "New chat",
    more: "More for this chat",
    temporary: "Temporary chat",
    temporaryNote: "Not saved. Gone when you leave it.",
    share: "Share this chat",
    rename: "Rename",
    renameField: "Name of this chat",
    delete: "Delete",
    deleteAsk: (title) => `Delete “${title}”?`,
    save: "Save",
    cancel: "Cancel",
    search: "Search chats",
    today: "Today",
    yesterday: "Yesterday",
    earlier: "Earlier",
    noChats: "No chats yet. What you ask is kept here.",
    noMatch: (q) => `No chat is called “${q}”.`,
    loadingChats: "Loading your chats…",
    listFailed: "Your chats did not load.",
    tryAgain: "Try again",
    answering: "Answering…",
    chatActions: (title) => `Rename or delete “${title}”`,
    queued: "Sends when this answer is done",
    unqueue: (text) => `Do not send “${text}”`,
    dismiss: "Dismiss",
    problems: {
        load: "Your chats did not load.",
        save: "That was not saved. Check the connection and try again.",
        open: "That chat did not open. Try again.",
    },
};
function useMediaQuery(query) {
    const [match, setMatch] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia?.(query);
        if (!mq)
            return;
        const sync = () => setMatch(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, [query]);
    return match;
}
let fallbackStore = null;
/**
 * The whole chat app, the way the Claude, ChatGPT and Grok phone apps are
 * laid out: the conversation edge to edge, a frosted header (Chats · title ·
 * New chat · More), the chat list in a drawer on a phone and a rail beside
 * the chat from a wide screen, and the composer floating at the bottom with
 * the microphone, Camera · Photos · Files and the queue.
 *
 * A product gives it two things — a `transport` that answers a turn, and a
 * `store` that keeps chats (or nothing: the device then keeps them) — plus
 * its words. Everything a person sees and does is the same in every product.
 */
export function ChatApp({ transport, store: givenStore, placeholder = "Ask anything", name = "", makeTitle, starters, startersTitle, empty, composer, thread, footnote, fill = "viewport", temporaryChats = true, onShare, conversationId, onConversationChange, rememberKey = "ck-chat:open", search, headerStart, headerEnd, locale, railQuery = "(min-width: 64rem)", labels: labelOverrides, className, }) {
    const labels = {
        ...DEFAULT_CHAT_APP_LABELS,
        ...labelOverrides,
        problems: { ...DEFAULT_CHAT_APP_LABELS.problems, ...labelOverrides?.problems },
    };
    const store = useMemo(() => givenStore ?? (fallbackStore ??= localConversationStore()), [givenStore]);
    const app = useChatApp({
        store,
        transport,
        makeTitle,
        conversationId,
        onConversationChange,
        rememberKey,
    });
    const rootRef = useRef(null);
    useViewportHeight(rootRef, fill === "viewport");
    const wide = useMediaQuery(railQuery);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawerRef = useRef(null);
    useEffect(() => {
        const d = drawerRef.current;
        if (!d)
            return;
        if (drawerOpen && !d.open && typeof d.showModal === "function") {
            d.showModal();
            // Focus the close button, never the search box: on a phone that would
            // throw the keyboard over the list the person came to read.
            d.querySelector("[data-ck-initial-focus]")?.focus();
        }
        else if (!drawerOpen && d.open)
            d.close();
    }, [drawerOpen]);
    useEffect(() => {
        if (wide)
            setDrawerOpen(false);
    }, [wide]);
    const current = app.list.find((c) => c.id === app.activeId);
    const title = app.temporary
        ? labels.temporary
        : current
            ? current.title.trim() || labels.untitled
            : app.activeId
                ? labels.untitled
                : name;
    const inStored = !!app.stored && !!current;
    const history = (_jsx(ChatHistory, { conversations: app.list, state: app.listState, activeId: app.activeId, busyIds: app.busyIds, onOpen: (id) => {
            setDrawerOpen(false);
            app.open(id);
        }, onNew: () => {
            setDrawerOpen(false);
            app.newChat();
        }, onRename: (id, t) => void app.rename(id, t), onRemove: (id) => void app.remove(id), onRetry: app.reloadList, onClose: wide ? undefined : () => setDrawerOpen(false), search: search, locale: locale, labels: labels }));
    const [renaming, setRenaming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const menu = [];
    if (temporaryChats)
        menu.push({
            label: labels.temporary,
            checked: app.temporary,
            onSelect: app.toggleTemporary,
        });
    if (onShare && app.activeId && app.messages.length > 0)
        menu.push({
            label: labels.share,
            onSelect: () => onShare({ id: app.activeId, title, messages: app.messages }),
        });
    if (inStored) {
        menu.push({ label: labels.rename, onSelect: () => setRenaming(true) });
        menu.push({ label: labels.delete, danger: true, onSelect: () => setDeleting(true) });
    }
    const header = (_jsxs(_Fragment, { children: [!wide && (_jsx("button", { type: "button", className: "ck-glass ck-app-icon", "aria-label": labels.openChats, title: labels.openChats, "aria-haspopup": "dialog", onClick: () => setDrawerOpen(true), children: _jsx(IconMenu, {}) })), headerStart, _jsx("div", { className: "ck-app-title", children: renaming && current ? (_jsx("form", { className: "ck-app-rename", onSubmit: (e) => {
                        e.preventDefault();
                        const v = String(new FormData(e.currentTarget).get("title") ?? "").trim();
                        if (v)
                            void app.rename(current.id, v);
                        setRenaming(false);
                    }, children: _jsx("input", { name: "title", defaultValue: current.title, "aria-label": labels.renameField, autoFocus: true, onBlur: (e) => e.currentTarget.form?.requestSubmit(), onKeyDown: (e) => {
                            if (e.key === "Escape")
                                setRenaming(false);
                        } }) })) : (_jsxs(_Fragment, { children: [_jsxs("span", { className: "ck-app-title-text", children: [app.temporary && _jsx(IconGhost, {}), _jsx("span", { className: "ck-truncate", children: title })] }), app.temporary && _jsx("span", { className: "ck-app-title-note", children: labels.temporaryNote })] })) }), headerEnd, _jsx("button", { type: "button", className: "ck-glass ck-app-icon", "aria-label": labels.newChat, title: labels.newChat, onClick: app.newChat, children: _jsx(IconNewChat, {}) }), menu.length > 0 && _jsx(HeaderMenu, { label: labels.more, items: menu })] }));
    const above = deleting && current ? (_jsxs("div", { className: "ck-app-confirm", role: "group", "aria-label": labels.deleteAsk(title), children: [_jsx("p", { children: labels.deleteAsk(title) }), _jsxs("div", { className: "ck-history-pair", children: [_jsx("button", { type: "button", className: "ck-history-danger", onClick: () => {
                            setDeleting(false);
                            void app.remove(current.id);
                        }, children: labels.delete }), _jsx("button", { type: "button", onClick: () => setDeleting(false), children: labels.cancel })] })] })) : null;
    const dock = (_jsxs(_Fragment, { children: [above, app.problem && (_jsxs("p", { className: "ck-problem", role: "status", children: [_jsx("span", { children: labels.problems[app.problem] }), _jsx("button", { type: "button", className: "ck-problem-x", onClick: app.clearProblem, "aria-label": labels.dismiss, children: _jsx(IconX, {}) })] })), app.queued.length > 0 && (_jsx("ul", { className: "ck-app-queue", "aria-label": labels.queued, children: app.queued.map((q) => (_jsxs("li", { children: [_jsxs("span", { className: "ck-app-queue-text", children: [_jsx("span", { className: "ck-truncate", children: q.text }), _jsx("small", { children: labels.queued })] }), _jsx("button", { type: "button", className: "ck-icon-btn", onClick: () => app.unqueue(q.id), "aria-label": labels.unqueue(q.text), title: labels.unqueue(q.text), children: _jsx(IconX, {}) })] }, q.id))) })), _jsx(Composer, { placeholder: placeholder, attach: true, stagedPosition: "above", ...composer, onSend: (text, attachments) => app.send(text, attachments), sending: app.busy, onStop: app.stop, queue: true })] }));
    const lastFailed = app.messages[app.messages.length - 1]?.failed;
    const onFeedback = thread?.onFeedback;
    const cls = ["ck-app"];
    if (fill === "viewport")
        cls.push("ck-app-viewport");
    if (wide)
        cls.push("ck-app-wide");
    if (className)
        cls.push(className);
    return (_jsxs("div", { ref: rootRef, className: cls.join(" "), children: [wide ? (_jsx("aside", { className: "ck-app-rail", children: history })) : (_jsx("dialog", { ref: drawerRef, className: "ck-app-drawer", "aria-label": labels.chats, onClose: () => setDrawerOpen(false), onClick: (e) => {
                    if (e.target === e.currentTarget)
                        setDrawerOpen(false);
                }, children: drawerOpen && _jsx("div", { className: "ck-app-drawer-panel", children: history }) })), _jsx(ChatScreen, { fill: "parent", className: "ck-app-screen", header: header, composer: dock, footnote: footnote, renderers: thread?.renderers, children: _jsx(ChatThread, { messages: app.messages, loading: app.loading, live: app.live, stopped: app.stopped, onStop: app.stop, onRetry: lastFailed || app.stopped ? app.retry : undefined, onReply: (text) => void app.send(text), renderLink: thread?.renderLink, renderFooter: thread?.renderFooter, speaker: thread?.speaker, share: thread?.share, onFeedback: onFeedback ? (f) => onFeedback({ ...f, conversationId: app.stored }) : undefined, labels: thread?.labels, empty: empty ??
                        (starters && starters.length > 0 ? (_jsx(ChatStarters, { starters: starters, title: startersTitle, onPick: (text) => void app.send(text) })) : (_jsx("div", { className: "ck-starters", children: startersTitle && _jsx("div", { className: "ck-starters-title", children: startersTitle }) }))) }, app.activeId ?? (app.temporary ? "temporary" : "new")) })] }));
}
/** The header's "…": a small menu under the button. Escape and a tap
 *  outside close it and give focus back to the button; arrows move. */
function HeaderMenu({ label, items }) {
    const [open, setOpen] = useState(false);
    const wrap = useRef(null);
    const trigger = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const first = wrap.current?.querySelector("[role^=menuitem]");
        first?.focus();
        const outside = (e) => {
            if (!wrap.current?.contains(e.target))
                setOpen(false);
        };
        document.addEventListener("pointerdown", outside);
        return () => document.removeEventListener("pointerdown", outside);
    }, [open]);
    const close = () => {
        setOpen(false);
        trigger.current?.focus();
    };
    return (_jsxs("div", { ref: wrap, className: "ck-app-menu-wrap", onKeyDown: (e) => {
            if (!open)
                return;
            if (e.key === "Escape") {
                e.preventDefault();
                close();
            }
            else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const all = [...(wrap.current?.querySelectorAll("[role^=menuitem]") ?? [])];
                const i = all.indexOf(document.activeElement);
                const next = all[(i + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length];
                next?.focus();
            }
        }, children: [_jsx("button", { ref: trigger, type: "button", className: "ck-glass ck-app-icon", "aria-label": label, title: label, "aria-haspopup": "menu", "aria-expanded": open, onClick: () => setOpen((v) => !v), children: _jsx(IconMore, {}) }), open && (_jsx("div", { className: "ck-app-menu", role: "menu", "aria-label": label, children: items.map((item) => (_jsxs("button", { type: "button", role: item.checked === undefined ? "menuitem" : "menuitemcheckbox", "aria-checked": item.checked, className: item.danger ? "ck-app-menu-item ck-history-danger" : "ck-app-menu-item", onClick: () => {
                        close();
                        item.onSelect();
                    }, children: [_jsx("span", { children: item.label }), item.checked && _jsx("span", { className: "ck-app-menu-check", "aria-hidden": true })] }, item.label))) }))] }));
}
//# sourceMappingURL=ChatApp.js.map