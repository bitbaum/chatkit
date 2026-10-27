import { mountScrollFixture } from "./scroll.js";
// The visual check: every part of the chat on one page, in light and dark.
// `pnpm run demo` builds demo/dist/; open demo/index.html. Screenshot it at
// 390px and at desktop width before calling a change to chatkit done.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ChatScreen,
  ChatStarters,
  ChatThread,
  Composer,
  type ChatMessageData,
  type RichRenderers,
} from "../src/react/index.js";

// What an app injects: here a stub that draws bars and nothing else, so the
// screen shows both paths — a bars block through the renderer, a line block
// through chatkit's own fallback (the caption and a table). Substrata hands
// the same block to @bitbaum/chartkit instead.
const demoRenderers: RichRenderers = {
  chart: (block) => {
    if (block.chart !== "bars") return null;
    const max = Math.max(...block.rows.map((r) => r.value));
    return (
      <div className="demo-bars" data-chart="bars">
        {block.rows.map((r) => (
          <div key={r.label} className="demo-bar">
            <span className="demo-bar-label">{r.label}</span>
            <span className="demo-bar-track">
              <span
                className={
                  r.label === block.highlight ? "demo-bar-fill demo-bar-hi" : "demo-bar-fill"
                }
                style={{ width: `${Math.max(1, (r.value / max) * 100)}%` }}
              />
            </span>
            <span className="demo-bar-value">
              {r.value}
              {block.unit ? ` ${block.unit}` : ""}
            </span>
          </div>
        ))}
        <p className="ck-chart-caption">{block.caption}</p>
      </div>
    );
  },
};

const visual = (value: object) => "\n\n```chat_ui\n" + JSON.stringify(value) + "\n```";
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
      'If you want a portfolio site around it, I can build that too — see https://loki.orangecat.ch.\n\n**Quick follow-up options**\n\n```quick_replies\n["Set up the pay link", "Build the site too", "What does it cost?"]\n```',
  },
];

// A conversation long enough to scroll on any screen: what ChatScreen is for.
const LONG: ChatMessageData[] = [
  { id: "l1", role: "user", content: "How would Loki run robots in a warehouse?" },
  {
    id: "l2",
    role: "assistant",
    content:
      'Software and physical systems share the same high-level workflow, but their operating conditions are dramatically different.\n\nIn software, you can generate code, test it, discover errors, and roll back. In the physical world, a mistake might damage an expensive machine, injure someone, waste materials, or create an irreversible result.\n\nSo the architecture has **two levels of intelligence**:\n\n- **🧭 Loki: strategic intelligence.** "Move these 40 boxes from receiving to storage before 17:00, within budget and without interrupting people." Loki plans the work, chooses authorized resources, checks scheduling, monitors outcomes, and handles exceptions.\n- **🤖 Robot: local intelligence and physical control.** The robot navigates, identifies obstacles, estimates its position, plans safe motion, and reacts to events using onboard software and safety systems.\n\nLoki receives progress and verified results instead of controlling every motor movement remotely. That keeps network latency, dropped connections and unreliable model output out of the safety loop.',
  },
  { id: "l2b", role: "user", content: "Which options do I have, and who owns what?" },
  {
    id: "l2c",
    role: "assistant",
    thinking: {
      durationMs: 218_000,
      steps: [
        { label: "Read the fleet's AGENTS.md", detail: "Packages, names, the identity contract" },
        { label: "Compared Loki's actor model with OrangeCat's entity registry" },
        { label: "Checked ISO 10218-1:2025 for the robot cell rules" },
      ],
    },
    citations: {
      F1: {
        label: "fleet AGENTS.md",
        detail: "Read today.",
        href: "https://github.com/bitbaum/fleet",
      },
      F2: { label: "ISO 10218-1:2025", detail: "Safety requirements for industrial robots." },
    },
    content:
      "## Three architectural options\n\n1. **Federated products, unified experience.** [Recommended] Keep Loki and OrangeCat independent, but integrate them through common identity, linked projects and shared capability contracts [F1]. The best balance of modularity and simplicity.\n2. **Merge everything into one application.** One database, one repository, one deployment. Removes integration, creates one very large application.\n3. **Loose coupling.** Occasional API hand-offs. Easy to maintain, but the person coordinates the projects themselves.\n\n## Who owns what\n\n| Domain | Canonical owner |\n|---|---|\n| Goals, plans, tasks, agent runs | Loki |\n| Robot control, telemetry | Loki plus the local robot gateway [F2] |\n| Public identities, offers, settlements | OrangeCat |\n| Shared UI and technical packages | The fleet's package register |\n\n## Directory vs Finding\n\n| Term | What it is | How it appears in the system |\n|---|---|---|\n| Directory | A curated list of entities (countries, companies, resources, bottlenecks) that Substrata knows exist. It does not assert any quantitative claim about scarcity, growth or risk. | Example: the Niger page in the atlas showing its production figures; the list of all resource entries. |\n| Finding | An evidence-based statement about a specific bottleneck, with its source and a checked date. | Example: a bottleneck's severity judgement, marked Sourced or Unverified. |\n\n- [x] Shared identity linking\n- [ ] A stable cross-product project reference\n- [ ] Durable events\n\nThese are existing building blocks, not things to invent: ROS 2 and MoveIt 2 already provide the robotics middleware, and [NVIDIA's simulation tools](https://developer.nvidia.com/isaac) reduce the expensive real-world experiments [F2, F1].\n\n## The complete architecture" +
      visual({
        type: "stack",
        title: "Who does what",
        layers: [
          {
            nodes: [
              {
                kicker: "User",
                label: "\u201cBuild this game / robot / business\u201d",
                detail: "One conversation, one goal, one project view",
              },
            ],
          },
          {
            nodes: [
              {
                kicker: "Loki",
                label: "Goal and execution control plane",
                detail:
                  "Plan \u00b7 Schedule \u00b7 Dispatch \u00b7 Observe \u00b7 Verify \u00b7 Retry",
                tone: "accent",
              },
            ],
            link: "Work orders, evidence",
            both: true,
          },
          {
            nodes: [
              { icon: "agent", label: "AI agents", detail: "Code, research, design" },
              { icon: "people", label: "Humans", detail: "Engineers, specialists" },
              { icon: "robot", label: "Robots", detail: "Manufacture, move, inspect" },
            ],
            link: "Offers, resources, payments, identities",
            both: true,
          },
          {
            nodes: [
              {
                kicker: "OrangeCat",
                label: "Economic coordination and marketplace",
                detail: "Discover \u00b7 Offer \u00b7 Contract \u00b7 Fund \u00b7 Settle",
              },
            ],
          },
        ],
        caption:
          "Proposed logical architecture \u2014 not a claim that every connection is implemented today.",
      }) +
      "\n\nThe figure separates three questions. **What needs to happen?** Loki answers this. **Who can do it, and under what terms?** OrangeCat. **Did it actually happen correctly?** Loki owns the evidence; a person accepts the result.",
  },
  { id: "l2d", role: "user", content: "Who produces gallium, and how has that changed?" },
  {
    id: "l2e",
    role: "assistant",
    content:
      "China refines almost all of the world's primary gallium; everyone else together is a rounding error." +
      visual({
        type: "chart",
        chart: "bars",
        caption: "Primary gallium production, 2024 (USGS)",
        unit: "t",
        highlight: "China",
        rows: [
          { label: "China", value: 750, share: 98.4, href: "/atlas/china" },
          { label: "Russia", value: 5, share: 0.7, href: "/atlas/russia", estimated: true },
          { label: "Japan", value: 3, share: 0.4, href: "/atlas/japan", estimated: true },
          { label: "South Korea", value: 3, share: 0.4, href: "/atlas/south-korea" },
        ],
      }) +
      "\n\nThe gap opened over the last decade: China's output tripled while the rest of the world stood still." +
      visual({
        type: "chart",
        chart: "line",
        caption: "Primary gallium production by year (USGS)",
        unit: "t",
        series: [
          {
            id: "cn",
            label: "China",
            points: [
              { x: 2014, y: 435 },
              { x: 2017, y: 300 },
              { x: 2020, y: 420 },
              { x: 2022, y: 600 },
              { x: 2024, y: 750, href: "/atlas/china" },
            ],
          },
          {
            id: "row",
            label: "Rest of the world",
            points: [
              { x: 2014, y: 25 },
              { x: 2017, y: 20 },
              { x: 2020, y: 15 },
              { x: 2022, y: 12 },
              { x: 2024, y: 11 },
            ],
          },
        ],
      }) +
      "\n\nSo a gallium bottleneck is not a mining question but a refining one: the metal is a by-product of aluminium and zinc, and the capacity to pull it out sits in one country.",
  },
  { id: "l3", role: "user", content: "And who decides when something goes wrong?" },
  {
    id: "l4",
    role: "assistant",
    content:
      'The robot decides first, always: a stop is local and immediate. Loki decides second — whether to retry, reroute, or ask a person.\n\n1. The robot stops and reports what it saw.\n2. Loki compares it with the plan and the rules it was given.\n3. Anything irreversible waits for a human tap.\n\n```quick_replies\n["Show the rules", "What can a person override?", "Draw the flow"]\n```',
  },
];

function Demo({ empty, failed, screen }: { empty?: boolean; failed?: boolean; screen?: boolean }) {
  const [messages, setMessages] = useState<ChatMessageData[]>(
    screen
      ? LONG
      : empty
        ? []
        : failed
          ? [SEED[0]!, { id: "f", role: "assistant", content: "", failed: true }]
          : [
              ...SEED,
              {
                id: "visual",
                role: "assistant",
                replies: ["Set up the pay link", "Build the site too", "What does it cost?"],
                content:
                  "## One plan, three connected parts\n\nEach product keeps its own purpose. The shared experience makes the next step clear." +
                  visual({
                    type: "diagram",
                    title: "From idea to decision",
                    nodes: [
                      { id: "cat", label: "Cat", detail: "Find support and fund the work." },
                      { id: "loki", label: "Loki", detail: "Build, check and deliver." },
                      { id: "solon", label: "Solon", detail: "Bring the decision to members." },
                    ],
                    edges: [
                      { from: "cat", to: "loki", label: "Funded work becomes an actionable brief" },
                      { from: "loki", to: "solon", label: "Members review the result and decide" },
                    ],
                  }) +
                  visual({
                    type: "gallery",
                    title: "Look closer",
                    images: [
                      {
                        src: "/demo/reference.svg",
                        alt: "A connected workflow",
                        caption: "Images stay beside their explanation.",
                      },
                      {
                        src: "/demo/reference.svg",
                        alt: "The decision path",
                        caption: "Open either image to inspect it.",
                      },
                    ],
                  }) +
                  visual({
                    type: "audio",
                    title: "An original morning sketch",
                    src: "/demo/morning.wav",
                    creator: "Studio example",
                    caption: "A short synthesized instrumental, not a finished recording.",
                  }) +
                  visual({
                    type: "callout",
                    title: "A useful next step",
                    body: "Choose one part to explore. Your choice becomes the next message in this conversation.",
                  }) +
                  visual({
                    type: "choices",
                    title: "Where would you like to start?",
                    options: [
                      {
                        label: "Explore the funding options",
                        reply: "Explore the funding options",
                      },
                      { label: "Build the first version", reply: "Build the first version" },
                      { label: "Understand who decides", reply: "Understand who decides" },
                    ],
                    submit: "Continue",
                  }),
              },
            ],
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
  const thread = (
    <ChatThread
      onFeedback={(f) => console.log("feedback", f)}
      messages={messages}
      live={sending ? { status: "Reading the catalogue" } : null}
      onStop={() => setSending(false)}
      onRetry={() => {}}
      onReply={send}
    />
  );
  const composer = (
    <Composer
      onSend={(t) => send(t)}
      placeholder="Ask Loki"
      sending={sending}
      onStop={() => setSending(false)}
      attach
      voice={{ transcribeUrl: "/api/transcribe" }}
    />
  );
  if (screen) {
    return (
      <ChatScreen
        fill="viewport"
        renderers={demoRenderers}
        header={
          <>
            <button type="button" className="ck-glass" aria-label="Chats">
              ☰
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" className="ck-glass" aria-label="New chat">
              ✎
            </button>
          </>
        }
        composer={composer}
        footnote="Loki can be wrong. Check what matters."
      >
        {thread}
      </ChatScreen>
    );
  }
  return (
    <div className="demo-chat">
      <ChatThread
        onFeedback={(f) => console.log("feedback", f)}
        messages={messages}
        live={sending ? { status: "Reading the catalogue" } : null}
        onStop={() => setSending(false)}
        onRetry={() => {}}
        onReply={send}
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
        onSend={(t, attachments) => {
          // Read back by test/browser.mjs: what an app's API would receive.
          (window as unknown as { __sent?: unknown }).__sent = attachments;
          send(t);
        }}
        placeholder="Ask about any project…"
        sending={sending}
        onStop={() => setSending(false)}
        attach={{ maxImageEdge: 1024 }}
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
  ["screen", { screen: true }],
] as const) {
  const el = document.getElementById(id);
  if (el) createRoot(el).render(<Demo {...props} />);
}

mountScrollFixture();
