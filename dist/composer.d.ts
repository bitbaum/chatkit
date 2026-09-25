/**
 * The composer's decisions, kept out of the component so they can be tested
 * without a DOM — and so every app that uses the one composer gets exactly the
 * same answer to "may this send?" and "does the draft survive?".
 *
 * From loki `src/components/composer/composer-logic.ts`, where these were
 * written after four composers in one app gave four different answers.
 */
/** A destination the same words can go to (e.g. Ask vs Inject). */
export type ComposerMode = {
    id: string;
    label: string;
    hint?: string;
};
/** `false` keeps the draft (the send failed or was refused); anything else
 *  clears it. A failed send must be retryable from the same box, not retyped. */
export type ComposerSendResult = void | boolean;
export declare function composerCanSend({ text, attachmentCount, attachmentOnlyText, sending, disabled, blocked, }: {
    text: string;
    attachmentCount: number;
    attachmentOnlyText?: string;
    sending: boolean;
    disabled: boolean;
    blocked: boolean;
}): boolean;
/** The words actually sent: the draft, or the app's stand-in for an
 *  attachments-only send. */
export declare function composerOutgoingText(text: string, attachmentCount: number, attachmentOnlyText?: string): string;
export declare function shouldClearDraft(result: ComposerSendResult): boolean;
/** Dictated words join the draft with one space, never glued to the last word. */
export declare function appendTranscript(draft: string, said: string): string;
/** `75` → `1:15`. The recording timer. */
export declare function formatElapsed(seconds: number): string;
//# sourceMappingURL=composer.d.ts.map