"use client";

import { useEffect, useRef, useState } from "react";
import type { Attachment } from "../attachments.js";
import {
  deriveTitle,
  newId,
  pickRestored,
  type ConversationStore,
  type ConversationSummary,
  type MessageAttachment,
} from "../conversations.js";
import type { ChatFailure, ChatMessageData, LiveTurn, MessageChip } from "./Thread.js";

/** One turn, as ChatApp hands it to the product. */
export type ChatTurn = {
  /** The stored conversation, or null in a temporary chat (nothing is kept). */
  conversationId: string | null;
  /** This chat's id on the page: the stored id, or — in a temporary chat — a
   *  page-only id, the one `onTemporaryEnd` names when the chat ends. A
   *  product that keeps a hidden server row for a temporary chat keys it here. */
  chatId: string;
  temporary: boolean;
  /** What the person wrote (or the composer's attachment-only words). */
  text: string;
  attachments: Attachment[];
  /** The conversation BEFORE this message, failed turns left out. */
  history: ChatMessageData[];
  /** Aborted by Stop, by deleting the chat, or when a temporary chat is left. */
  signal: AbortSignal;
  /** What has arrived so far — the WHOLE text each time, a status line before
   *  the first word, the steps taken. Call it as often as you like. */
  update: (live: LiveTurn) => void;
  /** Whether Stop keeps what has arrived for THIS turn, overriding ChatApp's
   *  `stopKeepsPartial` — `false` while the text so far is unchecked (Heidi's
   *  variety gate), `true` once it is. Call it any time before the turn ends. */
  stopKeepsPartial: (keep: boolean) => void;
};

/**
 * Throw this from a transport to say why a turn failed in the reader's
 * words: the failed bubble shows `message`, and `kind` (the product's own
 * code, e.g. "quota" or "no-vision") travels with that message as
 * `failure.kind` for a footer to link the fix. Any other error shows the
 * thread's `failed` label — a raw `TypeError: Failed to fetch` is never
 * shown to a reader — unless ChatApp's `failureMessage` maps it.
 */
export class ChatTurnError extends Error {
  readonly kind?: string;
  constructor(message: string, options: { kind?: string; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ChatTurnError";
    this.kind = options.kind;
  }
}

/**
 * What a failed turn keeps: a `ChatTurnError`'s words and kind, a plain
 * `{ message, kind }` object as thrown, or what `map` makes of anything
 * else. Never an ordinary Error's message — that is for the console.
 */
export function chatTurnFailure(
  error: unknown,
  map?: (error: unknown) => string | null | undefined,
): ChatFailure {
  if (error instanceof ChatTurnError) {
    return { message: error.message, ...(error.kind ? { kind: error.kind } : {}) };
  }
  const mapped = map?.(error);
  if (mapped) return { message: mapped };
  if (error && typeof error === "object" && !(error instanceof Error)) {
    const { message, kind } = error as { message?: unknown; kind?: unknown };
    const out: ChatFailure = {};
    if (typeof message === "string" && message.trim()) out.message = message;
    if (typeof kind === "string" && kind) out.kind = kind;
    return out;
  }
  return {};
}

/** How a page sends for the person (`ChatAppHandle.send`). */
export type SendOptions = {
  /** Start a new chat for it instead of adding to the open one. */
  newChat?: boolean;
  /** The product's own things shown on the person's message (see `MessageChip`). */
  chips?: readonly MessageChip[];
};

/** The answer: its words, or the whole message (replies, citations, thinking…). */
export type ChatTurnResult = string | (Omit<ChatMessageData, "id" | "role"> & { content: string });

/**
 * The product's one job: send a turn and resolve with the answer. Throw to
 * show a failed turn with Retry. Streaming is `turn.update`.
 */
export type ChatTransport = (turn: ChatTurn) => Promise<ChatTurnResult>;

export type ChatAppProblem = "load" | "save" | "open";

type Queued = {
  id: string;
  conversation: string;
  text: string;
  attachments: Attachment[];
  chips?: readonly MessageChip[];
};

const TEMP = "tmp";
export const isTemporaryId = (id: string | null | undefined) => !!id && id.startsWith(`${TEMP}-`);

function messageAttachments(list: Attachment[]): MessageAttachment[] | undefined {
  if (list.length === 0) return undefined;
  return list.map((a) =>
    a.kind === "image"
      ? { kind: "image", name: a.name, previewUrl: `data:${a.mimeType};base64,${a.dataBase64}` }
      : { kind: "text", name: a.name },
  );
}

function readRemembered(key: string | null): string | null {
  if (!key) return null;
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function writeRemembered(key: string | null, id: string | null) {
  if (!key) return;
  try {
    if (id) globalThis.localStorage?.setItem(key, id);
    else globalThis.localStorage?.removeItem(key);
  } catch {
    /* private mode: the chat simply does not reopen after a reload */
  }
}

export type UseChatAppOptions = {
  store: ConversationStore;
  transport: ChatTransport;
  makeTitle?: (first: { text: string; answer: string }) => string | null | Promise<string | null>;
  conversationId?: string | null;
  onConversationChange?: (id: string | null) => void;
  rememberKey: string | null;
  /** Stop keeps the half answer that had arrived. Default true. */
  stopKeepsPartial?: boolean;
  /** The words for a failed turn whose error is not a `ChatTurnError`. */
  failureMessage?: (error: unknown) => string | null | undefined;
  /** A temporary chat ended: left for a new or another chat, the page hidden
   *  or ChatApp unmounted. Called once per chat, with `turn.chatId`. */
  onTemporaryEnd?: (chatId: string) => void;
  /** Reopen the chat from before the reload. False when the page arrives
   *  with a message to send (it starts a new chat). Default true. */
  restore?: boolean;
};

/**
 * Everything ChatApp does that is not drawing: the list, the open chat, new
 * and temporary chats, turns (one per conversation, each running on when the
 * person opens another chat), the queue, titles and the reopen-on-reload.
 */
export function useChatApp({
  store,
  transport,
  makeTitle,
  conversationId,
  onConversationChange,
  rememberKey,
  stopKeepsPartial = true,
  failureMessage,
  onTemporaryEnd,
  restore = true,
}: UseChatAppOptions) {
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [temporary, setTemporary] = useState(false);
  const [threads, setThreads] = useState<Record<string, ChatMessageData[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, LiveTurn>>({});
  const [stopped, setStopped] = useState<Record<string, boolean>>({});
  const [queue, setQueue] = useState<Queued[]>([]);
  const [problem, setProblem] = useState<ChatAppProblem | null>(null);
  const [reload, setReload] = useState(0);
  const [ready, setReady] = useState(false);

  // Async work reads the CURRENT state through these, never a stale closure.
  const threadsRef = useRef(threads);
  const queueRef = useRef(queue);
  const activeRef = useRef(activeId);
  const temporaryRef = useRef(temporary);
  const controllers = useRef(new Map<string, AbortController>());
  const restored = useRef(false);
  const transportRef = useRef(transport);
  const titleRef = useRef(makeTitle);
  const optionsRef = useRef({ stopKeepsPartial, failureMessage, onTemporaryEnd });
  useEffect(() => {
    transportRef.current = transport;
    titleRef.current = makeTitle;
    optionsRef.current = { stopKeepsPartial, failureMessage, onTemporaryEnd };
  });
  // The files of each person's message, by its id, kept until its answer
  // lands: Retry after a failure sends the pictures again, not only the words.
  const turnFiles = useRef(new Map<string, Attachment[]>());
  const ended = useRef(new Set<string>());
  const readyWaiters = useRef<(() => void)[]>([]);
  const markReady = () => {
    restored.current = true;
    setReady(true);
    for (const go of readyWaiters.current.splice(0)) go();
  };
  /** Resolves once the list has loaded and the reopened chat is chosen, so a
   *  message sent from outside never lands before the restore moves away. */
  const whenReady = () =>
    restored.current ? Promise.resolve() : new Promise<void>((go) => readyWaiters.current.push(go));
  const endTemporary = (id: string | null) => {
    if (!isTemporaryId(id) || ended.current.has(id!)) return;
    ended.current.add(id!);
    optionsRef.current.onTemporaryEnd?.(id!);
  };

  const setThreadsNow = (fn: (t: Record<string, ChatMessageData[]>) => typeof t) => {
    threadsRef.current = fn(threadsRef.current);
    setThreads(threadsRef.current);
  };
  const setQueueNow = (fn: (q: Queued[]) => Queued[]) => {
    queueRef.current = fn(queueRef.current);
    setQueue(queueRef.current);
  };
  const select = (id: string | null, temp: boolean) => {
    activeRef.current = id;
    temporaryRef.current = temp;
    setActiveId(id);
    setTemporary(temp);
  };

  /** Leaving a temporary chat ends it: its turn stops, its words are gone. */
  const leaveTemporary = () => {
    const id = activeRef.current;
    if (!isTemporaryId(id)) return;
    controllers.current.get(id!)?.abort();
    for (const m of threadsRef.current[id!] ?? []) turnFiles.current.delete(m.id);
    setThreadsNow((t) => {
      const next = { ...t };
      delete next[id!];
      return next;
    });
    setQueueNow((q) => q.filter((item) => item.conversation !== id));
    endTemporary(id);
  };

  // A temporary chat also ends when the page goes away or ChatApp unmounts.
  // (StrictMode's rehearsal unmount finds no temporary chat: one only exists
  // after a first message.)
  useEffect(() => {
    const hide = () => endTemporary(activeRef.current);
    globalThis.addEventListener?.("pagehide", hide);
    return () => {
      globalThis.removeEventListener?.("pagehide", hide);
      hide();
    };
    // Reads everything through refs.
  }, []);

  const open = (id: string) => {
    if (id === activeRef.current) return;
    leaveTemporary();
    select(id, false);
    if (threadsRef.current[id]) return;
    setLoadingId(id);
    store
      .get(id)
      .then((c) => {
        if (c) {
          setThreadsNow((t) => ({ ...t, [id]: c.messages as ChatMessageData[] }));
        } else {
          // Deleted elsewhere: drop the row and land on a new chat.
          setList((l) => l.filter((row) => row.id !== id));
          if (activeRef.current === id) select(null, false);
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
        if (!alive) return;
        setList(rows);
        setListState("ready");
        if (!restored.current) {
          const id = restore
            ? pickRestored(rows, conversationId, readRemembered(rememberKey))
            : null;
          // An outside send may already have opened a chat: never move off it.
          if (id && activeRef.current === null) open(id);
          markReady();
        }
      })
      .catch(() => {
        if (!alive) return;
        setListState("error");
        if (!restored.current) markReady();
      });
    return () => {
      alive = false;
    };
    // `open` and the ids are read once, at load; a store change reloads.
  }, [store, reload]);

  // A product that keeps the open chat in its URL drives it from there.
  useEffect(() => {
    if (conversationId === undefined || !restored.current) return;
    if (conversationId === null) {
      if (activeRef.current && !isTemporaryId(activeRef.current)) select(null, false);
    } else if (conversationId !== activeRef.current) open(conversationId);
  }, [conversationId]);

  // Remember the open chat (never a temporary one) and tell the product.
  const stored = isTemporaryId(activeId) ? null : activeId;
  useEffect(() => {
    if (!restored.current) return;
    writeRemembered(rememberKey, stored);
    onConversationChange?.(stored);
  }, [stored]);

  const save = (id: string, message: ChatMessageData) => {
    if (isTemporaryId(id)) return;
    store.append(id, message).catch(() => setProblem("save"));
    const at = new Date().toISOString();
    setList((l) => {
      const row = l.find((c) => c.id === id);
      return row ? [{ ...row, updatedAt: at }, ...l.filter((c) => c.id !== id)] : l;
    });
  };
  const push = (id: string, message: ChatMessageData) =>
    setThreadsNow((t) => ({ ...t, [id]: [...(t[id] ?? []), message] }));

  const runTurn = async (
    id: string,
    text: string,
    attachments: Attachment[],
    history: ChatMessageData[],
  ) => {
    const temp = isTemporaryId(id);
    const controller = new AbortController();
    controllers.current.set(id, controller);
    setStopped((s) => ({ ...s, [id]: false }));
    setLive((l) => ({ ...l, [id]: {} }));
    let soFar: LiveTurn = {};
    let ok = false;
    let keepPartial: boolean | null = null;
    const asked = [...(threadsRef.current[id] ?? [])].reverse().find((m) => m.role === "user");
    try {
      const result = await transportRef.current({
        conversationId: temp ? null : id,
        chatId: id,
        temporary: temp,
        text,
        attachments,
        history,
        signal: controller.signal,
        update: (next) => {
          soFar = { ...soFar, ...next };
          if (!controller.signal.aborted) setLive((l) => (id in l ? { ...l, [id]: soFar } : l));
        },
        stopKeepsPartial: (keep) => {
          keepPartial = keep;
        },
      });
      if (controller.signal.aborted) throw new DOMException("stopped", "AbortError");
      const answer = typeof result === "string" ? { content: result } : result;
      const message: ChatMessageData = { ...answer, id: newId("m"), role: "assistant" };
      push(id, message);
      save(id, message);
      ok = true;
      if (asked) turnFiles.current.delete(asked.id);
      if (!temp && history.length === 0 && titleRef.current) {
        void Promise.resolve(titleRef.current({ text, answer: answer.content }))
          .then((title) => (title?.trim() ? rename(id, title.trim()) : undefined))
          .catch(() => {
            /* the derived title stays */
          });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        // Stopped: what had arrived is kept, as the apps keep a half answer —
        // unless the product says this turn's text is not fit to keep.
        const keep = keepPartial ?? optionsRef.current.stopKeepsPartial;
        if (keep && soFar.text?.trim()) {
          if (asked) turnFiles.current.delete(asked.id);
          const message: ChatMessageData = {
            id: newId("m"),
            role: "assistant",
            content: soFar.text,
          };
          push(id, message);
          save(id, message);
        } else setStopped((s) => ({ ...s, [id]: true }));
      } else {
        const failure = chatTurnFailure(error, optionsRef.current.failureMessage);
        push(id, {
          id: newId("m"),
          role: "assistant",
          content: failure.message ?? "",
          failed: true,
          ...(failure.message || failure.kind ? { failure } : {}),
        });
      }
    } finally {
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
        void sendIn(id, next.text, next.attachments, next.chips);
      }
    }
  };

  const sendIn = async (
    id: string,
    text: string,
    attachments: Attachment[],
    chips?: readonly MessageChip[],
  ) => {
    const history = (threadsRef.current[id] ?? []).filter((m) => !m.failed);
    const message: ChatMessageData = {
      id: newId("m"),
      role: "user",
      content: text,
      ...(attachments.length ? { attachments: messageAttachments(attachments) } : {}),
      ...(chips && chips.length ? { chips } : {}),
    };
    if (attachments.length) turnFiles.current.set(message.id, attachments);
    push(id, message);
    save(id, message);
    await runTurn(id, text, attachments, history);
  };

  /** Composer's onSend. Resolves false to keep the draft (nothing was sent). */
  const send = async (
    text: string,
    attachments: Attachment[] = [],
    options: SendOptions = {},
  ): Promise<boolean> => {
    const { chips } = options;
    if (options.newChat) newChat();
    let id = activeRef.current;
    if (id && controllers.current.has(id)) {
      setQueueNow((q) => [...q, { id: newId("q"), conversation: id!, text, attachments, chips }]);
      return true;
    }
    if (!id) {
      if (temporaryRef.current) {
        id = newId(TEMP);
      } else {
        try {
          const created = await store.create({ title: deriveTitle(text) ?? "" });
          id = created.id;
          setList((l) => [created, ...l.filter((c) => c.id !== created.id)]);
        } catch {
          setProblem("save");
          return false;
        }
      }
      setThreadsNow((t) => ({ ...t, [id!]: [] }));
      select(id, temporaryRef.current);
    }
    void sendIn(id, text, attachments, chips);
    return true;
  };

  const stop = () => {
    const id = activeRef.current;
    if (id) controllers.current.get(id)?.abort();
  };

  /** Retry after a failed or stopped turn: the last message goes again. */
  const retry = () => {
    const id = activeRef.current;
    if (!id || controllers.current.has(id)) return;
    const thread = threadsRef.current[id] ?? [];
    const kept = thread.filter((m) => !m.failed);
    const lastUser = [...kept].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setThreadsNow((t) => ({ ...t, [id]: kept }));
    const history = kept.slice(0, kept.indexOf(lastUser));
    void runTurn(id, lastUser.content, turnFiles.current.get(lastUser.id) ?? [], history);
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

  const rename = async (id: string, title: string) => {
    setList((l) => l.map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      await store.rename(id, title);
    } catch {
      setProblem("save");
    }
  };

  const remove = async (id: string) => {
    controllers.current.get(id)?.abort();
    for (const m of threadsRef.current[id] ?? []) turnFiles.current.delete(m.id);
    setList((l) => l.filter((c) => c.id !== id));
    setThreadsNow((t) => {
      const next = { ...t };
      delete next[id];
      return next;
    });
    setQueueNow((q) => q.filter((item) => item.conversation !== id));
    if (activeRef.current === id) select(null, false);
    try {
      await store.remove(id);
    } catch {
      setProblem("save");
      setReload((n) => n + 1);
    }
  };

  const key = activeId ?? "";
  return {
    list,
    listState,
    /** The list has loaded (or failed) and the reopened chat is chosen. */
    ready,
    whenReady,
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
    unqueue: (qid: string) => setQueueNow((q) => q.filter((item) => item.id !== qid)),
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

export type ChatAppController = ReturnType<typeof useChatApp>;
