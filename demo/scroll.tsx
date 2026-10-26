// Synthetic page-scroll and nested-scroll fixtures; no customer conversation.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChatThread, type ChatMessageData } from "../src/react/index.js";

function ScrollFixture() {
  const [tick, setTick] = useState(0);
  const [messages, setMessages] = useState<ChatMessageData[]>([
    { id: "question", role: "user", content: "Explain the synthetic example." },
    {
      id: "answer",
      role: "assistant",
      content: "A synthetic paragraph for scroll testing.\n\n".repeat(90),
    },
  ]);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 150);
    return () => clearInterval(timer);
  }, []);
  const mode = new URLSearchParams(location.search).get("owner") ?? "page";
  return (
    <>
      <div id="fixture-controls" style={{ position: "fixed", top: 0, left: 0, zIndex: 20 }}>
        <button
          id="assistant-turn"
          onClick={() =>
            setMessages((m) => [
              ...m,
              { id: `a${m.length}`, role: "assistant", content: "A completed answer." },
            ])
          }
        >
          Complete answer
        </button>
        <button
          id="user-turn"
          onClick={() =>
            setMessages((m) => [
              ...m,
              { id: `u${m.length}`, role: "user", content: "Another question." },
            ])
          }
        >
          Send question
        </button>
        <output id="fixture-tick">{tick}</output>
      </div>
      <div
        id="fixture-owner"
        style={mode === "ancestor" ? { height: "90vh", overflowY: "auto" } : {}}
      >
        <div
          style={
            mode === "panel" ? { height: "90vh", display: "flex", flexDirection: "column" } : {}
          }
        >
          <ChatThread messages={messages} live={{ status: `Checking details ${tick}` }} />
        </div>
      </div>
    </>
  );
}
export function mountScrollFixture() {
  const root = document.getElementById("scroll-fixture");
  if (root) createRoot(root).render(<ScrollFixture />);
}
