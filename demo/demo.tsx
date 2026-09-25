// The visual check: every part of the chat on one page, in light and dark.
// `pnpm run demo` builds demo/dist/; open demo/index.html. Screenshot it at
// 390px and at desktop width before calling a change to chatkit done.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ChatStarters, ChatThread, Composer, type ChatMessageData } from "../src/react/index.js";

const SEED: ChatMessageData[] = [
  { id: "1", role: "user", content: "I want to get paid in Bitcoin for my illustrations" },
  {
    id: "2",
    role: "assistant",
    speaker: { name: "Cat", id: "cat" },
    content:
      "You can set that up with me on **OrangeCat**: a pay link at `orangecat.ch/pay/you`, settled straight to your wallet. It is in beta.\n\n- Lightning or on-chain\n- nothing taken by OrangeCat",
  },
  {
    id: "3",
    role: "assistant",
    speaker: { name: "Loki", id: "loki" },
    content:
      "If you want a portfolio site around it, I can build that too — see https://loki.orangecat.ch.",
  },
];

function Demo({ empty, failed }: { empty?: boolean; failed?: boolean }) {
  const [messages, setMessages] = useState<ChatMessageData[]>(
    empty
      ? []
      : failed
        ? [SEED[0]!, { id: "f", role: "assistant", content: "", failed: true }]
        : SEED,
  );
  const [sending, setSending] = useState(false);
  const send = (text: string) => {
    setMessages((m) => [...m, { id: String(Date.now()), role: "user", content: text }]);
    setSending(true);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: `${Date.now()}a`,
          role: "assistant",
          speaker: { name: "Loki", id: "loki" },
          content: "Heard you.",
        },
      ]);
      setSending(false);
    }, 900);
  };
  return (
    <div className="demo-chat">
      <ChatThread
        messages={messages}
        live={sending ? { status: "Reading the catalogue" } : null}
        onStop={() => setSending(false)}
        onRetry={() => {}}
        empty={
          <ChatStarters
            title="Ask about any project — the Cat and Loki are both in here."
            starters={[
              "What can you build for me?",
              "I want to earn in Bitcoin",
              "How do I run AI agents on my code?",
            ]}
            onPick={send}
          />
        }
      />
      <Composer
        onSend={(t) => send(t)}
        placeholder="Ask about any project…"
        sending={sending}
        onStop={() => setSending(false)}
        attach
        voice={{ transcribeUrl: "/api/transcribe" }}
        hint="Enter sends · Shift+Enter new line"
      />
    </div>
  );
}

for (const [id, props] of [
  ["conversation", {}],
  ["empty", { empty: true }],
  ["failed", { failed: true }],
] as const) {
  const el = document.getElementById(id);
  if (el) createRoot(el).render(<Demo {...props} />);
}
