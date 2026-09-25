import type { ReactNode } from "react";
/** What a grounded answer's `[F8]` / `[D1]` handle refers to. Unknown handles
 *  are dropped rather than shown bare: a dangling `[F8]` implies a source the
 *  reader cannot reach. */
export type CitationMap = Record<string, {
    label: string;
    detail: string;
}>;
export type RenderLink = (link: {
    href: string;
    internal: boolean;
    className: string;
    children: ReactNode;
}) => ReactNode;
/** A plain anchor: same-site paths in place, everything else in a new tab. */
export declare const defaultRenderLink: RenderLink;
/**
 * Model output as readable text: paragraphs, lists, headings, bold, italic,
 * code, links and citations. Never HTML — nothing here can inject markup.
 */
export declare function Markdown({ text, citations, renderLink, className, }: {
    text: string;
    citations?: CitationMap;
    renderLink?: RenderLink;
    className?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=Markdown.d.ts.map