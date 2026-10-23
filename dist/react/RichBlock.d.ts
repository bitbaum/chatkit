import type { RichBlock } from "../rich.js";
import { type ChartTable } from "../chart.js";
import { type RichRenderers } from "./renderers.js";
/**
 * The chart chatkit draws itself: the caption and a table of the data. It is
 * what a reader gets without an injected renderer, when the renderer returns
 * null for a kind it does not draw, and when the block is malformed — a chart
 * is never a blank. Numbers sit right-aligned in tabular figures; a row with a
 * link is a link.
 */
export declare function ChartTableFigure({ table }: {
    table: ChartTable;
}): import("react").JSX.Element;
export declare function RichAnswerBlock({ block, onReply, renderers: own, }: {
    block: RichBlock;
    onReply?: (text: string) => void;
    /** The app's drawing for a chart; without it, the caption and a table. */
    renderers?: RichRenderers;
}): import("react").JSX.Element;
//# sourceMappingURL=RichBlock.d.ts.map