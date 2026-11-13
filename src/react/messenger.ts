/**
 * @bitbaum/chatkit/messenger — people talking to people, and to the agents
 * among them.
 *
 *   import { Messenger } from "@bitbaum/chatkit/messenger";
 *   import "@bitbaum/chatkit/styles/messenger.css";
 *
 *   <Messenger viewer={{ id: user.id }} transport={transport} agents={[cat]} />
 *
 * `Messenger` is the whole screen; `useMessenger`, `ConversationList` and
 * `MessageThread` are the parts, for an app with its own arrangement. The
 * shapes (`MessengerTransport` and friends) and every decision that needs no
 * DOM are re-exported from the framework-free half. The rules — who may read,
 * what is unread, what may be attached — are `@bitbaum/threadkit`'s.
 */
export { Messenger } from "./MessengerScreen.js";
export type {
  MessengerProps,
  MessengerComposerAction,
  MessengerComposerOptions,
} from "./MessengerScreen.js";
export { useMessenger } from "./use-messenger.js";
export type { MessengerController, UseMessengerOptions } from "./use-messenger.js";
export { ConversationList } from "./ConversationList.js";
export type { ConversationListProps } from "./ConversationList.js";
export { MessageThread } from "./MessageThread.js";
export type { MessageThreadProps } from "./MessageThread.js";
export { MessageAttachments, MediaViewer, MessengerAvatar } from "./MessageAttachments.js";
export { useUploads, DEFAULT_UPLOAD_OPTIONS } from "./use-uploads.js";
export type { UploadItem, UploadOptions, UploadsController } from "./use-uploads.js";
export { DEFAULT_MESSENGER_LABELS, messengerLabels } from "./messenger-labels.js";
export type { MessengerLabels, MessengerLabelOverrides } from "./messenger-labels.js";
export * from "../messenger.js";
export * from "../messenger-state.js";
export * from "../thread-rules.js";
