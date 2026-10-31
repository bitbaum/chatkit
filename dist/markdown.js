/**
 * The markdown an LLM actually writes, parsed into blocks and inline spans —
 * no dependency, no HTML string, nothing to sanitise because nothing is ever
 * rendered as HTML.
 *
 * From loki's `MarkdownText`, the one renderer in the fleet that four repos
 * did NOT have: those rendered model output with the literal `**` still in it.
 * Supports what answers use — paragraphs, bullet, numbered, nested and task
 * lists, headings with their level, tables, rules, **bold**, *italic*, `code`,
 * fenced code, [links](url), ![images](url) and `[F1]` citation handles — and
 * deliberately nothing else.
 */
/** GitHub's callouts: `> [!CAUTION]` and its siblings. */
export const ALERT_KINDS = ["note", "tip", "important", "warning", "caution"];
const ALERT_RE = /^\[!(note|tip|important|warning|caution)\]\s*(.*)$/i;
const BULLET_RE = /^([-*•])\s+(.*)$/;
const NUMBERED_RE = /^(\d+)[.)]\s+(.*)$/;
const TASK_RE = /^\[([ xX])\]\s+(.*)$/;
function listItem(text) {
    const task = TASK_RE.exec(text);
    if (task)
        return { text: task[2] ?? "", task: task[1] !== " " };
    return { text };
}
/** `| a | b |` → ["a", "b"]; a row may omit its outer pipes. */
function tableCells(line) {
    const inner = line.replace(/^\|/, "").replace(/\|$/, "");
    return inner.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}
const TABLE_RULE_RE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;
export function parseBlocks(text) {
    const blocks = [];
    let list = null;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] ?? "";
        const line = raw.trim();
        // ``` fenced code — verbatim until the closing fence (or the end, while
        // it is still streaming in).
        if (line.startsWith("```")) {
            list = null;
            const lang = line.slice(3).trim();
            const code = [];
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
        // A table: a header row, a rule of dashes, then rows. The rule is what
        // tells a table from a sentence with a pipe in it.
        if (line.includes("|") && TABLE_RULE_RE.test((lines[i + 1] ?? "").trim())) {
            list = null;
            const head = tableCells(line);
            const rows = [];
            i += 2;
            while (i < lines.length && (lines[i] ?? "").trim().includes("|")) {
                rows.push(tableCells((lines[i] ?? "").trim()));
                i++;
            }
            i--;
            blocks.push({ kind: "table", head, rows });
            continue;
        }
        // A table whose header row was lost (a filter upstream dropped it, seen
        // live on substrata): the rule opens it. Rows under it are still a table,
        // not "| :--- | :--- |" printed as prose.
        if (line.includes("|") &&
            TABLE_RULE_RE.test(line) &&
            (lines[i + 1] ?? "").trim().includes("|")) {
            list = null;
            const rows = [];
            i += 1;
            while (i < lines.length && (lines[i] ?? "").trim().includes("|")) {
                rows.push(tableCells((lines[i] ?? "").trim()));
                i++;
            }
            i--;
            blocks.push({ kind: "table", head: [], rows });
            continue;
        }
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
            list = null;
            blocks.push({ kind: "hr" });
            continue;
        }
        const bullet = BULLET_RE.exec(line);
        const numbered = NUMBERED_RE.exec(line);
        if (bullet || numbered) {
            const kind = bullet ? "ul" : "ol";
            const indent = raw.length - raw.trimStart().length;
            const item = listItem((bullet ? bullet[2] : numbered[2]) ?? "");
            // Indented under the previous item: one level of nesting, whichever
            // marker it uses.
            if (list && indent >= 2 && list.items.length > 0) {
                const parent = list.items[list.items.length - 1];
                (parent.children ??= []).push(item);
                continue;
            }
            if (!list || list.kind !== kind) {
                list =
                    kind === "ol"
                        ? { kind: "ol", items: [], start: Number(numbered[1]) || 1 }
                        : { kind: "ul", items: [] };
                blocks.push(list);
            }
            list.items.push(item);
            continue;
        }
        list = null;
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
            const level = Math.min(heading[1].length, 3);
            blocks.push({ kind: "h", text: heading[2] ?? "", level });
        }
        else if (line.startsWith(">") || ALERT_RE.test(line)) {
            // A model's `>` leaked into prose was one of orangecat's fixed bugs.
            // Consecutive quoted lines are one quote. `[!CAUTION]` opening a quote
            // (or standing alone, as models also write it) makes it a callout
            // instead of printing the marker (seen live, causius, 2026-10-26).
            const prev = blocks[blocks.length - 1];
            const quoted = line.replace(/^>\s?/, "");
            const alert = ALERT_RE.exec(quoted.trim());
            const prevLine = (lines[i - 1] ?? "").trim();
            const continues = prev &&
                (prev.kind === "quote" || prev.kind === "alert") &&
                prevLine &&
                (prevLine.startsWith(">") || (prev.kind === "alert" && line.startsWith(">")));
            if (alert) {
                blocks.push({
                    kind: "alert",
                    alert: alert[1].toLowerCase(),
                    text: alert[2] ?? "",
                });
            }
            else if (continues && prev.kind === "alert") {
                prev.text += prev.text ? `\n${quoted}` : quoted;
            }
            else if (continues && prev.kind === "quote") {
                prev.text += `\n${quoted}`;
            }
            else
                blocks.push({ kind: "quote", text: quoted });
        }
        else {
            const prevBlock = blocks[blocks.length - 1];
            // A bare `[!CAUTION]` line carries the paragraph under it.
            if (prevBlock && prevBlock.kind === "alert" && (lines[i - 1] ?? "").trim()) {
                prevBlock.text += prevBlock.text ? `\n${line}` : line;
                continue;
            }
            const prev = blocks[blocks.length - 1];
            // A soft line break inside a paragraph continues it.
            if (prev && prev.kind === "p" && (lines[i - 1] ?? "").trim())
                prev.text += `\n${line}`;
            else
                blocks.push({ kind: "p", text: line });
        }
    }
    return blocks;
}
/**
 * A list where every item opens with a bold lead — `**Title.** body` — is a
 * list of named things, and reads as cards: a numbered or bulleted badge, the
 * name, the body under it. That is how the ChatGPT app lays out "three
 * options" or "two levels"; a model writes it that way unprompted.
 */
export function listLead(text) {
    const m = /^\*\*([^*]+?)\*\*\s*(?:[—–:-]\s*)?([\s\S]*)$/.exec(text);
    if (!m)
        return null;
    let lead = (m[1] ?? "").trim().replace(/[.:]$/, "");
    // A lead that opens with an emoji — `**🤖 Robot.** …` — hands it to the
    // badge: the icon tile the ChatGPT app draws, from the model's own choice.
    const icon = /^(\p{Extended_Pictographic}\uFE0F?)\s+(.+)$/u.exec(lead);
    if (icon)
        lead = icon[2] ?? lead;
    let rest = (m[2] ?? "").trim();
    // `**Option.** [Recommended] why` — a short tag in brackets right after the
    // name becomes a pill under it, the way the ChatGPT app marks the option it
    // recommends. Only a short word or two; a citation handle is not a tag.
    let tag;
    const tagged = /^\[(?![A-Z]{1,2}\d)([^\]\n]{1,24})\]\s*([\s\S]*)$/.exec(rest);
    if (tagged) {
        tag = tagged[1].trim();
        rest = (tagged[2] ?? "").trim();
    }
    return { lead, rest, ...(icon ? { icon: icon[1] } : {}), ...(tag ? { tag } : {}) };
}
export function isCardList(items) {
    return items.length >= 2 && items.every((it) => listLead(it.text) !== null);
}
const INLINE_RE = /(`[^`]+`|!\[[^\]]*\]\([^)\s]+\)|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\)|\[[A-Z]{1,2}\d{1,3}(?:,\s*[A-Z]{1,2}\d{1,3})*\]|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;
export function parseInline(text) {
    const out = parseInlineRaw(text);
    // A citation a model writes before the full stop (`… tools [F2].`) is
    // drawn as a chip AFTER it, where the ChatGPT app puts its source chips:
    // the sentence ends, then its evidence.
    for (let i = 0; i + 1 < out.length; i++) {
        const cite = out[i];
        const next = out[i + 1];
        if (cite.kind !== "cite" || next.kind !== "text")
            continue;
        const m = /^([.,;:!?]+)([\s\S]*)$/.exec(next.text);
        if (!m)
            continue;
        // `contracts [F1].` — the space the model put before the handle would
        // otherwise sit before the full stop.
        const before = i > 0 ? out[i - 1] : null;
        if (before && before.kind === "text")
            before.text = before.text.replace(/\s+$/, "");
        out.splice(i, 2, { kind: "text", text: m[1] }, cite);
        if (m[2])
            out.splice(i + 2, 0, { kind: "text", text: m[2] });
        i += 1;
    }
    return out;
}
function parseInlineRaw(text) {
    const out = [];
    for (const part of text.split(INLINE_RE)) {
        if (!part)
            continue;
        if (/^\[[A-Z]{1,2}\d{1,3}(?:,\s*[A-Z]{1,2}\d{1,3})*\]$/.test(part)) {
            out.push({ kind: "cite", ids: part.slice(1, -1).split(/,\s*/) });
        }
        else if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
            out.push({ kind: "code", text: part.slice(1, -1) });
        }
        else if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
            const inner = part.slice(2, -2);
            out.push({ kind: "strong", text: inner, children: parseInline(inner) });
        }
        else if (/^\*[^*\s][^*]*\*$/.test(part)) {
            const inner = part.slice(1, -1);
            out.push({ kind: "em", text: inner, children: parseInline(inner) });
        }
        else {
            const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(part);
            if (image) {
                // Only a web image: a data: or javascript: "image" from a model is text.
                const src = safeHref(image[2] ?? "");
                if (src && /^https?:/.test(src))
                    out.push({ kind: "image", alt: image[1] ?? "", src });
                else
                    out.push({ kind: "text", text: image[1] ?? part });
                continue;
            }
            const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
            const href = link
                ? safeHref(link[2] ?? "")
                : /^https?:\/\//.test(part)
                    ? safeHref(part)
                    : null;
            if (link && href)
                out.push({ kind: "link", text: link[1] ?? href, href });
            else if (!link && href)
                out.push({ kind: "link", text: part, href });
            else
                out.push({ kind: "text", text: link ? (link[1] ?? part) : part });
        }
    }
    return out;
}
/** Every citation handle an answer uses, in order of first use. */
export function citedIds(text) {
    const ids = [];
    for (const m of text.matchAll(/\[([A-Z]{1,2}\d{1,3}(?:,\s*[A-Z]{1,2}\d{1,3})*)\]/g)) {
        for (const id of (m[1] ?? "").split(/,\s*/))
            if (!ids.includes(id))
                ids.push(id);
    }
    return ids;
}
/**
 * Only http(s), mailto and same-site paths become links. A `javascript:` URL in
 * model output is text, never a link — the answer is written by a model that
 * may have read a hostile page.
 */
export function safeHref(href) {
    const h = href.trim();
    if (h.startsWith("/") && !h.startsWith("//"))
        return h;
    if (h.startsWith("#"))
        return h;
    try {
        const u = new URL(h);
        return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:"
            ? u.href
            : null;
    }
    catch {
        return null;
    }
}
/** A same-site path navigates in place; anything else opens a new tab. */
export function isInternalHref(href) {
    return href.startsWith("/") || href.startsWith("#");
}
//# sourceMappingURL=markdown.js.map