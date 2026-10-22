/**
 * The feedback loop between a chat and the people improving it.
 *
 * Two halves, one shape. The reader's half is a thumb under an answer with a
 * reason (`AnswerFeedback`, drawn by `AnswerActions`). The fleet's half is a
 * nightly judge that reads a day of conversations from each product and
 * says, for every answer, what the person most likely wanted, what the
 * product could have given them with the tools it has, and what it gave -
 * so a wall ("not in our data"), a wrong tool, a missing follow-up or a
 * vague answer is found on its own, not when the owner trips over it.
 *
 * The judge is a model call the product makes with ai-kit; this file holds
 * the instruction it is given, the shape it must answer in, and the parser
 * that reads it back. Products export their transcripts in `ChatTranscript`
 * form; Loki collects them and files findings into its feedback inbox.
 */
export type AnswerFeedback = {
    messageId: string;
    verdict: "up" | "down";
    /** One of FEEDBACK_REASONS, when the person picked one. */
    reason?: FeedbackReason;
    /** Their own words, when they typed any. */
    text?: string;
};
export declare const FEEDBACK_REASONS: readonly ["wrong", "dead_end", "vague", "misread", "too_long", "format", "other"];
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];
/** One conversation as a product exports it for review. Anonymised: ids are
 *  the product's own, never a person's name or address. */
export type ChatTranscript = {
    id: string;
    /** When the last turn was written, ISO 8601. */
    at: string;
    /** Where the conversation happened ("/chat", "/markets/asml"). */
    surface?: string;
    turns: ChatTranscriptTurn[];
    /** Thumbs the person gave, by message id. */
    feedback?: AnswerFeedback[];
};
export type ChatTranscriptTurn = {
    id: string;
    role: "user" | "assistant";
    content: string;
    /** Tool calls and status lines the assistant produced for this answer. */
    steps?: string[];
    /** The turn failed or was stopped. */
    failed?: boolean;
};
/** The judge's verdict on one answer. */
export type ChatReview = {
    messageId: string;
    /** 1 = useless, 5 = the best this product could have done. */
    score: 1 | 2 | 3 | 4 | 5;
    /** What the person most likely wanted, in one sentence. */
    expected: string;
    /** What the product could have given with the tools it has. */
    deliverable: string;
    /** What it gave, in one sentence. */
    delivered: string;
    /** The gaps between them, each a short label from REVIEW_GAPS. */
    gaps: ReviewGap[];
    /** One concrete change that would have closed the biggest gap. */
    fix: string;
};
export declare const REVIEW_GAPS: readonly ["dead_end", "wrong_tool", "no_web", "misread", "vague", "too_long", "no_next_step", "format", "tone", "wrong", "slow"];
export type ReviewGap = (typeof REVIEW_GAPS)[number];
export declare const CHAT_REVIEW_INSTRUCTION: string;
export declare const MAX_REVIEWS = 40;
/** Read the judge's answer back; invalid or oversized output yields no reviews. */
export declare function parseChatReview(raw: string): ChatReview[];
/** The judge's input for one conversation: the product's scope, then the turns. */
export declare function reviewPrompt(scope: string, transcript: ChatTranscript): string;
//# sourceMappingURL=review.d.ts.map