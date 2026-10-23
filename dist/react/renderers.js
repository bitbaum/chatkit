"use client";
import { createContext, useContext } from "react";
/** Set once at the screen (`ChatScreen renderers`), read by every answer in it. */
export const RichRenderersContext = createContext(undefined);
/** The renderers in force: the prop, over what the screen provided. */
export function useRichRenderers(own) {
    const inherited = useContext(RichRenderersContext);
    if (!own)
        return inherited;
    if (!inherited)
        return own;
    return { ...inherited, ...own };
}
//# sourceMappingURL=renderers.js.map