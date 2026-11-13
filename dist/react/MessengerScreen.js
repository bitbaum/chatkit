"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { canWrite } from "@bitbaum/threadkit";
import { DEFAULT_ATTACHMENT_POLICY } from "../thread-rules.js";
import { MESSAGE_FILES_ACCEPT } from "../attachments.js";
import { agentsPresent, conversationTitle, failureText, otherPeople, participantOf, QUICK_REACTIONS, quoteOf, quoteText, reactionOf, sessionDrafts, withMention, } from "../messenger.js";
import { Composer, } from "./Composer.js";
import { ConversationList } from "./ConversationList.js";
import { useViewportHeight } from "./hooks.js";
import { IconAgent, IconArrowLeft, IconCheck, IconCopy, IconFile, IconMore, IconPencil, IconReply, IconRetry, IconSearch, IconSpinner, IconTrash, IconUsers, IconVideo, IconX, } from "./icons.js";
import { MessengerAvatar } from "./MessageAttachments.js";
import { MessageThread } from "./MessageThread.js";
import { messengerLabels, } from "./messenger-labels.js";
import { Sheet, prefersSheet } from "./Sheet.js";
import { useMessenger } from "./use-messenger.js";
import { useUploads, } from "./use-uploads.js";
/** "How much?", asked once, the same way for every action that needs it. */
function AmountSheet({ action, onClose, onConfirm, labels, }) {
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [invalid, setInvalid] = useState(false);
    useEffect(() => {
        setAmount("");
        setNote("");
        setInvalid(false);
    }, [action]);
    const unit = action?.amount?.unit ?? "";
    return (_jsx(Sheet, { open: action !== null, onClose: onClose, title: action?.label ?? "", closeLabel: labels.close, children: _jsxs("form", { className: "ck-msgr-amount", noValidate: true, onSubmit: (e) => {
                e.preventDefault();
                // A comma is a decimal point for half of Europe.
                const value = Number(amount.replace(",", ".").trim());
                if (!Number.isFinite(value) || value <= 0) {
                    setInvalid(true);
                    return;
                }
                onConfirm(value, note.trim());
            }, children: [_jsxs("label", { className: "ck-msgr-amount-field", children: [_jsx("span", { children: labels.amount }), _jsxs("span", { className: "ck-msgr-amount-box", children: [_jsx("input", { inputMode: "decimal", autoComplete: "off", value: amount, "aria-invalid": invalid, onChange: (e) => {
                                        setAmount(e.target.value);
                                        setInvalid(false);
                                    }, placeholder: "0" }), _jsx("span", { className: "ck-msgr-amount-unit", children: unit })] })] }), invalid && (_jsx("p", { className: "ck-msgr-amount-error", role: "alert", children: labels.amountInvalid })), _jsxs("label", { className: "ck-msgr-amount-field", children: [_jsx("span", { children: labels.note }), _jsx("input", { value: note, maxLength: 140, onChange: (e) => setNote(e.target.value) })] }), _jsxs("div", { className: "ck-msgr-confirm", children: [_jsx("button", { type: "button", className: "ck-msgr-btn", onClick: onClose, children: labels.cancel }), _jsx("button", { type: "submit", className: "ck-msgr-btn ck-msgr-btn-primary", children: action?.amount?.confirm })] })] }) }));
}
function UploadTray({ uploads, labels }) {
    if (uploads.items.length === 0)
        return null;
    return (_jsx("div", { className: "ck-msgr-tray", children: uploads.items.map((item) => (_jsx(UploadTile, { item: item, uploads: uploads, labels: labels }, item.key))) }));
}
function UploadTile({ item, uploads, labels, }) {
    const busy = item.state === "preparing" || item.state === "uploading";
    return (_jsxs("div", { className: `ck-msgr-upload ck-msgr-upload-${item.state}`, title: item.name, "data-upload": item.state, children: [item.previewUrl ? (_jsx("img", { src: item.previewUrl, alt: item.name })) : (_jsxs("span", { className: "ck-msgr-upload-file", children: [item.kind === "video" ? _jsx(IconVideo, {}) : _jsx(IconFile, {}), _jsx("span", { className: "ck-truncate", children: item.name })] })), busy && (_jsx("span", { className: "ck-msgr-upload-bar", role: "progressbar", "aria-label": labels.uploading.replace("{name}", item.name), "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(item.progress * 100), children: _jsx("span", { style: { width: `${Math.round(item.progress * 100)}%` } }) })), item.state === "failed" && (_jsx("button", { type: "button", className: "ck-msgr-upload-retry", onClick: () => uploads.retry(item.key), "aria-label": `${labels.retryUpload}: ${item.name}`, title: labels.retryUpload, children: _jsx(IconRetry, {}) })), _jsx("button", { type: "button", className: "ck-attach-remove", onClick: () => uploads.remove(item.key), "aria-label": labels.removeUpload(item.name), title: labels.removeUpload(item.name), children: _jsx(IconX, {}) })] }));
}
/** Find people and start a conversation with them. */
function NewConversation({ open, onClose, transport, onStart, labels, }) {
    const [query, setQuery] = useState("");
    const [found, setFound] = useState([]);
    const [state, setState] = useState("idle");
    const [picked, setPicked] = useState([]);
    const [starting, setStarting] = useState(false);
    const [problem, setProblem] = useState(null);
    useEffect(() => {
        if (!open) {
            setQuery("");
            setFound([]);
            setPicked([]);
            setProblem(null);
            setState("idle");
        }
    }, [open]);
    useEffect(() => {
        const people = transport.people;
        const asked = query.trim();
        if (!open || !people || !asked) {
            setFound([]);
            setState("idle");
            return;
        }
        const request = new AbortController();
        setState("searching");
        // A pause in typing, not every letter, is a question worth asking.
        const timer = setTimeout(() => {
            people(asked, { signal: request.signal })
                .then((list) => {
                if (request.signal.aborted)
                    return;
                setFound(list);
                setState("idle");
            })
                .catch(() => {
                if (!request.signal.aborted)
                    setState("failed");
            });
        }, 250);
        return () => {
            clearTimeout(timer);
            request.abort();
        };
    }, [open, query, transport.people]);
    const toggle = (person) => setPicked((current) => current.some((p) => p.id === person.id)
        ? current.filter((p) => p.id !== person.id)
        : [...current, person]);
    const rows = [...picked, ...found.filter((f) => !picked.some((p) => p.id === f.id))];
    return (_jsx(Sheet, { open: open, onClose: onClose, title: labels.newTitle, closeLabel: labels.close, children: _jsxs("div", { className: "ck-msgr-new", children: [_jsxs("label", { className: "ck-msgr-search", children: [_jsx(IconSearch, {}), _jsx("span", { className: "ck-msgr-sr", children: labels.peopleSearch }), _jsx("input", { type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: labels.peoplePlaceholder, enterKeyHint: "search" })] }), _jsxs("div", { className: "ck-msgr-new-body", "aria-live": "polite", children: [rows.length === 0 && (_jsx("p", { className: "ck-msgr-hint", children: state === "searching" ? (_jsx(IconSpinner, {})) : state === "failed" ? (labels.peopleFailed) : query.trim() ? (labels.peopleEmpty) : (labels.peopleHint) })), rows.length > 0 && (_jsx("ul", { className: "ck-msgr-rows", children: rows.map((person) => {
                                const on = picked.some((p) => p.id === person.id);
                                return (_jsx("li", { children: _jsxs("button", { type: "button", className: "ck-msgr-row", "aria-pressed": on, onClick: () => toggle(person), children: [_jsx("span", { className: "ck-msgr-row-face", children: _jsx(MessengerAvatar, { name: person.name, src: person.avatarUrl, agent: person.kind === "agent", size: "lg" }) }), _jsxs("span", { className: "ck-msgr-row-text", children: [_jsx("span", { className: "ck-msgr-row-name ck-truncate", children: person.name }), person.handle && (_jsxs("span", { className: "ck-msgr-row-preview ck-truncate", children: ["@", person.handle] }))] }), _jsx("span", { className: "ck-msgr-pick", "aria-hidden": "true", children: on && _jsx(IconCheck, {}) })] }) }, person.id));
                            }) }))] }), problem && (_jsx("p", { className: "ck-msgr-problem", role: "alert", children: problem })), _jsxs("button", { type: "button", className: "ck-msgr-btn ck-msgr-btn-primary ck-msgr-btn-wide", disabled: picked.length === 0 || starting, onClick: async () => {
                        setStarting(true);
                        setProblem(null);
                        const ok = await onStart(picked.map((p) => p.id));
                        setStarting(false);
                        if (ok)
                            onClose();
                        else
                            setProblem(labels.startFailed);
                    }, children: [starting && _jsx(IconSpinner, {}), labels.start] })] }) }));
}
/**
 * The messenger, whole: the list of conversations, the conversation, the box.
 * On a phone it is one screen at a time — the list, then the conversation
 * with its own way back — and from 48rem of its own width the two sit side
 * by side. The app gives it a `transport` and a place to live; it has no
 * database, no websocket and no storage of its own.
 *
 *   <Messenger viewer={{ id }} transport={transport} agents={[cat]}
 *     conversationId={id} onConversationChange={setId}
 *     composer={{ voice: { transcribeUrl: "/api/transcribe" } }} />
 *
 * An app that needs its own arrangement uses the parts it is made of:
 * `useMessenger`, `ConversationList`, `MessageThread`.
 */
export function Messenger({ viewer, transport, agents = [], conversationId, onConversationChange, composer = {}, drafts, listHeader, actions = [], renderCardAction, headerActions, profileHref, search, renderLink, agentMark, fill = "parent", locale, timeZone, agentPatienceMs, labels: labelOverrides, className, }) {
    const labels = useMemo(() => messengerLabels(labelOverrides), [labelOverrides]);
    const controller = useMessenger({
        viewerId: viewer.id,
        transport,
        agents,
        conversationId,
        onConversationChange,
        agentPatienceMs,
    });
    const { state, open, thread } = controller;
    const openId = state.openId;
    const rootRef = useRef(null);
    useViewportHeight(rootRef, fill === "viewport");
    // ── the box's words ──
    const draftStore = useMemo(() => drafts ?? sessionDrafts(), [drafts]);
    const [draft, setDraftState] = useState("");
    const [editing, setEditing] = useState(null);
    const [replying, setReplying] = useState(null);
    const [asking, setAsking] = useState(null);
    const beforeEdit = useRef("");
    const handle = useRef(null);
    const initial = composer.initialDraft;
    const initialRef = useRef(initial);
    useEffect(() => {
        initialRef.current = initial;
    });
    useEffect(() => {
        setEditing(null);
        setReplying(null);
        setAsking(null);
        if (!openId) {
            setDraftState("");
            return;
        }
        setDraftState(initialRef.current?.(openId) ?? draftStore.get(openId));
        // A keyboard that springs up on every tap of a row hides the messages
        // the person opened the conversation to read.
        if (!prefersSheet())
            setTimeout(() => handle.current?.focus(), 0);
    }, [openId, draftStore]);
    const setDraft = (text) => {
        setDraftState(text);
        if (openId && !editing)
            draftStore.set(openId, text);
        if (text.trim() && !editing)
            controller.typed();
    };
    // ── files ──
    const canUpload = Boolean(transport.upload) && composer.attach !== false;
    const uploadOptions = composer.attach || undefined;
    const uploads = useUploads({
        transport,
        conversationId: openId,
        options: uploadOptions,
        labels: labels.refusal,
        failedText: labels.uploadFailed,
    });
    const policy = uploadOptions?.policy ?? DEFAULT_ATTACHMENT_POLICY;
    const sources = useMemo(() => {
        const list = [];
        if (policy.maxBytes.image > 0)
            list.push("camera", "photos");
        if (policy.maxBytes.video > 0)
            list.push("videos");
        if (policy.maxBytes.file > 0)
            list.push("files");
        return list;
    }, [policy]);
    const [notice, setNotice] = useState(null);
    useEffect(() => setNotice(null), [openId]);
    const shownNotice = notice ?? uploads.note;
    // ── what can be done to a message, and to the conversation ──
    const [acting, setActing] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [menu, setMenu] = useState(false);
    const [creating, setCreating] = useState(false);
    const closeActions = () => {
        setActing(null);
        setConfirming(false);
    };
    const title = open ? conversationTitle(open, viewer.id, labels.titles, agents) : "";
    const people = open ? otherPeople(open, viewer.id, agents) : [];
    const present = open ? agentsPresent(open, agents) : [];
    const one = people.length === 1 ? people[0] : undefined;
    const writable = open ? canWrite(open, viewer.id) : true;
    const subtitle = !open ? null : present.length > 0 ? (_jsxs("span", { className: "ck-msgr-top-agent", children: [_jsx("span", { className: "ck-speaker-kind", children: labels.agent }), _jsx("span", { className: "ck-truncate", children: labels.agentHere.replace("{name}", present.map((p) => p.name).join(", ")) })] })) : one ? (one.online ? (labels.online) : one.handle ? (`@${one.handle}`) : null) : people.length > 1 ? (labels.people.replace("{n}", String(people.length + 1))) : null;
    const sendCard = (body, card) => controller.send(body, [], card ? { card } : undefined);
    const appExtras = open
        ? actions
            .filter((action) => action.available?.(open) ?? true)
            .map((action) => ({
            id: `action-${action.id}`,
            label: action.label,
            detail: action.detail,
            icon: action.icon,
            onPick: () => {
                if (action.amount)
                    setAsking(action);
                else
                    void action.onPick({ conversation: open, send: sendCard });
            },
        }))
        : [];
    const agentExtras = agents.map((agent) => ({
        id: `agent-${agent.id}`,
        label: labels.askAgent.replace("{name}", agent.name),
        detail: agent.hint,
        icon: agentMark ?? _jsx(IconAgent, {}),
        onPick: () => {
            setDraft(withMention(draft, agent.mention));
            setTimeout(() => handle.current?.focus(), 0);
        },
    }));
    const extras = [...appExtras, ...agentExtras];
    const replyName = !replying
        ? ""
        : replying.authorId === viewer.id
            ? labels.you
            : (participantOf(open ?? undefined, replying.authorId)?.name ??
                agents.find((a) => a.id === replying.authorId)?.name ??
                "");
    const header = editing || replying || composer.header || uploads.items.length > 0 ? (_jsxs(_Fragment, { children: [replying && !editing && (_jsxs("div", { className: "ck-msgr-editing ck-msgr-replying", children: [_jsx(IconReply, {}), _jsxs("span", { className: "ck-msgr-replying-text", children: [_jsx("span", { className: "ck-truncate", children: labels.replyingTo.replace("{name}", replyName) }), _jsx("span", { className: "ck-truncate ck-msgr-replying-quote", children: quoteText(quoteOf(replying), labels.preview) })] }), _jsx("button", { type: "button", onClick: () => setReplying(null), children: labels.cancel })] })), editing && (_jsxs("div", { className: "ck-msgr-editing", children: [_jsx(IconPencil, {}), _jsx("span", { className: "ck-truncate", children: labels.editing }), _jsx("button", { type: "button", onClick: () => {
                            setEditing(null);
                            setDraftState(beforeEdit.current);
                        }, children: labels.cancel })] })), composer.header, _jsx(UploadTray, { uploads: uploads, labels: labels })] })) : undefined;
    const box = (_jsx(Composer, { layout: "inline", value: draft, onValueChange: setDraft, inputRef: composer.inputRef, handleRef: handle, placeholder: labels.placeholder, ariaLabel: labels.composer, voice: composer.voice, attach: canUpload && !editing
            ? { take: uploads.add, sources, accept: { files: MESSAGE_FILES_ACCEPT } }
            : false, attachExtras: editing ? undefined : extras, heldAttachments: editing ? 0 : uploads.attachments.length, attachmentsAlone: true, sendBlockedReason: uploads.busy ? labels.waitForUploads : null, header: header, labels: { send: labels.send, attach: labels.attach, ...composer.labels }, onSend: async (text) => {
            setNotice(null);
            const body = text.trim();
            if (editing) {
                if (!body || body === editing.body) {
                    setEditing(null);
                    setDraftState(beforeEdit.current);
                    return false;
                }
                const ok = await controller.edit(editing, body);
                if (!ok) {
                    setNotice(labels.editFailed);
                    return false;
                }
                setEditing(null);
                setDraftState(beforeEdit.current);
                return false;
            }
            const sent = await controller.send(body, uploads.attachments, replying ? { replyTo: quoteOf(replying) } : undefined);
            if (!sent) {
                setNotice(labels.sendFailed);
                return false;
            }
            uploads.clear();
            setReplying(null);
            if (openId)
                draftStore.set(openId, "");
            return true;
        } }));
    const ownActing = acting?.authorId === viewer.id;
    const canEdit = Boolean(acting && ownActing && transport.edit && acting.body);
    const canRemove = Boolean(acting && ownActing && transport.remove);
    return (_jsxs("div", { ref: rootRef, className: ["ck-msgr", fill === "viewport" ? "ck-msgr-viewport" : "", className ?? ""]
            .filter(Boolean)
            .join(" "), "data-pane": openId ? "thread" : "list", children: [_jsx("div", { className: "ck-msgr-side", children: _jsx(ConversationList, { conversations: state.conversations, viewerId: viewer.id, agents: agents, status: state.status, selectedId: openId, onSelect: controller.select, onNew: transport.people && transport.open ? () => setCreating(true) : undefined, onReload: controller.reload, typing: state.typing, search: search, header: listHeader, agentMark: agentMark, locale: locale, timeZone: timeZone, labels: labels }) }), _jsx("section", { className: "ck-msgr-main", "aria-label": open ? labels.thread.replace("{name}", title) : undefined, children: !openId ? (_jsx("div", { className: "ck-msgr-state ck-msgr-nothing", children: _jsx("p", { children: labels.pickOne }) })) : (_jsxs(_Fragment, { children: [_jsxs("header", { className: "ck-msgr-top", children: [_jsx("button", { type: "button", className: "ck-icon-btn ck-msgr-back", onClick: () => controller.select(null), "aria-label": labels.back, title: labels.back, children: _jsx(IconArrowLeft, {}) }), open && (_jsxs(_Fragment, { children: [one ? (_jsx(MessengerAvatar, { name: one.name, src: one.avatarUrl, online: one.online })) : people.length === 0 && present[0] ? (_jsx(MessengerAvatar, { name: present[0].name, src: present[0].avatarUrl, agent: true, fallback: agentMark ?? _jsx(IconAgent, {}) })) : (_jsx(MessengerAvatar, { name: title, fallback: people.length > 1 ? _jsx(IconUsers, {}) : _jsx(IconPencil, {}) })), _jsxs("div", { className: "ck-msgr-top-text", children: [one && profileHref?.(one) ? (_jsx("a", { className: "ck-msgr-top-name ck-truncate", href: profileHref(one), children: title })) : (_jsx("h2", { className: "ck-msgr-top-name ck-truncate", children: title })), subtitle && _jsx("p", { className: "ck-msgr-top-sub ck-truncate", children: subtitle })] }), headerActions?.(open), transport.leave && (_jsx("button", { type: "button", className: "ck-icon-btn ck-msgr-top-more", onClick: () => setMenu(true), "aria-label": labels.more, "aria-haspopup": "dialog", title: labels.more, children: _jsx(IconMore, {}) }))] }))] }), state.connection !== "online" && (_jsx("p", { className: "ck-msgr-banner", role: "status", children: state.connection === "offline" ? labels.offline : labels.reconnecting })), open ? (_jsx(MessageThread, { conversation: open, viewerId: viewer.id, messages: thread?.messages ?? [], agents: agents, status: thread?.status ?? "loading", onReload: controller.reloadThread, hasOlder: thread ? thread.before !== null : false, loadingOlder: thread?.loadingOlder, olderFailed: thread?.olderFailed, onLoadOlder: controller.loadOlder, unreadFrom: thread?.unreadFrom, typing: state.typing[open.id], awaited: state.awaited[open.id], onDismissAgent: controller.dismissAgent, onRetry: controller.retry, onDiscard: controller.discard, onAction: setActing, onReact: transport.react
                                ? async (message, emoji) => {
                                    const ok = await controller.react(message, emoji);
                                    if (!ok)
                                        setNotice(labels.reactFailed);
                                }
                                : undefined, renderCardAction: renderCardAction, onSeen: controller.seen, onFollowingChange: controller.setFollowing, renderLink: renderLink, agentMark: agentMark, locale: locale, timeZone: timeZone, labels: labels }, open.id)) : (_jsx("div", { className: "ck-msgr-thread-wrap", children: _jsx("div", { className: "ck-msgr-state", role: "status", children: state.status === "failed" ? (_jsxs(_Fragment, { children: [_jsx("p", { children: labels.threadFailed }), _jsx("button", { type: "button", className: "ck-msgr-btn", onClick: controller.reload, children: labels.retry })] })) : (_jsxs(_Fragment, { children: [_jsx(IconSpinner, {}), _jsx("span", { className: "ck-msgr-sr", children: labels.loading })] })) }) })), _jsxs("div", { className: "ck-msgr-dock", children: [shownNotice && (_jsx("button", { type: "button", className: "ck-note", onClick: () => {
                                        setNotice(null);
                                        uploads.clearNote();
                                    }, children: shownNotice })), writable ? (composer.wrap ? (composer.wrap(box)) : (box)) : (_jsx("p", { className: "ck-msgr-closed", children: labels.cannotWrite }))] })] })) }), _jsx(Sheet, { open: acting !== null, onClose: closeActions, title: labels.actions, closeLabel: labels.close, children: _jsxs("div", { className: "ck-sheet-extra ck-sheet-only", children: [transport.react && acting && !confirming && (_jsx("div", { className: "ck-msgr-react-row", role: "group", "aria-label": labels.react.replace("{emoji}", ""), children: QUICK_REACTIONS.map((emoji) => (_jsx("button", { type: "button", className: "ck-msgr-react", "aria-pressed": reactionOf(acting.reactions, viewer.id) === emoji, "aria-label": labels.react.replace("{emoji}", emoji), onClick: async () => {
                                    const message = acting;
                                    closeActions();
                                    const ok = await controller.react(message, emoji);
                                    if (!ok)
                                        setNotice(labels.reactFailed);
                                }, children: _jsx("span", { "aria-hidden": true, children: emoji }) }, emoji))) })), acting && writable && !confirming && (_jsxs("button", { type: "button", className: "ck-attach-extra", onClick: () => {
                                setEditing(null);
                                setReplying(acting);
                                closeActions();
                                setTimeout(() => handle.current?.focus(), 0);
                            }, children: [_jsx("span", { className: "ck-attach-extra-icon", "aria-hidden": true, children: _jsx(IconReply, {}) }), _jsx("span", { className: "ck-attach-extra-text", children: labels.reply })] })), acting?.body && !confirming && (_jsxs("button", { type: "button", className: "ck-attach-extra", onClick: () => {
                                void navigator.clipboard?.writeText(acting.body).catch(() => undefined);
                                closeActions();
                            }, children: [_jsx("span", { className: "ck-attach-extra-icon", "aria-hidden": true, children: _jsx(IconCopy, {}) }), _jsx("span", { className: "ck-attach-extra-text", children: labels.copy })] })), canEdit && !confirming && (_jsxs("button", { type: "button", className: "ck-attach-extra", onClick: () => {
                                if (!acting)
                                    return;
                                beforeEdit.current = editing ? beforeEdit.current : draft;
                                setEditing(acting);
                                setDraftState(acting.body);
                                closeActions();
                                setTimeout(() => handle.current?.focus(), 0);
                            }, children: [_jsx("span", { className: "ck-attach-extra-icon", "aria-hidden": true, children: _jsx(IconPencil, {}) }), _jsx("span", { className: "ck-attach-extra-text", children: labels.edit })] })), canRemove && !confirming && (_jsxs("button", { type: "button", className: "ck-attach-extra", onClick: () => setConfirming(true), children: [_jsx("span", { className: "ck-attach-extra-icon", "aria-hidden": true, children: _jsx(IconTrash, {}) }), _jsx("span", { className: "ck-attach-extra-text", children: labels.remove })] })), confirming && (_jsxs("div", { className: "ck-msgr-confirm", children: [_jsx("button", { type: "button", className: "ck-msgr-btn", onClick: () => setConfirming(false), children: labels.cancel }), _jsx("button", { type: "button", className: "ck-msgr-btn ck-msgr-btn-danger", onClick: async () => {
                                        const message = acting;
                                        closeActions();
                                        if (!message)
                                            return;
                                        const ok = await controller.remove(message);
                                        if (!ok)
                                            setNotice(labels.removeFailed);
                                    }, children: labels.removeConfirm })] }))] }) }), _jsx(Sheet, { open: menu, onClose: () => {
                    setMenu(false);
                    setConfirming(false);
                }, title: title || labels.more, closeLabel: labels.close, children: _jsx("div", { className: "ck-sheet-extra ck-sheet-only", children: !confirming ? (_jsxs("button", { type: "button", className: "ck-attach-extra", onClick: () => setConfirming(true), children: [_jsx("span", { className: "ck-attach-extra-icon", "aria-hidden": true, children: _jsx(IconTrash, {}) }), _jsx("span", { className: "ck-attach-extra-text", children: labels.leave })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "ck-msgr-hint", children: labels.leaveConfirm }), _jsxs("div", { className: "ck-msgr-confirm", children: [_jsx("button", { type: "button", className: "ck-msgr-btn", onClick: () => setConfirming(false), children: labels.cancel }), _jsx("button", { type: "button", className: "ck-msgr-btn ck-msgr-btn-danger", onClick: async () => {
                                            const id = openId;
                                            setMenu(false);
                                            setConfirming(false);
                                            if (!id)
                                                return;
                                            const ok = await controller.leave(id);
                                            if (!ok)
                                                setNotice(failureText(null, labels.leaveFailed));
                                        }, children: labels.leave })] })] })) }) }), _jsx(AmountSheet, { action: asking, onClose: () => setAsking(null), labels: labels, onConfirm: (amount, note) => {
                    const action = asking;
                    setAsking(null);
                    if (action && open) {
                        void action.onPick({ conversation: open, amount, note, send: sendCard });
                    }
                } }), _jsx(NewConversation, { open: creating, onClose: () => setCreating(false), transport: transport, onStart: controller.start, labels: labels })] }));
}
//# sourceMappingURL=MessengerScreen.js.map