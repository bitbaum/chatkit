import { type ReactNode } from "react";
import { type MessengerAttachment } from "../messenger.js";
import type { MessengerLabels } from "./messenger-labels.js";
/**
 * A face in the Messenger. A person is a circle, an agent a rounded square:
 * the shape says which before any word is read. Without a picture, a person
 * is their initials and an agent is `fallback` (the product's own mark, or
 * the package's).
 */
export declare function MessengerAvatar({ name, src, agent, size, online, fallback, }: {
    name: string;
    src?: string | null;
    agent?: boolean;
    size?: "sm" | "md" | "lg";
    online?: boolean;
    fallback?: ReactNode;
}): import("react").JSX.Element;
/**
 * What was sent with a message: pictures and films as tiles (one large, more
 * as a grid) that open in the viewer, a recording as a player, anything else
 * as a row that downloads. A film is drawn as its still and loads nothing
 * until it is opened.
 */
export declare function MessageAttachments({ attachments, labels, caption, }: {
    attachments: readonly MessengerAttachment[];
    labels: MessengerLabels;
    /** Shown in the viewer under the picture: who sent it, and when. */
    caption?: string;
}): import("react").JSX.Element;
/**
 * A picture or a film, the whole screen. A native `<dialog>`: Escape, the
 * focus trap and focus coming back to the tile are the browser's. Left and
 * right move through what the message carried.
 */
export declare function MediaViewer({ media, index, onIndex, onClose, labels, caption, }: {
    media: readonly MessengerAttachment[];
    index: number;
    onIndex: (index: number) => void;
    onClose: () => void;
    labels: MessengerLabels;
    caption?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=MessageAttachments.d.ts.map