/** Declarative answer blocks. Model output is data, never HTML or executable SVG. */
export type RichBlock =
  | { type: "gallery"; title: string; images: { src: string; alt: string; caption?: string }[] }
  | {
      type: "diagram";
      title: string;
      nodes: { id: string; label: string; detail?: string }[];
      edges: { from: string; to: string; label?: string }[];
    }
  | { type: "callout"; title: string; body: string }
  | { type: "choices"; title: string; options: { label: string; reply: string }[]; submit: string };

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
  '{"type":"gallery","title":"Reference photos","images":[{"src":"/provided-image.jpg","alt":"Describe the image","caption":"What to notice"}]}',
  '{"type":"diagram","title":"How it connects","nodes":[{"id":"a","label":"Input","detail":"Optional explanation"},{"id":"b","label":"Result"}],"edges":[{"from":"a","to":"b","label":"leads to"}]}',
  '{"type":"callout","title":"Recommendation","body":"The useful takeaway."}',
  '{"type":"choices","title":"What would you like next?","options":[{"label":"Explain the first option","reply":"Explain the first option"},{"label":"Compare the alternatives","reply":"Compare the alternatives"}],"submit":"Continue"}',
  "Use at most 6 images, 8 diagram nodes, 16 edges, or 6 choices per block. Translate titles, labels and submit into the reader's language. A choice sends its reply as a normal message; it never performs an action directly. Never invent image URLs, numbers, sources, tool results or product capabilities. Use only image URLs provided by the person, context or tools; otherwise use a diagram or plain text. Always explain the takeaway in prose too. No HTML, scripts, raw SVG, or decorative images. Preserve domain-specific evidence and authority rules. Put suggested replies last, outside chat_ui blocks.",
].join("\n");

/** Copy, share and voice keep the content of a visual, never its wire JSON. */
export function richAnswerText(text: string): string {
  return text.replace(/```chat_ui\s*([\s\S]*?)(?:```|$)/g, (_, raw: string) => {
    const b = parseRichBlock(raw);
    if (!b) return "";
    switch (b.type) {
      case "callout":
        return `${b.title}\n${b.body}`;
      case "gallery":
        return `${b.title}\n${b.images.map((i) => `${i.alt}${i.caption ? ` — ${i.caption}` : ""}\n${i.src}`).join("\n")}`;
      case "choices":
        return `${b.title}\n${b.options.map((o) => `- ${o.label}`).join("\n")}`;
      case "diagram":
        return `${b.title}\n${b.nodes.map((n) => `${n.label}${n.detail ? `: ${n.detail}` : ""}`).join("\n")}\n${b.edges.map((e) => `${b.nodes.find((n) => n.id === e.from)!.label} → ${b.nodes.find((n) => n.id === e.to)!.label}${e.label ? ` (${e.label})` : ""}`).join("\n")}`;
    }
  });
}
