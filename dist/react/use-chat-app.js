"use client";
import { useEffect, useRef, useState } from "react";
import { deriveTitle, newId, pickRestored, } from "../conversations.js";
const TEMP = "tmp";
export const isTemporaryId = (id) => !!id && id.startsWith(`${TEMP}-`);
function messageAttachments(list) {
    if (list.length === 0)
        return undefined;
    return list.map((a) => a.kind === "image"
        ? { kind: "image", name: a.name, previewUrl: `data:${a.mimeType};base64,${a.dataBase64}` }
        : { kind: "text", name: a.name });
}
function readRemembered(key) {
    if (!key)
        return null;
    try {
        return globalThis.localStorage?.getItem(key) ?? null;
    }
    catch {
        return null;
    }
}
function writeRemembered(key, id) {
    if (!key)
        return;
    try {
        if (id)
            globalThis.localStorage?.setItem(key, id);
        else
            globalThis.localStorage?.removeItem(key);
    }
    catch {
        /* private mode: the chat simply does not reopen after a reload */
    }
}
/**
 * Everything ChatApp does that is not drawing: the list, the open chat, new
 * and temporary chats, turns (one per conversation, each running on when the
 * person opens another chat), the queue, titles and the reopen-on-reload.
 */
export function useChatApp({ store, transport, makeTitle, conversationId, onConversationChange, rememberKey, }) {
    const [list, setList] = useState([]);
    const [listState, setListState] = useState("loading");
    const [activeId, setActiveId] = useState(null);
    const [temporary, setTemporary] = useState(false);
    const [threads, setThreads] = useState({});
    const [loadingId, setLoadingId] = useState(null);
    const [live, setLive] = useState({});
    const [stopped, setStopped] = useState({});
    const [queue, setQueue] = useState([]);
    const [problem, setProblem] = useState(null);
    const [reload, setReload] = useState(0);
    // Async work reads the CURRENT state through these, never a stale closure.
    const threadsRef = useRef(threads);
    const queueRef = useRef(queue);
    const activeRef = useRef(activeId);
    const temporaryRef = useRef(temporary);
    const controllers = useRef(new Map());
    const restored = useRef(false);
    const transportRef = useRef(transport);
    const titleRef = useRef(makeTitle);
    useEffect(() => {
        transportRef.current = transport;
        titleRef.current = makeTitle;
    });
    const setThreadsNow = (fn) => {
        threadsRef.current = fn(threadsRef.current);
        setThreads(threadsRef.current);
    };
    const setQueueNow = (fn) => {
        queueRef.current = fn(queueRef.current);
        setQueue(queueRef.current);
    };
    const select = (id, temp) => {
        activeRef.current = id;
        temporaryRef.current = temp;
        setActiveId(id);
        setTemporary(temp);
    };
    /** Leaving a temporary chat ends it: its turn stops, its words are gone. */
    const leaveTemporary = () => {
        const id = activeRef.current;
        if (!isTemporaryId(id))
            return;
        controllers.current.get(id)?.abort();
        setThreadsNow((t) => {
            const next = { ...t };
            delete next[id];
            return next;
        });
        setQueueNow((q) => q.filter((item) => item.conversation !== id));
    };
    const open = (id) => {
        if (id === activeRef.current)
            return;
        leaveTemporary();
        select(id, false);
        if (threadsRef.current[id])
            return;
        setLoadingId(id);
        store
            .get(id)
            .then((c) => {
            if (c) {
                setThreadsNow((t) => ({ ...t, [id]: c.messages }));
            }
            else {
                // Deleted elsewhere: drop the row and land on a new chat.
                setList((l) => l.filter((row) => row.id !== id));
                if (activeRef.current === id)
                    select(null, false);
            }
        })
            .catch(() => setProblem("open"))
            .finally(() => setLoadingId((cur) => (cur === id ? null : cur)));
    };
    // The list, and on the first load the chat that was open before the reload.
    useEffect(() => {
        let alive = true;
        setListState("loading");
        store
            .list()
            .then((rows) => {
            if (!alive)
                return;
            setList(rows);
            setListState("ready");
            if (!restored.current) {
                restored.current = true;
                const id = pickRestored(rows, conversationId, readRemembered(rememberKey));
                if (id)
                    open(id);
            }
        })
            .catch(() => {
            if (!alive)
                return;
            restored.current = true;
            setListState("error");
        });
        return () => {
            alive = false;
        };
        // `open` and the ids are read once, at load; a store change reloads.
    }, [store, reload]);
    // A product that keeps the open chat in its URL drives it from there.
    useEffect(() => {
        if (conversationId === undefined || !restored.current)
            return;
        if (conversationId === null) {
            if (activeRef.current && !isTemporaryId(activeRef.current))
                select(null, false);
        }
        else if (conversationId !== activeRef.current)
            open(conversationId);
    }, [conversationId]);
    // Remember the open chat (never a temporary one) and tell the product.
    const stored = isTemporaryId(activeId) ? null : activeId;
    useEffect(() => {
        if (!restored.current)
            return;
        writeRemembered(rememberKey, stored);
        onConversationChange?.(stored);
    }, [stored]);
    const save = (id, message) => {
        if (isTemporaryId(id))
            return;
        store.append(id, message).catch(() => setProblem("save"));
        const at = new Date().toISOString();
        setList((l) => {
            const row = l.find((c) => c.id === id);
            return row ? [{ ...row, updatedAt: at }, ...l.filter((c) => c.id !== id)] : l;
        });
    };
    const push = (id, message) => setThreadsNow((t) => ({ ...t, [id]: [...(t[id] ?? []), message] }));
    const runTurn = async (id, text, attachments, history) => {
        const temp = isTemporaryId(id);
        const controller = new AbortController();
        controllers.current.set(id, controller);
        setStopped((s) => ({ ...s, [id]: false }));
        setLive((l) => ({ ...l, [id]: {} }));
        let soFar = {};
        let ok = false;
        try {
            const result = await transportRef.current({
                conversationId: temp ? null : id,
                temporary: temp,
                text,
                attachments,
                history,
                signal: controller.signal,
                update: (next) => {
                    soFar = { ...soFar, ...next };
                    if (!controller.signal.aborted)
                        setLive((l) => (id in l ? { ...l, [id]: soFar } : l));
                },
            });
            if (controller.signal.aborted)
                throw new DOMException("stopped", "AbortError");
            const answer = typeof result === "string" ? { content: result } : result;
            const message = { ...answer, id: newId("m"), role: "assistant" };
            push(id, message);
            save(id, message);
            ok = true;
            if (!temp && history.length === 0 && titleRef.current) {
                void Promise.resolve(titleRef.current({ text, answer: answer.content }))
                    .then((title) => (title?.trim() ? rename(id, title.trim()) : undefined))
                    .catch(() => {
                    /* the derived title stays */
                });
            }
        }
        catch {
            if (controller.signal.aborted) {
                // Stopped: what had arrived is kept, as the apps keep a half answer.
                if (soFar.text?.trim()) {
                    const message = {
                        id: newId("m"),
                        role: "assistant",
                        content: soFar.text,
                    };
                    push(id, message);
                    save(id, message);
                }
                else
                    setStopped((s) => ({ ...s, [id]: true }));
            }
            else {
                push(id, { id: newId("m"), role: "assistant", content: "", failed: true });
            }
        }
        finally {
            controllers.current.delete(id);
            setLive((l) => {
                const next = { ...l };
                delete next[id];
                return next;
            });
        }
        // The next queued message goes once a turn lands; a failed or stopped
        // turn leaves the queue standing behind it, to be sent or removed.
        if (ok) {
            const next = queueRef.current.find((q) => q.conversation === id);
            if (next) {
                setQueueNow((q) => q.filter((item) => item.id !== next.id));
                void sendIn(id, next.text, next.attachments);
            }
        }
    };
    const sendIn = async (id, text, attachments) => {
        const history = (threadsRef.current[id] ?? []).filter((m) => !m.failed);
        const message = {
            id: newId("m"),
            role: "user",
            content: text,
            ...(attachments.length ? { attachments: messageAttachments(attachments) } : {}),
        };
        push(id, message);
        save(id, message);
        await runTurn(id, text, attachments, history);
    };
    /** Composer's onSend. Resolves false to keep the draft (nothing was sent). */
    const send = async (text, attachments = []) => {
        let id = activeRef.current;
        if (id && controllers.current.has(id)) {
            setQueueNow((q) => [...q, { id: newId("q"), conversation: id, text, attachments }]);
            return true;
        }
        if (!id) {
            if (temporaryRef.current) {
                id = newId(TEMP);
            }
            else {
                try {
                    const created = await store.create({ title: deriveTitle(text) ?? "" });
                    id = created.id;
                    setList((l) => [created, ...l.filter((c) => c.id !== created.id)]);
                }
                catch {
                    setProblem("save");
                    return false;
                }
            }
            setThreadsNow((t) => ({ ...t, [id]: [] }));
            select(id, temporaryRef.current);
        }
        void sendIn(id, text, attachments);
        return true;
    };
    const stop = () => {
        const id = activeRef.current;
        if (id)
            controllers.current.get(id)?.abort();
    };
    /** Retry after a failed or stopped turn: the last message goes again. */
    const retry = () => {
        const id = activeRef.current;
        if (!id || controllers.current.has(id))
            return;
        const thread = threadsRef.current[id] ?? [];
        const kept = thread.filter((m) => !m.failed);
        const lastUser = [...kept].reverse().find((m) => m.role === "user");
        if (!lastUser)
            return;
        setThreadsNow((t) => ({ ...t, [id]: kept }));
        const history = kept.slice(0, kept.indexOf(lastUser));
        void runTurn(id, lastUser.content, [], history);
    };
    const newChat = () => {
        leaveTemporary();
        select(null, false);
    };
    /** In an empty new chat, switch it to temporary and back; in a chat with
     *  words in it, start a new temporary one. */
    const toggleTemporary = () => {
        const id = activeRef.current;
        if (!id) {
            select(null, !temporaryRef.current);
            return;
        }
        leaveTemporary();
        select(null, !isTemporaryId(id));
    };
    const rename = async (id, title) => {
        setList((l) => l.map((c) => (c.id === id ? { ...c, title } : c)));
        try {
            await store.rename(id, title);
        }
        catch {
            setProblem("save");
        }
    };
    const remove = async (id) => {
        controllers.current.get(id)?.abort();
        setList((l) => l.filter((c) => c.id !== id));
        setThreadsNow((t) => {
            const next = { ...t };
            delete next[id];
            return next;
        });
        setQueueNow((q) => q.filter((item) => item.conversation !== id));
        if (activeRef.current === id)
            select(null, false);
        try {
            await store.remove(id);
        }
        catch {
            setProblem("save");
            setReload((n) => n + 1);
        }
    };
    const key = activeId ?? "";
    return {
        list,
        listState,
        reloadList: () => setReload((n) => n + 1),
        activeId,
        stored,
        temporary,
        messages: threads[key] ?? [],
        loading: loadingId !== null && loadingId === activeId,
        live: live[key] ?? null,
        busy: key in live,
        busyIds: new Set(Object.keys(live)),
        stopped: !!stopped[key],
        queued: queue.filter((q) => q.conversation === activeId),
        unqueue: (qid) => setQueueNow((q) => q.filter((item) => item.id !== qid)),
        problem,
        clearProblem: () => setProblem(null),
        send,
        stop,
        retry,
        open,
        newChat,
        toggleTemporary,
        rename,
        remove,
    };
}
//# sourceMappingURL=use-chat-app.js.map