/** Declarative answer blocks. Model output is data, never HTML or executable SVG. */
export type RichBlock =
  | { type: "audio"; title: string; src: string; creator?: string; caption?: string }
  | { type: "gallery"; title: string; images: { src: string; alt: string; caption?: string }[] }
  | {
      type: "diagram";
      title: string;
      nodes: { id: string; label: string; detail?: string }[];
      edges: { from: string; to: string; label?: string }[];
    }
  | { type: "callout"; title: string; body: string }
  | { type: "choices"; title: string; options: { label: string; reply: string }[]; submit: string }
  | {
      /**
       * A layered figure, the way the ChatGPT app draws an architecture or a
       * flow: full-width boxes stacked top to bottom, a row of tiles where one
       * layer has several parts, an arrow between layers with the words that
       * cross it, and a caption that says what the figure claims.
       */
      type: "stack";
      title: string;
      layers: StackLayer[];
      caption?: string;
    };

export type StackNode = {
  /** A small uppercase line above the label ("USER", "LOKI"). */
  kicker?: string;
  label: string;
  detail?: string;
  /** "accent" tints the box with the product's accent; the default is neutral. */
  tone?: "neutral" | "accent";
  /** One of STACK_ICONS, drawn above the label on a tile. */
  icon?: StackIcon;
};
export type StackLayer = {
  nodes: StackNode[];
  /** The words on the arrow DOWN to the next layer ("Offers, payments"). */
  link?: string;
  /** The arrow runs both ways. */
  both?: boolean;
};
/** The icons a stack tile may carry — a closed set, so a name is never markup. */
export const STACK_ICONS = [
  "agent",
  "people",
  "robot",
  "person",
  "building",
  "money",
  "document",
  "code",
  "check",
  "globe",
  "wrench",
  "box",
  "chat",
  "flag",
] as const;
export type StackIcon = (typeof STACK_ICONS)[number];

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 2000): v is string =>
  typeof v === "string" && !!v.trim() && v.length <= max;
const list = (v: unknown, max: number): v is unknown[] =>
  Array.isArray(v) && v.length > 0 && v.length <= max;

/** Web images or same-origin assets only; no embedded markup or protocol-relative URLs. */
export function safeImageSrc(value: unknown): string | null {
  if (!str(value, 4096) || /[\s\\]/.test(value) || [...value].some((c) => c.charCodeAt(0) < 32))
    return null;
  if (/^\/(?!\/)/.test(value)) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? value
      : null;
  } catch {
    return null;
  }
}

/** Invalid or oversized blocks are rejected without crashing the answer. */
export function parseRichBlock(raw: string): RichBlock | null {
  if (raw.length > 40000) return null;
  let b: unknown;
  try {
    b = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!record(b) || !str(b.title, 200)) return null;
  switch (b.type) {
    case "audio":
      return safeImageSrc(b.src) &&
        (b.creator === undefined || str(b.creator, 200)) &&
        (b.caption === undefined || str(b.caption, 1000))
        ? (b as RichBlock)
        : null;
    case "callout":
      return str(b.body) ? { type: b.type, title: b.title, body: b.body } : null;
    case "gallery":
      if (
        !list(b.images, 6) ||
        !b.images.every(
          (i) =>
            record(i) &&
            safeImageSrc(i.src) &&
            str(i.alt, 300) &&
            (i.caption === undefined || str(i.caption, 500)),
        )
      )
        return null;
      return b as RichBlock;
    case "diagram": {
      if (
        !list(b.nodes, 8) ||
        !b.nodes.every(
          (n) =>
            record(n) &&
            str(n.id, 50) &&
            str(n.label, 120) &&
            (n.detail === undefined || str(n.detail, 300)),
        )
      )
        return null;
      const ids = new Set(b.nodes.map((n) => (n as Record<string, unknown>).id));
      if (
        ids.size !== b.nodes.length ||
        !Array.isArray(b.edges) ||
        b.edges.length > 16 ||
        !b.edges.every(
          (e) =>
            record(e) &&
            ids.has(e.from) &&
            ids.has(e.to) &&
            (e.label === undefined || str(e.label, 100)),
        )
      )
        return null;
      return b as RichBlock;
    }
    case "stack": {
      const icons = new Set<string>(STACK_ICONS);
      if (
        !list(b.layers, 8) ||
        !b.layers.every(
          (l) =>
            record(l) &&
            list(l.nodes, 4) &&
            l.nodes.every(
              (n) =>
                record(n) &&
                str(n.label, 120) &&
                (n.kicker === undefined || str(n.kicker, 40)) &&
                (n.detail === undefined || str(n.detail, 300)) &&
                (n.tone === undefined || n.tone === "neutral" || n.tone === "accent") &&
                (n.icon === undefined || (typeof n.icon === "string" && icons.has(n.icon))),
            ) &&
            (l.link === undefined || str(l.link, 120)) &&
            (l.both === undefined || typeof l.both === "boolean"),
        ) ||
        (b.caption !== undefined && !str(b.caption, 300))
      )
        return null;
      return b as RichBlock;
    }
    case "choices":
      if (
        !str(b.submit, 80) ||
        !list(b.options, 6) ||
        !b.options.every((o) => record(o) && str(o.label, 200) && str(o.reply, 500))
      )
        return null;
      return b as RichBlock;
    default:
      return null;
  }
}

export const RICH_ANSWERS_INSTRUCTION = [
  "## Visual answers",
  "Lead with the answer. Use headings, short paragraphs, markdown tables for comparisons, and numbered steps when they help. Keep simple answers simple.",
  "When useful, insert a fenced chat_ui block containing ONE JSON object at the point it belongs. These are the supported shapes:",
  '{"type":"audio","title":"Song sample","src":"/provided-sample.wav","creator":"Creator name","caption":"What to listen for"}',
  '{"type":"gallery","title":"Reference photos","images":[{"src":"/provided-image.jpg","alt":"Describe the image","caption":"What to notice"}]}',
  '{"type":"diagram","title":"How it connects","nodes":[{"id":"a","label":"Input","detail":"Optional explanation"},{"id":"b","label":"Result"}],"edges":[{"from":"a","to":"b","label":"leads to"}]}',
  '{"type":"stack","title":"The complete architecture","layers":[{"nodes":[{"kicker":"USER","label":"Build this","detail":"One conversation, one goal"}],"link":"the goal"},{"nodes":[{"kicker":"CONTROL PLANE","label":"Plan · Dispatch · Verify","tone":"accent"}],"link":"work orders","both":true},{"nodes":[{"icon":"agent","label":"AI agents","detail":"Code, research"},{"icon":"people","label":"People","detail":"Specialists"},{"icon":"robot","label":"Robots","detail":"Move, inspect"}]}],"caption":"Proposed logical architecture — not a claim that every connection exists today."}',
  '{"type":"callout","title":"Recommendation","body":"The useful takeaway."}',
  '{"type":"choices","title":"What would you like next?","options":[{"label":"Explain the first option","reply":"Explain the first option"},{"label":"Compare the alternatives","reply":"Compare the alternatives"}],"submit":"Continue"}',
  "Use a stack for an architecture, a pipeline or layers of responsibility (top to bottom, at most 8 layers of at most 4 tiles; icons only from: agent, people, robot, person, building, money, document, code, check, globe, wrench, box, chat, flag); use a diagram for an arbitrary graph. When you lay out a few approaches to choose from, write them as a numbered list whose items open with a bold name, and mark the one you recommend with [Recommended] right after the name. Use at most 6 images, 8 diagram nodes, 16 edges, or 6 choices per block. Translate titles, labels and submit into the reader's language. A choice sends its reply as a normal message; it never performs an action directly. Audio uses explicit playback, never autoplay. Include audio only for URLs actually provided by a person, context or a completed tool result; a track title or a planned generation is not a playable file. Preserve creator attribution and distinguish previews, generated drafts and finished recordings. Never invent media URLs, numbers, sources, tool results or product capabilities. Use only image URLs provided by the person, context or tools; otherwise use a diagram or plain text. Always explain the takeaway in prose too. No HTML, scripts, raw SVG, or decorative images. Preserve domain-specific evidence and authority rules. Put suggested replies last, outside chat_ui blocks.",
].join("\n");

/** Copy, share and voice keep the content of a visual, never its wire JSON. */
export function richAnswerText(text: string): string {
  return text.replace(/```chat_ui\s*([\s\S]*?)(?:```|$)/g, (_, raw: string) => {
    const b = parseRichBlock(raw);
    if (!b) return "";
    switch (b.type) {
      case "audio":
        return `${b.title}${b.creator ? ` — ${b.creator}` : ""}${b.caption ? `\n${b.caption}` : ""}\n${b.src}`;
      case "callout":
        return `${b.title}\n${b.body}`;
      case "gallery":
        return `${b.title}\n${b.images.map((i) => `${i.alt}${i.caption ? ` — ${i.caption}` : ""}\n${i.src}`).join("\n")}`;
      case "choices":
        return `${b.title}\n${b.options.map((o) => `- ${o.label}`).join("\n")}`;
      case "stack":
        return `${b.title}\n${b.layers
          .map(
            (l) =>
              l.nodes
                .map(
                  (n) =>
                    `${n.kicker ? `${n.kicker}: ` : ""}${n.label}${n.detail ? ` — ${n.detail}` : ""}`,
                )
                .join(" · ") + (l.link ? `\n${l.both ? "⇅" : "↓"} ${l.link}` : ""),
          )
          .join("\n")}${b.caption ? `\n${b.caption}` : ""}`;
      case "diagram":
        return `${b.title}\n${b.nodes.map((n) => `${n.label}${n.detail ? `: ${n.detail}` : ""}`).join("\n")}\n${b.edges.map((e) => `${b.nodes.find((n) => n.id === e.from)!.label} → ${b.nodes.find((n) => n.id === e.to)!.label}${e.label ? ` (${e.label})` : ""}`).join("\n")}`;
    }
  });
}
