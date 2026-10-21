/** Declarative answer blocks. Model output is data, never HTML or executable SVG. */
export type RichBlock = {
    type: "gallery";
    title: string;
    images: {
        src: string;
        alt: string;
        caption?: string;
    }[];
} | {
    type: "diagram";
    title: string;
    nodes: {
        id: string;
        label: string;
        detail?: string;
    }[];
    edges: {
        from: string;
        to: string;
        label?: string;
    }[];
} | {
    type: "callout";
    title: string;
    body: string;
} | {
    type: "choices";
    title: string;
    options: {
        label: string;
        reply: string;
    }[];
    submit: string;
};
/** Web images or same-origin assets only; no embedded markup or protocol-relative URLs. */
export declare function safeImageSrc(value: unknown): string | null;
/** Invalid or oversized blocks are rejected without crashing the answer. */
export declare function parseRichBlock(raw: string): RichBlock | null;
export declare const RICH_ANSWERS_INSTRUCTION: string;
/** Copy, share and voice keep the content of a visual, never its wire JSON. */
export declare function richAnswerText(text: string): string;
//# sourceMappingURL=rich.d.ts.map