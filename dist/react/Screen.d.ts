import { type ReactNode } from "react";
/**
 * The chat as the whole screen, the way the ChatGPT and Claude apps lay it
 * out: the conversation runs edge to edge and top to bottom, and the controls
 * FLOAT over it — a see-through header at the top, the composer at the bottom
 * — instead of each taking a strip of the screen away from the reading.
 *
 * Words scroll under both. They fade out as they pass beneath the header and
 * the composer, so the controls stay legible without an opaque bar behind
 * them; the last line of an answer always rests above the composer, never
 * behind it (the scroller is padded by the measured height of each).
 *
 * The heights are published as `--ck-top-inset` and `--ck-bottom-inset` on
 * the screen, so an app whose thread is its own scroller pads it with them:
 *
 *   .my-thread { padding-block: var(--ck-top-inset) var(--ck-bottom-inset); }
 *
 * chatkit's own `ChatThread` does that already.
 */
export declare function ChatScreen({ header, composer, footnote, children, fill, className, }: {
    /** Floats over the top of the conversation. Give its buttons `ck-glass`. */
    header?: ReactNode;
    /** The composer (and anything that belongs with it: an error, a queue). */
    composer: ReactNode;
    /** One quiet line under the composer ("Answers can be wrong"). */
    footnote?: ReactNode;
    /** The conversation: a `ChatThread`, or an app's own scroller. */
    children: ReactNode;
    /**
     * "parent" fills the box the app gives it. "viewport" takes the visual
     * viewport — the height that shrinks when the phone keyboard opens, so the
     * composer rides on top of the keyboard instead of behind it.
     */
    fill?: "parent" | "viewport";
    className?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=Screen.d.ts.map