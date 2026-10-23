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
export type { ComposerProps, ComposerLabels, ComposerLabelOverrides, ComposerVoice, } from "./Composer.js";
export { ChatThread, ChatMessage, ChatReplies, ChatStarters, ThinkingRow, formatThinkingDuration, DEFAULT_THREAD_LABELS, } from "./Thread.js";
export type { ChatMessageData, ChatSpeaker, LiveTurn, Starter, Thinking, ThinkingStep, ThreadLabels, } from "./Thread.js";
export { ChatScreen } from "./Screen.js";
export { Markdown, SourcesRow, defaultRenderLink, defaultRenderCitation } from "./Markdown.js";
export { AnswerActions, DEFAULT_ANSWER_ACTIONS_LABELS } from "./AnswerActions.js";
export type { AnswerActionsLabels } from "./AnswerActions.js";
export { useSpeech } from "./use-speech.js";
export type { SpeechController } from "./use-speech.js";
export { Sheet, prefersSheet } from "./Sheet.js";
export type { CitationMap, RenderLink, RenderCitation, RenderSources } from "./Markdown.js";
export { useDictation } from "./use-dictation.js";
export type { DictationController, DictationStatus, UseDictationOptions } from "./use-dictation.js";
export { AttachMenu, DEFAULT_ATTACH_MENU_LABELS } from "./AttachMenu.js";
export type { AttachMenuLabels } from "./AttachMenu.js";
export { useAttachments } from "./use-attachments.js";
export type { AttachmentsController } from "./use-attachments.js";
export { useClipboard, useStickToBottom, useViewportHeight, useAutoGrow } from "./hooks.js";
export { RichAnswerBlock, ChartTableFigure } from "./RichBlock.js";
export { RichRenderersContext, useRichRenderers } from "./renderers.js";
export type { RichRenderers } from "./renderers.js";
//# sourceMappingURL=index.d.ts.map