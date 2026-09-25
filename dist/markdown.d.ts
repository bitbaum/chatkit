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
export type MarkdownBlock = {
    kind: "p";
    text: string;
} | {
    kind: "h";
    text: string;
} | {
    kind: "ul";
    items: string[];
} | {
    kind: "ol";
    items: string[];
} | {
    kind: "code";
    lang: string;
    code: string;
} | {
    kind: "quote";
    text: string;
};
export declare function parseBlocks(text: string): MarkdownBlock[];
export type InlineSpan = {
    kind: "text";
    text: string;
} | {
    kind: "code";
    text: string;
} | {
    kind: "strong";
    text: string;
} | {
    kind: "em";
    text: string;
} | {
    kind: "link";
    text: string;
    href: string;
} | {
    kind: "cite";
    ids: string[];
};
export declare function parseInline(text: string): InlineSpan[];
/**
 * Only http(s), mailto and same-site paths become links. A `javascript:` URL in
 * model output is text, never a link — the answer is written by a model that
 * may have read a hostile page.
 */
export declare function safeHref(href: string): string | null;
/** A same-site path navigates in place; anything else opens a new tab. */
export declare function isInternalHref(href: string): boolean;
//# sourceMappingURL=markdown.d.ts.map