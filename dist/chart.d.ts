/**
 * Charts in answers (0.15). chatkit defines the DATA contract and a renderer
 * slot; the drawing is injected by the app (`renderers={{ chart }}` on
 * `ChatThread`, `ChatScreen`, `ChatMessage`, `Markdown` or `RichAnswerBlock`).
 * Substrata hands the block to `@bitbaum/chartkit`; the shapes here mirror
 * chartkit's props exactly, so a block spreads into the matching component:
 *
 *   chart: (b) => b.chart === "bars" ? <BarChart {...b} /> : …
 *
 * Without a renderer, or when one returns null, chatkit draws the caption and
 * a table of the data itself — a chart is never a blank.
 */
export type ChartPoint = {
    /** A year, a date or a number along the x axis. */
    x: string | number;
    y: number;
    href?: string;
    note?: string;
};
export type ChartSeries = {
    id: string;
    label: string;
    points: ChartPoint[];
};
export type ChartRow = {
    label: string;
    value: number;
    href?: string;
    /** Percent of the whole, 0–100. */
    share?: number;
    note?: string;
    estimated?: boolean;
};
export type ShareRow = {
    label: string;
    share: number;
    href?: string;
};
export type ChartEvent = {
    date: string;
    label: string;
    href?: string;
    tone?: "up" | "down" | "neutral";
    kind?: string;
};
export type ChartTile = {
    label: string;
    value: string | number;
    href?: string;
    note?: string;
};
/** One of chartkit's five figures, as data. */
export type ChartBlock = {
    type: "chart";
    chart: "line";
    caption: string;
    unit?: string;
    series: ChartSeries[];
} | {
    type: "chart";
    chart: "bars";
    caption: string;
    unit?: string;
    rows: ChartRow[];
    /** The label of the row to draw in the accent (the reader's country, the answer). */
    highlight?: string;
} | {
    type: "chart";
    chart: "share";
    caption: string;
    rows: ShareRow[];
    /** The share left over, 0–100, drawn as "Other". */
    other?: number;
} | {
    type: "chart";
    chart: "timeline";
    caption: string;
    events: ChartEvent[];
} | {
    type: "chart";
    chart: "tiles";
    caption: string;
    tiles: ChartTile[];
};
export type ChartKind = ChartBlock["chart"];
export declare const CHART_KINDS: readonly ["line", "bars", "share", "timeline", "tiles"];
/** Same-origin paths and web URLs only; a link in a chart is a link, never markup. */
export declare function safeChartHref(value: unknown): value is string;
/**
 * A chart block, validated field by field against chartkit's shapes: bounded
 * lists, finite numbers, safe links. Anything else is null — the caller then
 * degrades it with `chartFallback` rather than dropping it.
 */
export declare function parseChartBlock(b: unknown): ChartBlock | null;
/** The data of a chart as a table: what chatkit draws without a renderer,
 *  and what Copy and Listen read. */
export type ChartTable = {
    caption: string;
    head: string[];
    rows: {
        cells: string[];
        href?: string;
    }[];
};
/**
 * A table of whatever a chart block holds — valid or not. A malformed block
 * (a share of 140, a link with a script in it, forty rows) still has a caption
 * and some rows a reader can use, so the answer shows those instead of a hole.
 * Only the safe parts travel: string labels, finite numbers, safe links.
 * Partial JSON, or anything that is not a chart with a caption, is null.
 */
export declare function chartFallback(raw: string | unknown): ChartTable | null;
/** Copy, share and voice get the figures as lines, never the wire JSON. */
export declare function chartText(block: ChartBlock): string;
//# sourceMappingURL=chart.d.ts.map