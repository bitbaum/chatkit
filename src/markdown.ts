/**
 * The markdown an LLM actually writes, parsed into blocks and inline spans —
 * no dependency, no HTML string, nothing to sanitise because nothing is ever
 * rendered as HTML.
 *
 * From loki's `MarkdownText`, the one renderer in the fleet that four repos
 * did NOT have: those rendered model output with the literal `**` still in it.
 * Supports what answers use — paragraphs, bullet and numbered lists, headings,
 * **bold**, *italic*, `code`, fenced code, [links](url) and `[F1]` citation
 * handles — and deliberately nothing else.
 */

export type MarkdownBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; lang: string; code: string }
  | { kind: "quote"; text: string };

export function parseBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.trim();
    // ``` fenced code — verbatim until the closing fence (or the end, while
    // it is still streaming in).
    if (line.startsWith("```")) {
      list = null;
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        code.push(lines[i] ?? "");
        i++;
      }
      blocks.push({ kind: "code", lang, code: code.join("\n") });
      continue;
    }
    if (!line) {
      list = null;
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      if (!list || list.kind !== kind) {
        list = { kind, items: [] };
        blocks.push(list);
      }
      list.items.push((bullet ?? numbered)![1] ?? "");
      continue;
    }
    list = null;
    if (/^#{1,6}\s/.test(line)) {
      blocks.push({ kind: "h", text: line.replace(/^#+\s+/, "") });
    } else if (line.startsWith(">")) {
      // A model's `>` leaked into prose was one of orangecat's fixed bugs.
      blocks.push({ kind: "quote", text: line.replace(/^>\s?/, "") });
    } else {
      const prev = blocks[blocks.length - 1];
      // A soft line break inside a paragraph continues it.
      if (prev && prev.kind === "p" && (lines[i - 1] ?? "").trim()) prev.text += `\n${line}`;
      else blocks.push({ kind: "p", text: line });
    }
  }
  return blocks;
}

export type InlineSpan =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "cite"; ids: string[] };

const INLINE_RE =
  /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\)|\[[FD]\d+(?:,\s*[FD]\d+)*\]|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

export function parseInline(text: string): InlineSpan[] {
  const out: InlineSpan[] = [];
  for (const part of text.split(INLINE_RE)) {
    if (!part) continue;
    if (/^\[[FD]\d+(?:,\s*[FD]\d+)*\]$/.test(part)) {
      out.push({ kind: "cite", ids: part.slice(1, -1).split(/,\s*/) });
    } else if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      out.push({ kind: "code", text: part.slice(1, -1) });
    } else if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push({ kind: "strong", text: part.slice(2, -2) });
    } else if (/^\*[^*\s][^*]*\*$/.test(part)) {
      out.push({ kind: "em", text: part.slice(1, -1) });
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
      const href = link
        ? safeHref(link[2] ?? "")
        : /^https?:\/\//.test(part)
          ? safeHref(part)
          : null;
      if (link && href) out.push({ kind: "link", text: link[1] ?? href, href });
      else if (!link && href) out.push({ kind: "link", text: part, href });
      else out.push({ kind: "text", text: link ? (link[1] ?? part) : part });
    }
  }
  return out;
}

/**
 * Only http(s), mailto and same-site paths become links. A `javascript:` URL in
 * model output is text, never a link — the answer is written by a model that
 * may have read a hostile page.
 */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (h.startsWith("#")) return h;
  try {
    const u = new URL(h);
    return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:"
      ? u.href
      : null;
  } catch {
    return null;
  }
}

/** A same-site path navigates in place; anything else opens a new tab. */
export function isInternalHref(href: string): boolean {
  return href.startsWith("/") || href.startsWith("#");
}
