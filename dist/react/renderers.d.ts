import { type ReactNode } from "react";
import type { ChartBlock } from "../chart.js";
/**
 * The drawing an app injects into answers. chatkit stays dependency-free:
 * it validates the data and leaves the slot; the app fills it.
 *
 *   <ChatThread renderers={{ chart: (b) => <Chart {...b} /> }} … />
 *
 * A renderer that returns `null` hands the block back to chatkit's own
 * fallback (the caption and a table of the data), so an app can draw the
 * kinds it has a component for and leave the rest readable.
 */
export type RichRenderers = {
    chart?: (block: ChartBlock) => ReactNode;
};
/** Set once at the screen (`ChatScreen renderers`), read by every answer in it. */
export declare const RichRenderersContext: import("react").Context<RichRenderers | undefined>;
/** The renderers in force: the prop, over what the screen provided. */
export declare function useRichRenderers(own?: RichRenderers): RichRenderers | undefined;
//# sourceMappingURL=renderers.d.ts.map