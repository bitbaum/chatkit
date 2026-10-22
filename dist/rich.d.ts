/** Declarative answer blocks. Model output is data, never HTML or executable SVG. */
export type RichBlock = {
    type: "audio";
    title: string;
    src: string;
    creator?: string;
    caption?: string;
} | {
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
} | {
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
export declare const STACK_ICONS: readonly ["agent", "people", "robot", "person", "building", "money", "document", "code", "check", "globe", "wrench", "box", "chat", "flag"];
export type StackIcon = (typeof STACK_ICONS)[number];
/** Web images or same-origin assets only; no embedded markup or protocol-relative URLs. */
export declare function safeImageSrc(value: unknown): string | null;
/** Invalid or oversized blocks are rejected without crashing the answer. */
export declare function parseRichBlock(raw: string): RichBlock | null;
export declare const RICH_ANSWERS_INSTRUCTION: string;
/** Copy, share and voice keep the content of a visual, never its wire JSON. */
export declare function richAnswerText(text: string): string;
//# sourceMappingURL=rich.d.ts.map