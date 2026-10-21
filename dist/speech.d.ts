export declare function plainTextForSpeech(markdown: string): string;
/**
 * Which voice language to ask for. The fleet's operators write mixed German
 * and English; a German sentence is detectable cheaply enough by its most
 * common function words to pick the voice, and the page's language otherwise.
 */
export declare function guessSpeechLang(text: string, fallback?: string): string;
/** Who reads the words. The browser's own voice by default (`useSpeech`); an
 *  app with a studio voice hands in its own with the same two methods. */
export type Speaker = {
    /** Resolves when the text has been read, or cut off. Never rejects. */
    speak(text: string): Promise<void>;
    cancel(): void;
};
/** The browser's own voice: free, offline, no key. `null` where there is none. */
export declare function createSynthSpeaker(): Speaker | null;
//# sourceMappingURL=speech.d.ts.map