"use client";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { newId } from "../conversations.js";
import { AGENT_PATIENCE_MS, reviveConversation, reviveMessage, toDate, } from "../messenger.js";
import { initialMessengerState, messengerReducer, newestFromOthers, readMarkToSend, } from "../messenger-state.js";
/** How long "is typing" stays without being renewed. */
const TYPING_TTL_MS = 6_000;
/** The viewer's own typing is announced at most this often. */
const TYPING_EVERY_MS = 2_500;
/** A burst of read marks becomes one request. */
const READ_DEBOUNCE_MS = 400;
/** Coming back to the tab reloads at most this often. */
const REFRESH_EVERY_MS = 15_000;
function visible() {
    return typeof document === "undefined" || document.visibilityState === "visible";
}
/**
 * The Messenger's behaviour, without its markup: what is loaded when, what an
 * arriving message does, when the read mark moves, how a failed send is kept.
 * `Messenger` is this plus the screen; an app with its own screen uses this
 * and the pieces (`ConversationList`, `MessageThread`).
 */
export function useMessenger(options) {
    const { viewerId, transport, conversationId, onConversationChange } = options;
    const [state, dispatch] = useReducer(messengerReducer, viewerId, initialMessengerState);
    // The latest of everything an async path may need, so nothing below closes
    // over a render that has since been replaced.
    const live = useRef({ state, transport, options });
    useEffect(() => {
        live.current = { state, transport, options };
    });
    const agents = options.agents;
    const agentList = useCallback(() => live.current.options.agents ?? [], []);
    const following = useRef(true);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    // ── loading ──
    const listRequest = useRef(null);
    const reload = useCallback(() => {
        listRequest.current?.abort();
        const request = new AbortController();
        listRequest.current = request;
        dispatch({ type: "list-loading" });
        live.current.transport
            .conversations({ signal: request.signal })
            .then((list) => {
            if (request.signal.aborted)
                return;
            dispatch({ type: "list-loaded", conversations: list.map(reviveConversation) });
        })
            .catch(() => {
            if (!request.signal.aborted)
                dispatch({ type: "list-failed" });
        });
    }, []);
    const loadThread = useCallback((id) => {
        // A thread already on screen is refreshed behind what is shown; only a
        // thread with nothing to show says it is loading.
        if (live.current.state.threads[id]?.status !== "ready") {
            dispatch({ type: "thread-loading", id });
        }
        live.current.transport
            .messages(id, {})
            .then((page) => {
            if (!mounted.current)
                return;
            dispatch({
                type: "thread-loaded",
                id,
                messages: page.messages.map(reviveMessage),
                before: page.before,
            });
        })
            .catch(() => {
            if (mounted.current)
                dispatch({ type: "thread-failed", id });
        });
    }, []);
    const reloadThread = useCallback(() => {
        const id = live.current.state.openId;
        if (id)
            loadThread(id);
    }, [loadThread]);
    const loadOlder = useCallback(() => {
        const { state: now, transport: t } = live.current;
        const id = now.openId;
        const thread = id ? now.threads[id] : undefined;
        if (!id || !thread || thread.loadingOlder || thread.before === null)
            return;
        dispatch({ type: "older-loading", id });
        t.messages(id, { before: thread.before })
            .then((page) => {
            if (!mounted.current)
                return;
            dispatch({
                type: "older-loaded",
                id,
                messages: page.messages.map(reviveMessage),
                before: page.before,
            });
        })
            .catch(() => {
            if (mounted.current)
                dispatch({ type: "older-failed", id });
        });
    }, []);
    useEffect(() => {
        reload();
        return () => listRequest.current?.abort();
    }, [reload]);
    // ── which conversation is open ──
    const controlled = conversationId !== undefined;
    useEffect(() => {
        if (controlled)
            dispatch({ type: "open", id: conversationId ?? null });
    }, [controlled, conversationId]);
    const select = useCallback((id) => {
        const { options: o } = live.current;
        if (o.conversationId === undefined)
            dispatch({ type: "open", id });
        o.onConversationChange?.(id);
    }, []);
    void onConversationChange;
    const openId = state.openId;
    const openThread = openId ? state.threads[openId] : undefined;
    const openKnown = openId ? state.conversations.some((c) => c.id === openId) : false;
    // Opening a conversation loads its newest page — also one opened before:
    // what arrived while it was closed is not in what was kept.
    const opened = useRef(null);
    useEffect(() => {
        if (!openId) {
            opened.current = null;
            return;
        }
        if (opened.current === openId)
            return;
        opened.current = openId;
        loadThread(openId);
    }, [openId, loadThread]);
    // A link to a conversation the list does not hold: fetch that one.
    const listReady = state.status === "ready";
    useEffect(() => {
        if (!openId || openKnown || !listReady)
            return;
        const fetchOne = live.current.transport.conversation;
        if (!fetchOne)
            return;
        const request = new AbortController();
        fetchOne(openId, { signal: request.signal })
            .then((c) => {
            if (!request.signal.aborted) {
                dispatch({ type: "conversation", conversation: reviveConversation(c) });
            }
        })
            .catch(() => undefined);
        return () => request.abort();
    }, [openId, openKnown, listReady]);
    // ── the read mark ──
    const readTimer = useRef(null);
    const seen = useCallback(() => {
        // Deferred by a tick: the thread calls this from its own effect, which
        // runs before this hook has taken in the render that drew the messages.
        // Read then, the state is one render old — the conversation's badge was
        // cleared on screen and the server was never told (found by
        // test/browser-messenger.mjs).
        setTimeout(() => {
            if (!mounted.current || !visible())
                return;
            const { state: now, transport: t } = live.current;
            const id = now.openId;
            const thread = id ? now.threads[id] : undefined;
            if (!id || !thread)
                return;
            const conversation = now.conversations.find((c) => c.id === id);
            const newest = newestFromOthers(thread.messages, now.viewerId);
            // Nothing of anybody else's is shown yet: nothing has been read.
            if (!newest)
                return;
            const moved = readMarkToSend(conversation, thread.messages, now.viewerId);
            // The mark is already there, and no badge says otherwise.
            if (!moved && !conversation?.unread)
                return;
            const at = moved ?? newest.createdAt;
            dispatch({ type: "read", conversationId: id, actorId: now.viewerId, at });
            if (!t.markRead)
                return;
            if (readTimer.current)
                clearTimeout(readTimer.current);
            readTimer.current = setTimeout(() => {
                // A mark that fails to save is sent again with the next message read.
                t.markRead?.(id, at).catch(() => undefined);
            }, READ_DEBOUNCE_MS);
        }, 0);
    }, []);
    const setFollowing = useCallback((next) => {
        following.current = next;
    }, []);
    // ── what happens elsewhere ──
    const typingTimers = useRef(new Map());
    const refreshAt = useRef(0);
    const onEvent = useCallback((event) => {
        if (!mounted.current)
            return;
        const now = live.current.state;
        switch (event.type) {
            case "message": {
                const message = reviveMessage(event.message);
                const isOpen = now.openId === message.threadId;
                const isSeen = isOpen && visible() && following.current;
                dispatch({ type: "message", message, seen: isSeen, agents: agentList() });
                // A conversation the list has never heard of: somebody started it.
                if (!now.conversations.some((c) => c.id === message.threadId))
                    reload();
                if (isSeen && message.authorId !== now.viewerId) {
                    // `seen` reads the state a tick later, when it holds the message.
                    seen();
                }
                break;
            }
            case "message-removed":
                dispatch(event);
                break;
            case "read":
                dispatch({ ...event, at: toDate(event.at) });
                break;
            case "typing": {
                const key = `${event.conversationId}:${event.actorId}`;
                const timers = typingTimers.current;
                const running = timers.get(key);
                if (running)
                    clearTimeout(running);
                timers.delete(key);
                dispatch(event);
                if (event.typing) {
                    // Nobody types forever: a "stopped" that never arrives must not
                    // leave the dots running.
                    timers.set(key, setTimeout(() => {
                        timers.delete(key);
                        if (mounted.current)
                            dispatch({ ...event, typing: false });
                    }, TYPING_TTL_MS));
                }
                break;
            }
            case "presence":
                dispatch(event);
                break;
            case "conversation":
                dispatch({ type: "conversation", conversation: reviveConversation(event.conversation) });
                break;
            case "conversation-removed":
                dispatch(event);
                if (now.openId === event.conversationId)
                    live.current.options.onConversationChange?.(null);
                break;
            case "refresh":
                reload();
                reloadThread();
                break;
            case "connection":
                dispatch(event);
                if (event.state === "online" && now.connection !== "online") {
                    // Whatever was missed while away.
                    reload();
                    reloadThread();
                }
                break;
        }
    }, [agentList, reload, reloadThread, seen]);
    const subscribe = transport.subscribe;
    useEffect(() => {
        if (!subscribe)
            return;
        return subscribe({ conversationId: openId }, onEvent);
    }, [subscribe, openId, onEvent]);
    // Coming back to the tab: what arrived while it was hidden is loaded, and
    // what is on screen counts as read.
    useEffect(() => {
        if (typeof document === "undefined")
            return;
        const back = () => {
            if (!visible())
                return;
            const at = Date.now();
            if (at - refreshAt.current > REFRESH_EVERY_MS) {
                refreshAt.current = at;
                reload();
                reloadThread();
            }
            if (following.current)
                seen();
        };
        document.addEventListener("visibilitychange", back);
        window.addEventListener("online", back);
        return () => {
            document.removeEventListener("visibilitychange", back);
            window.removeEventListener("online", back);
        };
    }, [reload, reloadThread, seen]);
    // ── agents that were asked ──
    const patience = options.agentPatienceMs ?? AGENT_PATIENCE_MS;
    const agentTimers = useRef(new Map());
    useEffect(() => {
        const timers = agentTimers.current;
        const waiting = new Set();
        for (const [conversation, list] of Object.entries(state.awaited)) {
            for (const entry of list) {
                if (entry.state !== "thinking")
                    continue;
                const key = `${conversation}:${entry.agentId}`;
                waiting.add(key);
                if (timers.has(key))
                    continue;
                timers.set(key, setTimeout(() => {
                    timers.delete(key);
                    if (mounted.current) {
                        dispatch({
                            type: "agent-quiet",
                            conversationId: conversation,
                            agentId: entry.agentId,
                        });
                    }
                }, patience));
            }
        }
        for (const [key, timer] of timers) {
            if (waiting.has(key))
                continue;
            clearTimeout(timer);
            timers.delete(key);
        }
    }, [state.awaited, patience]);
    useEffect(() => {
        const typing = typingTimers.current;
        const awaiting = agentTimers.current;
        return () => {
            for (const timer of typing.values())
                clearTimeout(timer);
            for (const timer of awaiting.values())
                clearTimeout(timer);
            if (readTimer.current)
                clearTimeout(readTimer.current);
            typing.clear();
            awaiting.clear();
        };
    }, []);
    // ── writing ──
    const deliver = useCallback((message) => {
        const { transport: t } = live.current;
        const clientId = message.clientId ?? message.id;
        dispatch({
            type: "message",
            message: { ...message, clientId, delivery: "sending" },
            seen: true,
            agents: agentList(),
        });
        t.send(message.threadId, {
            clientId,
            body: message.body,
            attachments: message.attachments ?? [],
        })
            .then((stored) => {
            if (!mounted.current)
                return;
            dispatch({
                type: "message",
                // The stored row must carry the client id, or it would be drawn
                // beside the bubble it confirms.
                message: { ...reviveMessage(stored), clientId: stored.clientId ?? clientId },
                seen: true,
                agents: agentList(),
            });
        })
            .catch(() => {
            if (mounted.current) {
                dispatch({ type: "send-failed", conversationId: message.threadId, clientId });
            }
        });
    }, [agentList]);
    const lastTyped = useRef(0);
    const send = useCallback(async (body, attachments) => {
        const { state: now, transport: t } = live.current;
        const id = now.openId;
        if (!id)
            return false;
        const clientId = newId("m");
        lastTyped.current = 0;
        t.typing?.(id, false);
        deliver({
            id: clientId,
            clientId,
            threadId: id,
            authorId: now.viewerId,
            body,
            createdAt: new Date(),
            ...(attachments.length > 0 ? { attachments } : {}),
        });
        return true;
    }, [deliver]);
    const retry = useCallback((message) => deliver({ ...message, createdAt: new Date() }), [deliver]);
    const discard = useCallback((message) => {
        dispatch({ type: "message-removed", conversationId: message.threadId, messageId: message.id });
    }, []);
    const edit = useCallback(async (message, body) => {
        const { transport: t } = live.current;
        if (!t.edit)
            return false;
        const settings = { seen: true, agents: agentList() };
        dispatch({
            type: "message",
            message: { ...message, body, editedAt: new Date() },
            ...settings,
        });
        try {
            const stored = await t.edit(message, body);
            dispatch({ type: "message", message: reviveMessage(stored), ...settings });
            return true;
        }
        catch {
            dispatch({ type: "message", message, ...settings });
            return false;
        }
    }, [agentList]);
    const remove = useCallback(async (message) => {
        const { transport: t } = live.current;
        if (!t.remove)
            return false;
        dispatch({
            type: "message-removed",
            conversationId: message.threadId,
            messageId: message.id,
        });
        try {
            await t.remove(message);
            return true;
        }
        catch {
            dispatch({ type: "message", message, seen: true, agents: agentList() });
            return false;
        }
    }, [agentList]);
    const typed = useCallback(() => {
        const { state: now, transport: t } = live.current;
        if (!now.openId || !t.typing)
            return;
        const at = Date.now();
        if (at - lastTyped.current < TYPING_EVERY_MS)
            return;
        lastTyped.current = at;
        t.typing(now.openId, true);
    }, []);
    const start = useCallback(async (personIds) => {
        const { transport: t } = live.current;
        if (!t.open)
            return false;
        try {
            const conversation = reviveConversation(await t.open(personIds));
            dispatch({ type: "conversation", conversation });
            select(conversation.id);
            return true;
        }
        catch {
            return false;
        }
    }, [select]);
    const leave = useCallback(async (id) => {
        const { transport: t, state: now, options: o } = live.current;
        if (!t.leave)
            return false;
        try {
            await t.leave([id]);
            const wasOpen = now.openId === id;
            dispatch({ type: "conversation-removed", conversationId: id });
            if (wasOpen)
                o.onConversationChange?.(null);
            return true;
        }
        catch {
            return false;
        }
    }, []);
    const dismissAgent = useCallback((agentId) => {
        const id = live.current.state.openId;
        if (id)
            dispatch({ type: "agent-dismissed", conversationId: id, agentId });
    }, []);
    const open = useMemo(() => (openId ? (state.conversations.find((c) => c.id === openId) ?? null) : null), [openId, state.conversations]);
    void agents;
    return {
        state,
        open,
        thread: openThread ?? null,
        select,
        reload,
        reloadThread,
        loadOlder,
        send,
        retry,
        discard,
        edit,
        remove,
        typed,
        seen,
        setFollowing,
        start,
        leave,
        dismissAgent,
    };
}
//# sourceMappingURL=use-messenger.js.map