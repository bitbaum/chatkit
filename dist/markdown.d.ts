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
export type ListItem = {
    text: string;
    /** `- [ ]` / `- [x]`: a task, and whether it is done. */
    task?: boolean;
    /** One level of nesting: the items indented under this one. */
    children?: ListItem[];
};
export type MarkdownBlock = {
    kind: "p";
    text: string;
} | {
    kind: "h";
    text: string;
    level: 1 | 2 | 3;
} | {
    kind: "ul";
    items: ListItem[];
} | {
    kind: "ol";
    items: ListItem[];
    start: number;
} | {
    kind: "code";
    lang: string;
    code: string;
} | {
    kind: "quote";
    text: string;
} | {
    kind: "table";
    head: string[];
    rows: string[][];
} | {
    kind: "hr";
};
export declare function parseBlocks(text: string): MarkdownBlock[];
/**
 * A list where every item opens with a bold lead — `**Title.** body` — is a
 * list of named things, and reads as cards: a numbered or bulleted badge, the
 * name, the body under it. That is how the ChatGPT app lays out "three
 * options" or "two levels"; a model writes it that way unprompted.
 */
export declare function listLead(text: string): {
    lead: string;
    rest: string;
    icon?: string;
} | null;
export declare function isCardList(items: ListItem[]): boolean;
export type InlineSpan = {
    kind: "text";
    text: string;
} | {
    kind: "code";
    text: string;
} | {
    kind: "strong";
    text: string;
    children: InlineSpan[];
} | {
    kind: "em";
    text: string;
    children: InlineSpan[];
} | {
    kind: "link";
    text: string;
    href: string;
} | {
    kind: "image";
    alt: string;
    src: string;
} | {
    kind: "cite";
    ids: string[];
};
export declare function parseInline(text: string): InlineSpan[];
/** Every citation handle an answer uses, in order of first use. */
export declare function citedIds(text: string): string[];
/**
 * Only http(s), mailto and same-site paths become links. A `javascript:` URL in
 * model output is text, never a link — the answer is written by a model that
 * may have read a hostile page.
 */
export declare function safeHref(href: string): string | null;
/** A same-site path navigates in place; anything else opens a new tab. */
export declare function isInternalHref(href: string): boolean;
//# sourceMappingURL=markdown.d.ts.map