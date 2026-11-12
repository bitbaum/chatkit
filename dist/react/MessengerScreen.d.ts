import { type ReactNode, type RefObject } from "react";
import { type MessengerAgent, type MessengerConversation, type MessengerDrafts, type MessengerParticipant, type MessengerTransport } from "../messenger.js";
import { type ComposerLabelOverrides, type ComposerVoice } from "./Composer.js";
import { type ConversationListProps } from "./ConversationList.js";
import type { RenderLink } from "./Markdown.js";
import { type MessengerLabelOverrides } from "./messenger-labels.js";
import { type UploadOptions } from "./use-uploads.js";
export type MessengerComposerOptions = {
    /** The microphone. Pass `{ transcribeUrl }` so it works where the browser's
     *  recogniser does not. */
    voice?: ComposerVoice | false;
    /** What may be attached and how photos are shrunk. `false` offers no files
     *  even when the transport can upload. */
    attach?: UploadOptions | false;
    /** Inside the box, above the words: a product's own line ("Sending as …"). */
    header?: ReactNode;
    /** Around the box: a menu that needs the keys before the box does. */
    wrap?: (box: ReactNode) => ReactNode;
    inputRef?: RefObject<HTMLTextAreaElement | null>;
    /** What a conversation's box holds when it is opened by a link that says
     *  what to write. Wins over a kept draft, once. */
    initialDraft?: (conversationId: string) => string | undefined;
    labels?: ComposerLabelOverrides;
};
export type MessengerProps = {
    /** Who is using it. `id` is what their own messages carry as `authorId`. */
    viewer: {
        id: string;
    };
    /** The app's backend (see `MessengerTransport`). */
    transport: MessengerTransport;
    /** Agents people can bring in by naming them. */
    agents?: readonly MessengerAgent[];
    /** The open conversation, when the app keeps it (the URL). */
    conversationId?: string | null;
    onConversationChange?: (id: string | null) => void;
    composer?: MessengerComposerOptions;
    /** Where unsent words are kept. Default: this tab (`sessionDrafts`). */
    drafts?: MessengerDrafts;
    /** Under the list's title. */
    listHeader?: ReactNode;
    /** At the end of a conversation's top bar: a product's own controls. */
    headerActions?: (conversation: MessengerConversation) => ReactNode;
    /** Where the name in the top bar leads (a profile), if anywhere. */
    profileHref?: (participant: MessengerParticipant) => string | undefined;
    search?: ConversationListProps["search"];
    renderLink?: RenderLink;
    /** The product's own mark for its agent, where it has no picture. */
    agentMark?: ReactNode;
    /**
     * `"parent"` (the default) fills the box it is given — give it a height.
     * `"viewport"` is the whole display and follows the visual viewport, so the
     * box rides above the phone keyboard.
     */
    fill?: "parent" | "viewport";
    locale?: string;
    timeZone?: string;
    agentPatienceMs?: number;
    labels?: MessengerLabelOverrides;
    className?: string;
};
/**
 * The messenger, whole: the list of conversations, the conversation, the box.
 * On a phone it is one screen at a time — the list, then the conversation
 * with its own way back — and from 48rem of its own width the two sit side
 * by side. The app gives it a `transport` and a place to live; it has no
 * database, no websocket and no storage of its own.
 *
 *   <Messenger viewer={{ id }} transport={transport} agents={[cat]}
 *     conversationId={id} onConversationChange={setId}
 *     composer={{ voice: { transcribeUrl: "/api/transcribe" } }} />
 *
 * An app that needs its own arrangement uses the parts it is made of:
 * `useMessenger`, `ConversationList`, `MessageThread`.
 */
export declare function Messenger({ viewer, transport, agents, conversationId, onConversationChange, composer, drafts, listHeader, headerActions, profileHref, search, renderLink, agentMark, fill, locale, timeZone, agentPatienceMs, labels: labelOverrides, className, }: MessengerProps): import("react").JSX.Element;
//# sourceMappingURL=MessengerScreen.d.ts.map