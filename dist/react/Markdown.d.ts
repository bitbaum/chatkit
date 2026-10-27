import { type ReactNode } from "react";
import type { RichRenderers } from "./renderers.js";
import { type AlertKind } from "../markdown.js";
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
/** The sources an answer cites, listed once under it. The default is the chip
 *  row; an app with its own source sheet renders that here instead. */
export type RenderSources = (sources: {
    records: {
        id: string;
        label: string;
        detail: string;
        href?: string;
    }[];
    label: string;
}) => ReactNode;
/** A plain anchor: same-site paths in place, everything else in a new tab. */
export declare const defaultRenderLink: RenderLink;
/**
 * The sources an answer cites, listed once under it. On a mouse, a row of
 * chips. On a touch screen, ONE "Sources" button that opens a sheet with every
 * record — its label, what it is, and a link — the way the ChatGPT app lists
 * them: a row of chips on a phone was a row of cut-off words.
 */
export declare function SourcesRow({ records, label, renderLink, }: {
    records: {
        id: string;
        label: string;
        detail: string;
        href?: string;
    }[];
    label: string;
    renderLink?: RenderLink;
}): import("react").JSX.Element | null;
/** The in-text citation as a chip: the first source's name, and how many
 *  more stand behind the sentence — the ChatGPT app's "NVIDIA De… +3". The
 *  full list stays in the sources row under the answer. */
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
export declare const DEFAULT_ALERT_LABELS: Record<AlertKind, string>;
export declare function Markdown({ text, citations, renderLink, renderCitation, renderSources, sources, sourcesLabel, alertLabels, className, onReply, renderers, }: {
    text: string;
    /** A visual choice sends a normal conversation message. Omit while streaming. */
    onReply?: (text: string) => void;
    /** The app's drawing for a chart block; without it, the caption and a table. */
    renderers?: RichRenderers;
    citations?: CitationMap;
    renderLink?: RenderLink;
    renderCitation?: RenderCitation;
    /** Your own sources row (a button that opens a sheet) in place of the chips. */
    renderSources?: RenderSources;
    /** The row of cited sources under the answer (needs `citations`). */
    sources?: boolean;
    sourcesLabel?: string;
    /** The word on a `> [!CAUTION]` callout, in the product's language. */
    alertLabels?: Partial<Record<AlertKind, string>>;
    className?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=Markdown.d.ts.map