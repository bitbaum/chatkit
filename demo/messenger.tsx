// The Messenger on a pretend backend: four conversations, an agent that
// answers when it is named, uploads that take a moment, and switches in the
// address for everything that can go wrong. `test/browser-messenger.mjs`
// drives this page; open demo/messenger.html to look at it.
//
//   ?open=<id>      start inside a conversation
//   ?fail=send      every send fails        ?fail=upload   every upload fails
//   ?fail=list      the list fails once     ?agent=quiet   the agent never answers
//   ?patience=<ms>  how long the agent may take before the thread says so
import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Messenger,
  MessengerError,
  type MessengerAgent,
  type MessengerAttachment,
  type MessengerConversation,
  type MessengerEvent,
  type MessengerMessage,
  type MessengerParticipant,
  type MessengerTransport,
} from "../src/react/messenger.js";

const params = new URLSearchParams(location.search);
const fail = params.get("fail");
const ME = "me";
const CAT: MessengerAgent = {
  id: "cat",
  name: "Cat",
  mention: "@cat",
  hint: "Everyone here sees its answer",
};

const HOUR = 3_600_000;
const now = Date.now();
const ago = (ms: number) => new Date(now - ms);
const start = ago(40 * 24 * HOUR);

const person = (
  actorId: string,
  name: string,
  extra: Partial<MessengerParticipant> = {},
): MessengerParticipant => ({
  actorId,
  kind: "human",
  name,
  joinedAt: start,
  visibleFrom: "thread-start",
  ...extra,
});

/** A flat picture with a word on it, so a tile is something to look at. */
const picture = (label: string, hue: number, width = 1200, height = 900) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="hsl(${hue} 45% 62%)"/><circle cx="${width * 0.72}" cy="${height * 0.3}" r="${height * 0.14}" fill="hsl(${hue} 60% 86%)"/><path d="M0 ${height} L${width * 0.35} ${height * 0.45} L${width * 0.6} ${height * 0.75} L${width * 0.8} ${height * 0.55} L${width} ${height * 0.8} L${width} ${height} Z" fill="hsl(${hue} 40% 38%)"/><text x="40" y="90" font-family="sans-serif" font-size="56" fill="hsl(${hue} 50% 20%)">${label}</text></svg>`,
  )}`;

const photo = (id: string, label: string, hue: number, w = 1200, h = 900): MessengerAttachment => ({
  id,
  kind: "image",
  name: `${label.toLowerCase().replace(/\s+/g, "-")}.jpg`,
  mimeType: "image/jpeg",
  bytes: 420_000,
  width: w,
  height: h,
  url: picture(label, hue, w, h),
});

let seq = 0;
const message = (
  threadId: string,
  authorId: string,
  body: string,
  createdAt: Date,
  extra: Partial<MessengerMessage> = {},
): MessengerMessage => ({ id: `s${++seq}`, threadId, authorId, body, createdAt, ...extra });

const store: Record<string, MessengerMessage[]> = {
  maya: [
    message("maya", "maya", "Penguins are basically fish. They live in the water!", ago(41 * HOUR)),
    message(
      "maya",
      ME,
      "They are birds. They have feathers and lay eggs.",
      ago(41 * HOUR - 60_000),
    ),
    message("maya", ME, "@cat are penguins fish?", ago(40.9 * HOUR)),
    message(
      "maya",
      "cat",
      "No. Penguins are **birds**: they have feathers, lay eggs and are warm-blooded, while fish are cold-blooded and have gills. So, penguins are definitely not fish.",
      ago(40.8 * HOUR),
      { onBehalfOf: ME, generatedBy: { model: "demo" } },
    ),
    message("maya", "maya", "Fine. But they swim better than they walk.", ago(2 * HOUR)),
    message(
      "maya",
      "maya",
      "Read this: https://example.org/penguins-are-birds.",
      ago(2 * HOUR - 30_000),
    ),
    message("maya", ME, "That we agree on.", ago(1.9 * HOUR), {
      replyTo: {
        id: "s5",
        authorId: "maya",
        body: "Fine. But they swim better than they walk.",
      },
      reactions: [{ emoji: "👍", actorIds: ["maya"] }],
    }),
    message("maya", "maya", "", ago(1.8 * HOUR), {
      card: {
        kind: "request",
        title: "Payment request",
        amount: "CHF 12.00",
        note: "Your half of the zoo tickets",
        status: "Waiting for you",
        tone: "pending",
        action: { label: "Pay CHF 12.00", href: "#pay" },
      },
    }),
  ],
  hike: [
    message("hike", "ben", "Saturday, 8:00 at the station?", ago(30 * HOUR)),
    message("hike", "zoe", "Yes. I bring the map.", ago(29.5 * HOUR)),
    message("hike", ME, "", ago(26 * HOUR), {
      attachments: [photo("p1", "Ridge", 205), photo("p2", "Lake", 180), photo("p3", "Hut", 28)],
    }),
    message("hike", "ben", "Last year, for scale.", ago(5 * HOUR), {
      attachments: [photo("p4", "Summit", 260, 900, 1200)],
    }),
    message("hike", "zoe", "The route, and the list of what to pack.", ago(4.8 * HOUR), {
      attachments: [
        {
          id: "f1",
          kind: "file",
          name: "packing-list-and-route-for-saturday.pdf",
          mimeType: "application/pdf",
          bytes: 184_320,
          url: "data:application/pdf;base64,JVBERi0xLjQK",
        },
      ],
    }),
  ],
  ben: [
    message("ben", ME, "Did the transfer arrive?", ago(50 * HOUR)),
    message("ben", "ben", "It did, thank you.", ago(3 * HOUR)),
    message("ben", "ben", "Coffee next week?", ago(3 * HOUR - 20_000)),
  ],
  self: [],
};
// A long conversation, to scroll and to page through.
store.long = Array.from({ length: 120 }, (_, i) =>
  message(
    "long",
    i % 3 === 0 ? ME : "zoe",
    `Line ${i + 1} of a long conversation.`,
    ago((130 - i) * HOUR),
  ),
);

// `?host=hostile`: the Messenger inside a product's own base styles, the kind
// that style bare elements, and with a profile photo that is not square.
const hostile = params.get("host") === "hostile";
if (hostile) {
  const style = document.createElement("style");
  style.textContent = `
    p { margin-bottom: 1rem; line-height: 1.625; }
    a { min-height: 44px; min-width: 44px; }
    h2 { font-size: 1.5rem; margin-bottom: 0.75rem; }
    img { height: auto; }
    textarea { min-height: 44px; border-radius: 6px; font-size: 16px !important; }
    *:focus-visible { outline: none; box-shadow: 0 0 0 2px #fff, 0 0 0 4px #999; }
  `;
  document.head.append(style);
}

const people: Record<string, MessengerParticipant> = {
  maya: person("maya", "Maya Keller", {
    ...(hostile ? { avatarUrl: picture("M", 20, 300, 500) } : {}),
    handle: "maya",
    online: true,
    lastReadAt: ago(1.9 * HOUR),
  }),
  ben: person("ben", "Ben Ito", { handle: "ben" }),
  zoe: person("zoe", "Zoë Brandt", { handle: "zoe" }),
};
const me = (lastReadAt: Date) => person(ME, "Georgy", { lastReadAt });

const conversations: MessengerConversation[] = [
  {
    id: "maya",
    createdAt: start,
    participants: [
      me(ago(HOUR)),
      people.maya!,
      {
        actorId: "cat",
        kind: "ai",
        name: "Cat",
        joinedAt: ago(40.8 * HOUR),
        visibleFrom: "thread-start",
      },
    ],
  },
  {
    id: "hike",
    createdAt: start,
    subject: "Weekend hike",
    participants: [me(ago(HOUR)), people.ben!, people.zoe!],
  },
  { id: "ben", createdAt: start, participants: [me(ago(10 * HOUR)), people.ben!], unread: 2 },
  {
    id: "long",
    createdAt: start,
    participants: [me(ago(HOUR)), { ...people.zoe!, lastReadAt: ago(11 * HOUR) }],
  },
  { id: "self", createdAt: start, participants: [me(ago(HOUR))] },
];
for (const c of conversations) {
  const last = store[c.id]![store[c.id]!.length - 1];
  c.last = last
    ? {
        body: last.body,
        authorId: last.authorId,
        createdAt: last.createdAt,
        attachments: last.attachments?.map((a) => a.kind),
      }
    : null;
}

const listeners = new Set<(event: MessengerEvent) => void>();
const emit = (event: MessengerEvent) => listeners.forEach((on) => on(event));
const calls = { react: 0, send: 0, markRead: 0, upload: 0, messages: 0, typing: 0, list: 0 };
const PAGE = 30;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let listFailed = false;

const transport: MessengerTransport = {
  async conversations() {
    calls.list++;
    await wait(40);
    if (fail === "list" && !listFailed) {
      listFailed = true;
      throw new Error("no list");
    }
    return conversations.map((c) => ({ ...c }));
  },
  async messages(id, { before }) {
    calls.messages++;
    await wait(60);
    const all = store[id] ?? [];
    const end = before ? all.findIndex((m) => m.id === before) : all.length;
    const from = Math.max(0, end - PAGE);
    return { messages: all.slice(from, end), before: from > 0 ? all[from]!.id : null };
  },
  async send(id, draft) {
    calls.send++;
    await wait(150);
    if (fail === "send") throw new MessengerError("offline");
    const stored: MessengerMessage = {
      id: `m${++seq}`,
      clientId: draft.clientId,
      threadId: id,
      authorId: ME,
      body: draft.body,
      createdAt: new Date(),
      ...(draft.attachments.length > 0 ? { attachments: draft.attachments } : {}),
      ...(draft.replyTo ? { replyTo: draft.replyTo } : {}),
      ...(draft.card ? { card: draft.card } : {}),
    };
    store[id] = [...(store[id] ?? []), stored];
    if (/(^|\W)@cat\b/i.test(draft.body) && params.get("agent") !== "quiet") {
      setTimeout(() => {
        const reply: MessengerMessage = {
          id: `m${++seq}`,
          threadId: id,
          authorId: "cat",
          body: "Maya is right about the swimming, you are right about the **birds**.",
          createdAt: new Date(),
          onBehalfOf: ME,
          generatedBy: { model: "demo" },
        };
        store[id] = [...(store[id] ?? []), reply];
        emit({ type: "message", message: reply });
      }, 900);
    }
    return stored;
  },
  async edit(original, body) {
    await wait(80);
    if (fail === "edit") throw new Error("no");
    return { ...original, body, editedAt: new Date() };
  },
  async react() {
    calls.react++;
    await wait(60);
    if (fail === "react") throw new Error("no");
  },
  async remove() {
    await wait(80);
    if (fail === "remove") throw new Error("no");
  },
  async markRead() {
    calls.markRead++;
  },
  typing() {
    calls.typing++;
  },
  async upload(file, about, { progress, signal }) {
    calls.upload++;
    for (const step of [0.25, 0.6, 0.9]) {
      await wait(120);
      if (signal.aborted) throw new Error("aborted");
      progress(step);
    }
    if (fail === "upload") throw new Error("storage said no");
    const url = URL.createObjectURL(file);
    return {
      id: `a${++seq}`,
      kind: about.kind,
      name: about.name,
      mimeType: about.mimeType,
      bytes: about.bytes,
      width: about.width,
      height: about.height,
      durationMs: about.durationMs,
      url,
      posterUrl: about.poster ? URL.createObjectURL(about.poster) : undefined,
    };
  },
  async usage() {
    return { usedBytes: Number(params.get("used") ?? 0) };
  },
  subscribe(_scope, on) {
    listeners.add(on);
    return () => listeners.delete(on);
  },
  async people(query) {
    await wait(60);
    const q = query.toLowerCase();
    return [
      { id: "maya", name: "Maya Keller", handle: "maya" },
      { id: "ben", name: "Ben Ito", handle: "ben" },
      { id: "zoe", name: "Zoë Brandt", handle: "zoe" },
      { id: "ada", name: "Ada Okafor", handle: "ada" },
    ].filter((p) => `${p.name} ${p.handle}`.toLowerCase().includes(q));
  },
  async open(ids) {
    await wait(60);
    const existing = conversations.find(
      (c) =>
        !c.subject &&
        c.participants.filter((p) => p.kind === "human").length === ids.length + 1 &&
        ids.every((id) => c.participants.some((p) => p.actorId === id)),
    );
    if (existing) return existing;
    const made: MessengerConversation = {
      id: `new-${ids.join("-")}`,
      createdAt: new Date(),
      participants: [
        me(new Date()),
        ...ids.map((id) => people[id] ?? person(id, id === "ada" ? "Ada Okafor" : id)),
      ],
      last: null,
    };
    conversations.push(made);
    store[made.id] = [];
    return made;
  },
  async leave(ids) {
    await wait(60);
    for (const id of ids) {
      const at = conversations.findIndex((c) => c.id === id);
      if (at >= 0) conversations.splice(at, 1);
    }
  },
};

function Fixture() {
  const [open, setOpen] = useState<string | null>(params.get("open"));
  return (
    <Messenger
      viewer={{ id: ME }}
      transport={transport}
      agents={[CAT]}
      conversationId={open}
      onConversationChange={setOpen}
      fill="viewport"
      timeZone="UTC"
      locale="en-GB"
      agentPatienceMs={Number(params.get("patience") ?? 90_000)}
      composer={{ voice: { transcribeUrl: "/api/transcribe" } }}
      actions={[
        {
          id: "request",
          label: "Request money",
          detail: "They get a card with a Pay button",
          amount: { unit: "CHF", confirm: "Request" },
          available: (c) => c.id !== "hike",
          onPick: ({ amount, note, send }) =>
            void send("", {
              kind: "request",
              title: "Payment request",
              amount: `CHF ${(amount ?? 0).toFixed(2)}`,
              ...(note ? { note } : {}),
              status: "Waiting",
              tone: "pending",
            }),
        },
      ]}
    />
  );
}

export function mountMessengerFixture() {
  const el = document.getElementById("messenger");
  if (!el) return;
  Object.assign(window, { ckMessenger: { emit, calls, store, people } });
  createRoot(el).render(<Fixture />);
}
