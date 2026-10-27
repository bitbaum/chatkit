// ChatApp, the whole app, with a fake transport and the device store: the
// reference to look at at 390px and 1440px (demo/app.html). Synthetic
// answers only; nothing leaves the page. test/browser-app.mjs drives it.
import { StrictMode, createRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ChatApp,
  ChatTurnError,
  type ChatAppHandle,
  type ChatTransport,
  type MessageChip,
} from "../src/react/index.js";
import { localConversationStore } from "../src/index.js";

const params = new URLSearchParams(location.search);
const delay = Number(params.get("delay") ?? 30);

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("stopped", "AbortError"));
    });
  });
}

// Streams a made-up answer word by word through `update`, as a real
// transport streams a model's — and stops when Stop is pressed.
// `?lab=1` is the page the 0.19 checks drive (test/browser-app.mjs): StrictMode
// around ChatApp, a ref on `window.ckChat`, and words that make the fake
// transport fail ("fail: <reason>"), fail plainly ("fail-raw") or stream a
// half answer that must not be kept on Stop ("unchecked").
const lab = params.get("lab") === "1";
type LabWindow = Window & {
  ckChat?: ChatAppHandle | null;
  ckCalls?: { text: string; files: number; chatId: string }[];
  ckEnded?: string[];
};
const w = window as LabWindow;
w.ckCalls = [];
w.ckEnded = [];

const transport: ChatTransport = async (turn) => {
  const { text, attachments, signal, update, history } = turn;
  w.ckCalls!.push({ text, files: attachments.length, chatId: turn.chatId });
  if (text.startsWith("fail-raw")) throw new TypeError("Failed to fetch");
  if (text.startsWith("fail:")) {
    throw new ChatTurnError(text.slice(5).trim(), { kind: "demo" });
  }
  if (text.startsWith("unchecked")) {
    turn.stopKeepsPartial(false);
    update({ text: "Half an answer nobody has checked" });
    await wait(60_000, signal);
  }
  update({ status: "Reading what you sent" });
  await wait(delay * 4, signal);
  const files = attachments.length
    ? ` You attached ${attachments.map((a) => a.name).join(", ")}.`
    : "";
  const words =
    `You said “${text}”.${files} This is answer number ${history.length / 2 + 1} in this chat, written by the demo's fake transport so the screen can be checked without a model.`.split(
      " ",
    );
  let soFar = "";
  for (const word of words) {
    await wait(delay, signal);
    soFar = soFar ? `${soFar} ${word}` : word;
    update({ text: soFar });
  }
  return `${soFar}\n\n\`\`\`quick_replies\n["Tell me more", "Start over"]\n\`\`\``;
};

const store = localConversationStore({ key: lab ? "ck-demo-lab" : "ck-demo-app" });
const handle = createRef<ChatAppHandle>();
const initial = params.get("initial");

function DemoApp() {
  // "Your things": a product's own row in the attach sheet, staged by the app
  // and shown on the sent message as a chip.
  const [held, setHeld] = useState<MessageChip[]>([]);
  return (
    <ChatApp
      ref={(h) => {
        handle.current = h;
        w.ckChat = h;
      }}
      transport={transport}
      store={store}
      name="Demo"
      placeholder="Ask the demo anything"
      rememberKey={lab ? "ck-demo-lab:open" : "ck-demo-app:open"}
      startersTitle="What should we look at?"
      starters={[
        "Plan a trip to Zürich",
        { label: "Say hello in Zürich German", text: "Grüezi mitenand", lang: "gsw" },
      ]}
      composer={{
        voice: { transcribeUrl: "/api/transcribe" },
        heldAttachments: held.length,
        attachmentOnlyText: "What about this?",
        header: held.length ? (
          <p className="ck-hint">{held.map((c) => c.label).join(", ")}</p>
        ) : undefined,
        attachExtras: [
          {
            id: "things",
            label: "Your things",
            detail: "A listing or a note of yours",
            onPick: () => setHeld([{ label: "My bike listing", href: "#listing" }]),
          },
        ],
      }}
      chipsFor={() => {
        if (held.length === 0) return null;
        const chips = held;
        setHeld([]);
        return chips;
      }}
      thread={{
        share: { title: "Demo" },
        renderFooter: (m, info) =>
          m.failed ? null : (
            <div className="ck-replies" data-latest={info.isLatest ? "yes" : "no"}>
              {info.isLatest && (
                <button
                  type="button"
                  className="ck-reply"
                  onClick={() => info.send("Make that shorter, please.")}
                >
                  Shorter
                </button>
              )}
            </div>
          ),
      }}
      historySlot={<span>Only on this device.</span>}
      onTemporaryEnd={(id) => w.ckEnded!.push(id)}
      initialMessage={initial ? { text: initial } : null}
      deepLinkParam="q"
      onShare={() => {}}
      footnote="Answers here are made up by the demo."
    />
  );
}

export function mountAppFixture() {
  const el = document.getElementById("app");
  if (!el) return;
  createRoot(el).render(
    lab ? (
      <StrictMode>
        <DemoApp />
      </StrictMode>
    ) : (
      <DemoApp />
    ),
  );
}
