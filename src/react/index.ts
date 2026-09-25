/**
 * @bitbaum/chatkit/react — the chat every product uses.
 *
 *   import { Composer, ChatThread, ChatStarters } from "@bitbaum/chatkit/react";
 *   import "@bitbaum/chatkit/styles.css";
 *
 * Behaviour is fixed here and identical everywhere; the look follows the
 * app's tokens through `--ck-*` variables (see styles.css).
 */
export { Composer, DEFAULT_COMPOSER_LABELS } from "./Composer.js";
export type { ComposerProps, ComposerLabels, ComposerVoice } from "./Composer.js";
export { ChatThread, ChatMessage, ChatStarters, DEFAULT_THREAD_LABELS } from "./Thread.js";
export type { ChatMessageData, ChatSpeaker, LiveTurn, Starter, ThreadLabels } from "./Thread.js";
export { Markdown, defaultRenderLink } from "./Markdown.js";
export type { CitationMap, RenderLink } from "./Markdown.js";
export { useDictation } from "./use-dictation.js";
export type { DictationController, DictationStatus, UseDictationOptions } from "./use-dictation.js";
export { useAttachments } from "./use-attachments.js";
export type { AttachmentsController } from "./use-attachments.js";
export { useClipboard, useStickToBottom, useViewportHeight, useAutoGrow } from "./hooks.js";
