import type { ReactNode } from "react";
/** What a grounded answer's `[F8]` / `[D1]` handle refers to. Unknown handles
 *  are dropped rather than shown bare: a dangling `[F8]` implies a source the
 *  reader cannot reach. */
export type CitationMap = Record<string, {
    label: string;
    detail: string;
    href?: string;
}>;
export type RenderLink = (link: {
    href: string;
    internal: boolean;
    className: string;
    children: ReactNode;
}) => ReactNode;
/** How a `[F1]` handle shows in the text. The default is a small superscript
 *  with the source in its tooltip; an app with its own source sheet renders
 *  that here instead. */
export type RenderCitation = (cite: {
    ids: string[];
    citations: CitationMap;
    className: string;
}) => ReactNode;
/** A plain anchor: same-site paths in place, everything else in a new tab. */
export declare const defaultRenderLink: RenderLink;
export declare const defaultRenderCitation: RenderCitation;
/**
 * Model output as readable text: paragraphs, lists, headings, tables, bold,
 * italic, code, links, images and citations. Never HTML — nothing here can
 * inject markup.
 *
 * A list of named things (`1. **Option.** why`) becomes cards with a badge,
 * a name and a body; a table becomes a table that scrolls sideways on a phone
 * instead of breaking the page; the sources an answer cites are listed once
 * under it as chips.
 */
export declare function Markdown({ text, citations, renderLink, renderCitation, sources, sourcesLabel, className, }: {
    text: string;
    citations?: CitationMap;
    renderLink?: RenderLink;
    renderCitation?: RenderCitation;
    /** The chip row of cited sources under the answer (needs `citations`). */
    sources?: boolean;
    sourcesLabel?: string;
    className?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=Markdown.d.ts.map