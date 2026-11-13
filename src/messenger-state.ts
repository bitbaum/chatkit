/**
 * The Messenger's state, as one pure function.
 *
 * Everything that can happen to a messenger — a list loads, a conversation is
 * opened, a message is sent, fails, arrives from elsewhere, is read — is an
 * action, and what the screen shows after it is `messengerReducer(state,
 * action)`. No timers, no network, no DOM: the hook (`useMessenger`) does
 * those and only reports what happened. So "a message that arrives twice is
 * shown once" and "opening a conversation clears its badge" are tests that
 * run in Node, not hopes about an effect order.
 */
import {
  mentionedAgents,
  mergeThread,
  participantOf,
  sortByNewest,
  upsertConversation,
  withMessage,
  withRead,
  type MessengerAgent,
  type MessengerConversation,
  type MessengerMessage,
  type MessengerReaction,
} from "./messenger.js";

export type MessengerThreadState = {
  status: "loading" | "ready" | "failed";
  /** Oldest first. */
  messages: MessengerMessage[];
  /** The cursor for the page before the oldest shown; `null` when there is none. */
  before: string | null;
  loadingOlder: boolean;
  olderFailed: boolean;
  /**
   * The viewer's read mark when the thread was opened: where the "New" line
   * is drawn. Fixed for as long as the thread stays open, so the line does
   * not vanish the moment its messages are read.
   */
  unreadFrom: Date | null;
};

/** An agent somebody just called on: answering, or silent past its patience. */
export type MessengerAwaited = { agentId: string; state: "thinking" | "quiet" };

export type MessengerState = {
  viewerId: string;
  status: "loading" | "ready" | "failed";
  conversations: MessengerConversation[];
  openId: string | null;
  threads: Record<string, MessengerThreadState>;
  /** Who is typing, per conversation (never the viewer). */
  typing: Record<string, string[]>;
  awaited: Record<string, MessengerAwaited[]>;
  connection: "online" | "reconnecting" | "offline";
};

export type MessengerAction =
  | { type: "list-loading" }
  | { type: "list-loaded"; conversations: MessengerConversation[] }
  | { type: "list-failed" }
  | { type: "open"; id: string | null }
  | { type: "thread-loading"; id: string }
  | { type: "thread-loaded"; id: string; messages: MessengerMessage[]; before: string | null }
  | { type: "thread-failed"; id: string }
  | { type: "older-loading"; id: string }
  | { type: "older-loaded"; id: string; messages: MessengerMessage[]; before: string | null }
  | { type: "older-failed"; id: string }
  /**
   * A message exists: just written by the viewer (with `delivery: "sending"`),
   * stored by the server, or arrived from elsewhere. `seen` says whether the
   * viewer is looking at it now.
   */
  | {
      type: "message";
      message: MessengerMessage;
      seen: boolean;
      agents?: readonly MessengerAgent[];
    }
  | { type: "send-failed"; conversationId: string; clientId: string }
  | { type: "message-removed"; conversationId: string; messageId: string }
  | {
      type: "reactions";
      conversationId: string;
      messageId: string;
      reactions: readonly MessengerReaction[];
    }
  | { type: "read"; conversationId: string; actorId: string; at: Date }
  | { type: "typing"; conversationId: string; actorId: string; typing: boolean }
  | { type: "presence"; actorId: string; online: boolean }
  | { type: "conversation"; conversation: MessengerConversation }
  | { type: "conversation-removed"; conversationId: string }
  | { type: "agent-quiet"; conversationId: string; agentId: string }
  | { type: "agent-dismissed"; conversationId: string; agentId: string }
  | { type: "connection"; state: MessengerState["connection"] };

export function initialMessengerState(viewerId: string): MessengerState {
  return {
    viewerId,
    status: "loading",
    conversations: [],
    openId: null,
    threads: {},
    typing: {},
    awaited: {},
    connection: "online",
  };
}

const EMPTY_THREAD: MessengerThreadState = {
  status: "loading",
  messages: [],
  before: null,
  loadingOlder: false,
  olderFailed: false,
  unreadFrom: null,
};

function mapConversation(
  state: MessengerState,
  id: string,
  change: (c: MessengerConversation) => MessengerConversation,
): MessengerConversation[] {
  let touched = false;
  const next = state.conversations.map((c) => {
    if (c.id !== id) return c;
    touched = true;
    return change(c);
  });
  return touched ? sortByNewest(next) : state.conversations;
}

function withThread(
  state: MessengerState,
  id: string,
  change: (t: MessengerThreadState) => MessengerThreadState,
): Record<string, MessengerThreadState> {
  const current = state.threads[id];
  if (!current) return state.threads;
  return { ...state.threads, [id]: change(current) };
}

/** The read mark of the viewer in a conversation, or null when unknown. */
function viewerReadMark(state: MessengerState, id: string): Date | null {
  const conversation = state.conversations.find((c) => c.id === id);
  return participantOf(conversation, state.viewerId)?.lastReadAt ?? null;
}

export function messengerReducer(state: MessengerState, action: MessengerAction): MessengerState {
  switch (action.type) {
    case "list-loading":
      // A refresh of a list already on screen keeps it there.
      return state.status === "ready" ? state : { ...state, status: "loading" };

    case "list-loaded":
      return { ...state, status: "ready", conversations: sortByNewest(action.conversations) };

    case "list-failed":
      // Keep what is shown: a failed refresh is not a reason to blank a list.
      return state.status === "ready" ? state : { ...state, status: "failed" };

    case "open": {
      if (action.id === state.openId) return state;
      if (action.id === null) return { ...state, openId: null };
      const existing = state.threads[action.id];
      // Re-opening fixes a new "New" line at where the viewer had read to.
      const unreadFrom = viewerReadMark(state, action.id);
      return {
        ...state,
        openId: action.id,
        threads: {
          ...state.threads,
          [action.id]: existing ? { ...existing, unreadFrom } : { ...EMPTY_THREAD, unreadFrom },
        },
      };
    }

    case "thread-loading":
      return {
        ...state,
        threads: {
          ...state.threads,
          [action.id]: { ...(state.threads[action.id] ?? EMPTY_THREAD), status: "loading" },
        },
      };

    case "thread-loaded": {
      const current = state.threads[action.id] ?? EMPTY_THREAD;
      // The first page of a thread, or a refresh of one already shown (the
      // conversation was reopened, the tab came back).
      const first = current.status !== "ready";
      // A refresh whose page shares nothing with what is shown means more
      // than a page arrived in between. Merging would leave a hole in the
      // middle that nothing could fill, so the page replaces what was shown
      // — except the viewer's own messages that have not been stored yet.
      const joined =
        first ||
        current.messages.length === 0 ||
        action.messages.length === 0 ||
        action.messages.some((m) => current.messages.some((shown) => shown.id === m.id));
      const kept = joined ? current.messages : current.messages.filter((m) => m.delivery);
      return {
        ...state,
        threads: {
          ...state.threads,
          [action.id]: {
            ...current,
            status: "ready",
            // Merged INTO what is shown: a message sent while the page was
            // loading must not be dropped by it.
            messages: mergeThread(kept, action.messages),
            // A refresh that joined must not forget how far back the reader
            // had already gone.
            before: first || !joined ? action.before : current.before,
            unreadFrom: current.unreadFrom ?? viewerReadMark(state, action.id),
          },
        },
      };
    }

    case "thread-failed":
      return {
        ...state,
        threads: withThread(state, action.id, (t) =>
          // A failed refresh keeps the messages already read.
          t.messages.length > 0 ? { ...t, status: "ready" } : { ...t, status: "failed" },
        ),
      };

    case "older-loading":
      return {
        ...state,
        threads: withThread(state, action.id, (t) => ({
          ...t,
          loadingOlder: true,
          olderFailed: false,
        })),
      };

    case "older-loaded":
      return {
        ...state,
        threads: withThread(state, action.id, (t) => ({
          ...t,
          loadingOlder: false,
          messages: mergeThread(t.messages, action.messages),
          before: action.before,
        })),
      };

    case "older-failed":
      return {
        ...state,
        threads: withThread(state, action.id, (t) => ({
          ...t,
          loadingOlder: false,
          olderFailed: true,
        })),
      };

    case "message": {
      const { message, seen } = action;
      const id = message.threadId;
      const agents = action.agents ?? [];
      const fromAgent = agents.some((a) => a.id === message.authorId);
      const waiting = state.awaited[id] ?? [];
      // An agent that speaks is no longer awaited; a person who names one
      // starts the wait. An agent naming another never does: two models
      // calling on each other is a loop, not a conversation.
      let awaited = waiting.filter((w) => w.agentId !== message.authorId);
      if (!fromAgent && message.delivery !== "failed") {
        for (const agent of mentionedAgents(message.body, agents)) {
          awaited = [
            ...awaited.filter((w) => w.agentId !== agent.id),
            { agentId: agent.id, state: "thinking" },
          ];
        }
      }
      const typing = (state.typing[id] ?? []).filter((actor) => actor !== message.authorId);
      return {
        ...state,
        conversations: mapConversation(state, id, (c) =>
          withMessage(c, message, state.viewerId, seen),
        ),
        threads: withThread(state, id, (t) => ({
          ...t,
          messages: mergeThread(t.messages, [message]),
        })),
        typing: { ...state.typing, [id]: typing },
        awaited: { ...state.awaited, [id]: awaited },
      };
    }

    case "send-failed":
      return {
        ...state,
        threads: withThread(state, action.conversationId, (t) => ({
          ...t,
          messages: t.messages.map((m) =>
            m.clientId === action.clientId && m.id === action.clientId
              ? { ...m, delivery: "failed" as const }
              : m,
          ),
        })),
        // Nobody was asked: an agent named in a message that never left is
        // not thinking about it.
        awaited: { ...state.awaited, [action.conversationId]: [] },
      };

    case "message-removed":
      return {
        ...state,
        threads: withThread(state, action.conversationId, (t) => ({
          ...t,
          messages: t.messages.filter((m) => m.id !== action.messageId),
        })),
      };

    case "reactions":
      return {
        ...state,
        threads: withThread(state, action.conversationId, (t) => ({
          ...t,
          messages: t.messages.map((m) =>
            m.id === action.messageId ? { ...m, reactions: action.reactions } : m,
          ),
        })),
      };

    case "read":
      return {
        ...state,
        conversations: mapConversation(state, action.conversationId, (c) =>
          withRead(c, action.actorId, action.at, state.viewerId),
        ),
      };

    case "typing": {
      if (action.actorId === state.viewerId) return state;
      const current = state.typing[action.conversationId] ?? [];
      const without = current.filter((actor) => actor !== action.actorId);
      const next = action.typing ? [...without, action.actorId] : without;
      if (next.length === current.length && next.every((a, i) => a === current[i])) return state;
      return { ...state, typing: { ...state.typing, [action.conversationId]: next } };
    }

    case "presence":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.participants.some((p) => p.actorId === action.actorId && p.online !== action.online)
            ? {
                ...c,
                participants: c.participants.map((p) =>
                  p.actorId === action.actorId ? { ...p, online: action.online } : p,
                ),
              }
            : c,
        ),
      };

    case "conversation":
      return {
        ...state,
        status: state.status === "loading" ? state.status : "ready",
        conversations: upsertConversation(state.conversations, action.conversation),
      };

    case "conversation-removed": {
      const { [action.conversationId]: _gone, ...threads } = state.threads;
      void _gone;
      return {
        ...state,
        conversations: state.conversations.filter((c) => c.id !== action.conversationId),
        threads,
        openId: state.openId === action.conversationId ? null : state.openId,
      };
    }

    case "agent-quiet":
      return {
        ...state,
        awaited: {
          ...state.awaited,
          [action.conversationId]: (state.awaited[action.conversationId] ?? []).map((w) =>
            w.agentId === action.agentId ? { ...w, state: "quiet" as const } : w,
          ),
        },
      };

    case "agent-dismissed":
      return {
        ...state,
        awaited: {
          ...state.awaited,
          [action.conversationId]: (state.awaited[action.conversationId] ?? []).filter(
            (w) => w.agentId !== action.agentId,
          ),
        },
      };

    case "connection":
      return state.connection === action.state ? state : { ...state, connection: action.state };
  }
}

/** The newest message in a thread that somebody else wrote, if any. */
export function newestFromOthers(
  messages: readonly MessengerMessage[],
  viewerId: string,
): MessengerMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.authorId !== viewerId) return m;
  }
  return undefined;
}

/**
 * Should the viewer's read mark move? Only forward, and only to a message
 * somebody else wrote: reading your own message is not news to anybody.
 */
export function readMarkToSend(
  conversation: MessengerConversation | undefined,
  messages: readonly MessengerMessage[],
  viewerId: string,
): Date | null {
  const newest = newestFromOthers(messages, viewerId);
  if (!newest) return null;
  const mark = participantOf(conversation, viewerId)?.lastReadAt ?? null;
  return mark && mark >= newest.createdAt ? null : newest.createdAt;
}
