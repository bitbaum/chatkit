"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { canWrite } from "@bitbaum/threadkit";
import { DEFAULT_ATTACHMENT_POLICY } from "../thread-rules.js";
import { MESSAGE_FILES_ACCEPT, type AttachSource } from "../attachments.js";
import {
  agentsPresent,
  conversationTitle,
  failureText,
  otherPeople,
  sessionDrafts,
  withMention,
  type MessengerAgent,
  type MessengerConversation,
  type MessengerDrafts,
  type MessengerMessage,
  type MessengerParticipant,
  type MessengerPerson,
  type MessengerTransport,
} from "../messenger.js";
import type { AttachExtra } from "./AttachMenu.js";
import {
  Composer,
  type ComposerHandle,
  type ComposerLabelOverrides,
  type ComposerVoice,
} from "./Composer.js";
import { ConversationList, type ConversationListProps } from "./ConversationList.js";
import { useViewportHeight } from "./hooks.js";
import {
  IconAgent,
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconFile,
  IconMore,
  IconPencil,
  IconRetry,
  IconSearch,
  IconSpinner,
  IconTrash,
  IconUsers,
  IconVideo,
  IconX,
} from "./icons.js";
import type { RenderLink } from "./Markdown.js";
import { MessengerAvatar } from "./MessageAttachments.js";
import { MessageThread } from "./MessageThread.js";
import {
  messengerLabels,
  type MessengerLabelOverrides,
  type MessengerLabels,
} from "./messenger-labels.js";
import { Sheet, prefersSheet } from "./Sheet.js";
import { useMessenger } from "./use-messenger.js";
import {
  useUploads,
  type UploadItem,
  type UploadOptions,
  type UploadsController,
} from "./use-uploads.js";

export type MessengerComposerOptions = {
  /** The microphone. Pass `{ transcribeUrl }` so it works where the browser's
   *  recogniser does not. */
  voice?: ComposerVoice | false;
  /** What may be attached and how photos are shrunk. `false` offers no files
   *  even when the transport can upload. */
  attach?: UploadOptions | false;
  /** Inside the box, above the words: a product's own line ("Sending as …"). */
  header?: ReactNode;
  /** Around the box: a menu that needs the keys before the box does. */
  wrap?: (box: ReactNode) => ReactNode;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  /** What a conversation's box holds when it is opened by a link that says
   *  what to write. Wins over a kept draft, once. */
  initialDraft?: (conversationId: string) => string | undefined;
  labels?: ComposerLabelOverrides;
};

export type MessengerProps = {
  /** Who is using it. `id` is what their own messages carry as `authorId`. */
  viewer: { id: string };
  /** The app's backend (see `MessengerTransport`). */
  transport: MessengerTransport;
  /** Agents people can bring in by naming them. */
  agents?: readonly MessengerAgent[];
  /** The open conversation, when the app keeps it (the URL). */
  conversationId?: string | null;
  onConversationChange?: (id: string | null) => void;
  composer?: MessengerComposerOptions;
  /** Where unsent words are kept. Default: this tab (`sessionDrafts`). */
  drafts?: MessengerDrafts;
  /** Under the list's title. */
  listHeader?: ReactNode;
  /** At the end of a conversation's top bar: a product's own controls. */
  headerActions?: (conversation: MessengerConversation) => ReactNode;
  /** Where the name in the top bar leads (a profile), if anywhere. */
  profileHref?: (participant: MessengerParticipant) => string | undefined;
  search?: ConversationListProps["search"];
  renderLink?: RenderLink;
  /** The product's own mark for its agent, where it has no picture. */
  agentMark?: ReactNode;
  /**
   * `"parent"` (the default) fills the box it is given — give it a height.
   * `"viewport"` is the whole display and follows the visual viewport, so the
   * box rides above the phone keyboard.
   */
  fill?: "parent" | "viewport";
  locale?: string;
  timeZone?: string;
  agentPatienceMs?: number;
  labels?: MessengerLabelOverrides;
  className?: string;
};

function UploadTray({ uploads, labels }: { uploads: UploadsController; labels: MessengerLabels }) {
  if (uploads.items.length === 0) return null;
  return (
    <div className="ck-msgr-tray">
      {uploads.items.map((item) => (
        <UploadTile key={item.key} item={item} uploads={uploads} labels={labels} />
      ))}
    </div>
  );
}

function UploadTile({
  item,
  uploads,
  labels,
}: {
  item: UploadItem;
  uploads: UploadsController;
  labels: MessengerLabels;
}) {
  const busy = item.state === "preparing" || item.state === "uploading";
  return (
    <div
      className={`ck-msgr-upload ck-msgr-upload-${item.state}`}
      title={item.name}
      data-upload={item.state}
    >
      {item.previewUrl ? (
        <img src={item.previewUrl} alt={item.name} />
      ) : (
        <span className="ck-msgr-upload-file">
          {item.kind === "video" ? <IconVideo /> : <IconFile />}
          <span className="ck-truncate">{item.name}</span>
        </span>
      )}
      {busy && (
        <span
          className="ck-msgr-upload-bar"
          role="progressbar"
          aria-label={labels.uploading.replace("{name}", item.name)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(item.progress * 100)}
        >
          <span style={{ width: `${Math.round(item.progress * 100)}%` }} />
        </span>
      )}
      {item.state === "failed" && (
        <button
          type="button"
          className="ck-msgr-upload-retry"
          onClick={() => uploads.retry(item.key)}
          aria-label={`${labels.retryUpload}: ${item.name}`}
          title={labels.retryUpload}
        >
          <IconRetry />
        </button>
      )}
      <button
        type="button"
        className="ck-attach-remove"
        onClick={() => uploads.remove(item.key)}
        aria-label={labels.removeUpload(item.name)}
        title={labels.removeUpload(item.name)}
      >
        <IconX />
      </button>
    </div>
  );
}

/** Find people and start a conversation with them. */
function NewConversation({
  open,
  onClose,
  transport,
  onStart,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  transport: MessengerTransport;
  onStart: (ids: readonly string[]) => Promise<boolean>;
  labels: MessengerLabels;
}) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<MessengerPerson[]>([]);
  const [state, setState] = useState<"idle" | "searching" | "failed">("idle");
  const [picked, setPicked] = useState<MessengerPerson[]>([]);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

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
          if (request.signal.aborted) return;
          setFound(list);
          setState("idle");
        })
        .catch(() => {
          if (!request.signal.aborted) setState("failed");
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [open, query, transport.people]);

  const toggle = (person: MessengerPerson) =>
    setPicked((current) =>
      current.some((p) => p.id === person.id)
        ? current.filter((p) => p.id !== person.id)
        : [...current, person],
    );
  const rows = [...picked, ...found.filter((f) => !picked.some((p) => p.id === f.id))];

  return (
    <Sheet open={open} onClose={onClose} title={labels.newTitle} closeLabel={labels.close}>
      <div className="ck-msgr-new">
        <label className="ck-msgr-search">
          <IconSearch />
          <span className="ck-msgr-sr">{labels.peopleSearch}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.peoplePlaceholder}
            enterKeyHint="search"
          />
        </label>
        <div className="ck-msgr-new-body" aria-live="polite">
          {rows.length === 0 && (
            <p className="ck-msgr-hint">
              {state === "searching" ? (
                <IconSpinner />
              ) : state === "failed" ? (
                labels.peopleFailed
              ) : query.trim() ? (
                labels.peopleEmpty
              ) : (
                labels.peopleHint
              )}
            </p>
          )}
          {rows.length > 0 && (
            <ul className="ck-msgr-rows">
              {rows.map((person) => {
                const on = picked.some((p) => p.id === person.id);
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      className="ck-msgr-row"
                      aria-pressed={on}
                      onClick={() => toggle(person)}
                    >
                      <span className="ck-msgr-row-face">
                        <MessengerAvatar
                          name={person.name}
                          src={person.avatarUrl}
                          agent={person.kind === "agent"}
                          size="lg"
                        />
                      </span>
                      <span className="ck-msgr-row-text">
                        <span className="ck-msgr-row-name ck-truncate">{person.name}</span>
                        {person.handle && (
                          <span className="ck-msgr-row-preview ck-truncate">@{person.handle}</span>
                        )}
                      </span>
                      <span className="ck-msgr-pick" aria-hidden="true">
                        {on && <IconCheck />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {problem && (
          <p className="ck-msgr-problem" role="alert">
            {problem}
          </p>
        )}
        <button
          type="button"
          className="ck-msgr-btn ck-msgr-btn-primary ck-msgr-btn-wide"
          disabled={picked.length === 0 || starting}
          onClick={async () => {
            setStarting(true);
            setProblem(null);
            const ok = await onStart(picked.map((p) => p.id));
            setStarting(false);
            if (ok) onClose();
            else setProblem(labels.startFailed);
          }}
        >
          {starting && <IconSpinner />}
          {labels.start}
        </button>
      </div>
    </Sheet>
  );
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
export function Messenger({
  viewer,
  transport,
  agents = [],
  conversationId,
  onConversationChange,
  composer = {},
  drafts,
  listHeader,
  headerActions,
  profileHref,
  search,
  renderLink,
  agentMark,
  fill = "parent",
  locale,
  timeZone,
  agentPatienceMs,
  labels: labelOverrides,
  className,
}: MessengerProps) {
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

  const rootRef = useRef<HTMLDivElement | null>(null);
  useViewportHeight(rootRef, fill === "viewport");

  // ── the box's words ──
  const draftStore = useMemo(() => drafts ?? sessionDrafts(), [drafts]);
  const [draft, setDraftState] = useState("");
  const [editing, setEditing] = useState<MessengerMessage | null>(null);
  const beforeEdit = useRef("");
  const handle = useRef<ComposerHandle | null>(null);
  const initial = composer.initialDraft;
  const initialRef = useRef(initial);
  useEffect(() => {
    initialRef.current = initial;
  });
  useEffect(() => {
    setEditing(null);
    if (!openId) {
      setDraftState("");
      return;
    }
    setDraftState(initialRef.current?.(openId) ?? draftStore.get(openId));
    // A keyboard that springs up on every tap of a row hides the messages
    // the person opened the conversation to read.
    if (!prefersSheet()) setTimeout(() => handle.current?.focus(), 0);
  }, [openId, draftStore]);
  const setDraft = (text: string) => {
    setDraftState(text);
    if (openId && !editing) draftStore.set(openId, text);
    if (text.trim() && !editing) controller.typed();
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
    const list: AttachSource[] = [];
    if (policy.maxBytes.image > 0) list.push("camera", "photos");
    if (policy.maxBytes.video > 0) list.push("videos");
    if (policy.maxBytes.file > 0) list.push("files");
    return list;
  }, [policy]);

  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => setNotice(null), [openId]);
  const shownNotice = notice ?? uploads.note;

  // ── what can be done to a message, and to the conversation ──
  const [acting, setActing] = useState<MessengerMessage | null>(null);
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

  const subtitle = !open ? null : present.length > 0 ? (
    <span className="ck-msgr-top-agent">
      <span className="ck-speaker-kind">{labels.agent}</span>
      <span className="ck-truncate">
        {labels.agentHere.replace("{name}", present.map((p) => p.name).join(", "))}
      </span>
    </span>
  ) : one ? (
    one.online ? (
      labels.online
    ) : one.handle ? (
      `@${one.handle}`
    ) : null
  ) : people.length > 1 ? (
    labels.people.replace("{n}", String(people.length + 1))
  ) : null;

  const extras: AttachExtra[] = agents.map((agent) => ({
    id: `agent-${agent.id}`,
    label: labels.askAgent.replace("{name}", agent.name),
    detail: agent.hint,
    icon: agentMark ?? <IconAgent />,
    onPick: () => {
      setDraft(withMention(draft, agent.mention));
      setTimeout(() => handle.current?.focus(), 0);
    },
  }));

  const header =
    editing || composer.header || uploads.items.length > 0 ? (
      <>
        {editing && (
          <div className="ck-msgr-editing">
            <IconPencil />
            <span className="ck-truncate">{labels.editing}</span>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setDraftState(beforeEdit.current);
              }}
            >
              {labels.cancel}
            </button>
          </div>
        )}
        {composer.header}
        <UploadTray uploads={uploads} labels={labels} />
      </>
    ) : undefined;

  const box = (
    <Composer
      layout="inline"
      value={draft}
      onValueChange={setDraft}
      inputRef={composer.inputRef}
      handleRef={handle}
      placeholder={labels.placeholder}
      ariaLabel={labels.composer}
      voice={composer.voice}
      attach={
        canUpload && !editing
          ? { take: uploads.add, sources, accept: { files: MESSAGE_FILES_ACCEPT } }
          : false
      }
      attachExtras={editing ? undefined : extras}
      heldAttachments={editing ? 0 : uploads.attachments.length}
      attachmentsAlone
      sendBlockedReason={uploads.busy ? labels.waitForUploads : null}
      header={header}
      labels={{ send: labels.send, attach: labels.attach, ...composer.labels }}
      onSend={async (text) => {
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
        const sent = await controller.send(body, uploads.attachments);
        if (!sent) {
          setNotice(labels.sendFailed);
          return false;
        }
        uploads.clear();
        if (openId) draftStore.set(openId, "");
        return true;
      }}
    />
  );

  const ownActing = acting?.authorId === viewer.id;
  const canEdit = Boolean(acting && ownActing && transport.edit && acting.body);
  const canRemove = Boolean(acting && ownActing && transport.remove);

  return (
    <div
      ref={rootRef}
      className={["ck-msgr", fill === "viewport" ? "ck-msgr-viewport" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      data-pane={openId ? "thread" : "list"}
    >
      <div className="ck-msgr-side">
        <ConversationList
          conversations={state.conversations}
          viewerId={viewer.id}
          agents={agents}
          status={state.status}
          selectedId={openId}
          onSelect={controller.select}
          onNew={transport.people && transport.open ? () => setCreating(true) : undefined}
          onReload={controller.reload}
          typing={state.typing}
          search={search}
          header={listHeader}
          agentMark={agentMark}
          locale={locale}
          timeZone={timeZone}
          labels={labels}
        />
      </div>

      <section
        className="ck-msgr-main"
        aria-label={open ? labels.thread.replace("{name}", title) : undefined}
      >
        {!openId ? (
          <div className="ck-msgr-state ck-msgr-nothing">
            <p>{labels.pickOne}</p>
          </div>
        ) : (
          <>
            <header className="ck-msgr-top">
              <button
                type="button"
                className="ck-icon-btn ck-msgr-back"
                onClick={() => controller.select(null)}
                aria-label={labels.back}
                title={labels.back}
              >
                <IconArrowLeft />
              </button>
              {open && (
                <>
                  {one ? (
                    <MessengerAvatar name={one.name} src={one.avatarUrl} online={one.online} />
                  ) : people.length === 0 && present[0] ? (
                    <MessengerAvatar
                      name={present[0].name}
                      src={present[0].avatarUrl}
                      agent
                      fallback={agentMark ?? <IconAgent />}
                    />
                  ) : (
                    <MessengerAvatar
                      name={title}
                      fallback={people.length > 1 ? <IconUsers /> : <IconPencil />}
                    />
                  )}
                  <div className="ck-msgr-top-text">
                    {one && profileHref?.(one) ? (
                      <a className="ck-msgr-top-name ck-truncate" href={profileHref(one)}>
                        {title}
                      </a>
                    ) : (
                      <h2 className="ck-msgr-top-name ck-truncate">{title}</h2>
                    )}
                    {subtitle && <p className="ck-msgr-top-sub ck-truncate">{subtitle}</p>}
                  </div>
                  {headerActions?.(open)}
                  {transport.leave && (
                    <button
                      type="button"
                      className="ck-icon-btn ck-msgr-top-more"
                      onClick={() => setMenu(true)}
                      aria-label={labels.more}
                      aria-haspopup="dialog"
                      title={labels.more}
                    >
                      <IconMore />
                    </button>
                  )}
                </>
              )}
            </header>

            {state.connection !== "online" && (
              <p className="ck-msgr-banner" role="status">
                {state.connection === "offline" ? labels.offline : labels.reconnecting}
              </p>
            )}

            {open ? (
              <MessageThread
                key={open.id}
                conversation={open}
                viewerId={viewer.id}
                messages={thread?.messages ?? []}
                agents={agents}
                status={thread?.status ?? "loading"}
                onReload={controller.reloadThread}
                hasOlder={thread ? thread.before !== null : false}
                loadingOlder={thread?.loadingOlder}
                olderFailed={thread?.olderFailed}
                onLoadOlder={controller.loadOlder}
                unreadFrom={thread?.unreadFrom}
                typing={state.typing[open.id]}
                awaited={state.awaited[open.id]}
                onDismissAgent={controller.dismissAgent}
                onRetry={controller.retry}
                onDiscard={controller.discard}
                onAction={setActing}
                onSeen={controller.seen}
                onFollowingChange={controller.setFollowing}
                renderLink={renderLink}
                agentMark={agentMark}
                locale={locale}
                timeZone={timeZone}
                labels={labels}
              />
            ) : (
              <div className="ck-msgr-thread-wrap">
                <div className="ck-msgr-state" role="status">
                  {state.status === "failed" ? (
                    <>
                      <p>{labels.threadFailed}</p>
                      <button type="button" className="ck-msgr-btn" onClick={controller.reload}>
                        {labels.retry}
                      </button>
                    </>
                  ) : (
                    <>
                      <IconSpinner />
                      <span className="ck-msgr-sr">{labels.loading}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="ck-msgr-dock">
              {shownNotice && (
                <button
                  type="button"
                  className="ck-note"
                  onClick={() => {
                    setNotice(null);
                    uploads.clearNote();
                  }}
                >
                  {shownNotice}
                </button>
              )}
              {writable ? (
                composer.wrap ? (
                  composer.wrap(box)
                ) : (
                  box
                )
              ) : (
                <p className="ck-msgr-closed">{labels.cannotWrite}</p>
              )}
            </div>
          </>
        )}
      </section>

      <Sheet
        open={acting !== null}
        onClose={closeActions}
        title={labels.actions}
        closeLabel={labels.close}
      >
        <div className="ck-sheet-extra ck-sheet-only">
          {acting?.body && !confirming && (
            <button
              type="button"
              className="ck-attach-extra"
              onClick={() => {
                void navigator.clipboard?.writeText(acting.body).catch(() => undefined);
                closeActions();
              }}
            >
              <span className="ck-attach-extra-icon" aria-hidden>
                <IconCopy />
              </span>
              <span className="ck-attach-extra-text">{labels.copy}</span>
            </button>
          )}
          {canEdit && !confirming && (
            <button
              type="button"
              className="ck-attach-extra"
              onClick={() => {
                if (!acting) return;
                beforeEdit.current = editing ? beforeEdit.current : draft;
                setEditing(acting);
                setDraftState(acting.body);
                closeActions();
                setTimeout(() => handle.current?.focus(), 0);
              }}
            >
              <span className="ck-attach-extra-icon" aria-hidden>
                <IconPencil />
              </span>
              <span className="ck-attach-extra-text">{labels.edit}</span>
            </button>
          )}
          {canRemove && !confirming && (
            <button type="button" className="ck-attach-extra" onClick={() => setConfirming(true)}>
              <span className="ck-attach-extra-icon" aria-hidden>
                <IconTrash />
              </span>
              <span className="ck-attach-extra-text">{labels.remove}</span>
            </button>
          )}
          {confirming && (
            <div className="ck-msgr-confirm">
              <button type="button" className="ck-msgr-btn" onClick={() => setConfirming(false)}>
                {labels.cancel}
              </button>
              <button
                type="button"
                className="ck-msgr-btn ck-msgr-btn-danger"
                onClick={async () => {
                  const message = acting;
                  closeActions();
                  if (!message) return;
                  const ok = await controller.remove(message);
                  if (!ok) setNotice(labels.removeFailed);
                }}
              >
                {labels.removeConfirm}
              </button>
            </div>
          )}
        </div>
      </Sheet>

      <Sheet
        open={menu}
        onClose={() => {
          setMenu(false);
          setConfirming(false);
        }}
        title={title || labels.more}
        closeLabel={labels.close}
      >
        <div className="ck-sheet-extra ck-sheet-only">
          {!confirming ? (
            <button type="button" className="ck-attach-extra" onClick={() => setConfirming(true)}>
              <span className="ck-attach-extra-icon" aria-hidden>
                <IconTrash />
              </span>
              <span className="ck-attach-extra-text">{labels.leave}</span>
            </button>
          ) : (
            <>
              <p className="ck-msgr-hint">{labels.leaveConfirm}</p>
              <div className="ck-msgr-confirm">
                <button type="button" className="ck-msgr-btn" onClick={() => setConfirming(false)}>
                  {labels.cancel}
                </button>
                <button
                  type="button"
                  className="ck-msgr-btn ck-msgr-btn-danger"
                  onClick={async () => {
                    const id = openId;
                    setMenu(false);
                    setConfirming(false);
                    if (!id) return;
                    const ok = await controller.leave(id);
                    if (!ok) setNotice(failureText(null, labels.leaveFailed));
                  }}
                >
                  {labels.leave}
                </button>
              </div>
            </>
          )}
        </div>
      </Sheet>

      <NewConversation
        open={creating}
        onClose={() => setCreating(false)}
        transport={transport}
        onStart={controller.start}
        labels={labels}
      />
    </div>
  );
}
