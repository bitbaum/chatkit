import type { MessengerLabels } from "./messenger-labels.js";
/** The longest voice message: five minutes. Past it the take ends by itself. */
export declare const VOICE_MESSAGE_MAX_MS: number;
/** The container the browser can record a voice in, best first. Safari takes
 *  only MP4; everything else takes WebM/Opus, which is much smaller. */
export declare function voiceMimeType(supported?: (type: string) => boolean): string | null;
/** Can this browser record a voice message at all? */
export declare function canRecordVoice(): boolean;
/** "voice-2026-11-13-2004.webm": a name a person can find again in a folder. */
export declare function voiceFileName(at: Date, mimeType: string): string;
/**
 * Record a voice message: one button to start, the same one to stop, then
 * listen to it and add it to the message or take it again. The microphone is
 * open only while recording and is closed on every way out (stop, the take
 * running to its limit, the sheet closing), so it is never left on.
 *
 * The take is handed over as a `File`; the Messenger puts it in the tray like
 * any other, so it is uploaded, shown and sent by what already sends a photo.
 */
export declare function VoiceRecorder({ onDone, labels, maxMs, }: {
    onDone: (file: File) => void;
    labels: MessengerLabels;
    maxMs?: number;
}): import("react").JSX.Element;
//# sourceMappingURL=VoiceRecorder.d.ts.map