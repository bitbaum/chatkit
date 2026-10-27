// ChatApp, the whole app, with a fake transport and the device store: the
// reference to look at at 390px and 1440px (demo/app.html). Synthetic
// answers only; nothing leaves the page. test/browser-app.mjs drives it.
import { createRoot } from "react-dom/client";
import { ChatApp, type ChatTransport } from "../src/react/index.js";
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
const transport: ChatTransport = async ({ text, attachments, signal, update, history }) => {
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

const store = localConversationStore({ key: "ck-demo-app" });

export function mountAppFixture() {
  const el = document.getElementById("app");
  if (!el) return;
  createRoot(el).render(
    <ChatApp
      transport={transport}
      store={store}
      name="Demo"
      placeholder="Ask the demo anything"
      rememberKey="ck-demo-app:open"
      startersTitle="What should we look at?"
      starters={["Plan a trip to Zürich", "Explain Lightning in one paragraph"]}
      composer={{ voice: { transcribeUrl: "/api/transcribe" } }}
      thread={{ share: { title: "Demo" } }}
      onShare={() => {}}
      footnote="Answers here are made up by the demo."
    />,
  );
}
