"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { VOICE_MODE_OFF, voiceModeReducer, voiceModeWants, } from "../voice-mode.js";
import { useDictation, } from "./use-dictation.js";
import { useSpeech } from "./use-speech.js";
/**
 * A spoken conversation over any chat: listen, send, read the answer aloud,
 * listen again (`voiceModeReducer` holds the rules). Where the browser's own
 * recogniser runs, a pause ends the person's turn by itself; everywhere else
 * a press of the button does, which is also how a person takes their time.
 *
 * The microphone and the voice follow the phase and nothing else
 * (`voiceModeWants`), and both are shut when the component unmounts.
 */
export function useVoiceMode(opts) {
    const [state, dispatch] = useReducer(voiceModeReducer, VOICE_MODE_OFF);
    const onTurn = useRef(opts.onTurn);
    useEffect(() => {
        onTurn.current = opts.onTurn;
    }, [opts.onTurn]);
    /** Guards against an answer that arrives after the call moved on. */
    const turn = useRef(0);
    const dictation = useDictation({
        // A pause should end the turn where the browser can hear one; a press
        // ends it everywhere else.
        prefer: "browser",
        ...opts.dictation,
        onText: (text) => dispatch({ type: "heard", text }),
    });
    // The newest controller, for effects: set before any of them runs.
    const dictationRef = useRef(dictation);
    useEffect(() => {
        dictationRef.current = dictation;
    });
    const speech = useSpeech(opts.speaker);
    const { microphone, voice } = voiceModeWants(state.phase);
    // The microphone follows the phase.
    const micStatus = dictation.status;
    useEffect(() => {
        const d = dictationRef.current;
        // Listening and the microphone is free: open it. This runs again when a
        // take that held nothing has been written down (status back to idle), so
        // a second take follows an empty first one.
        if (microphone && micStatus === "idle")
            d.start();
        // Not the person's turn: a live take is thrown away. A take that is being
        // written down is left alone; it is the turn on its way.
        if (!microphone && micStatus === "listening")
            d.cancel();
    }, [microphone, micStatus, state.silentTakes]);
    // A microphone or transcription problem ends the call, with its reason on screen.
    // "silence" is a take with nothing in it: the rules count those and close
    // the microphone after two. Anything else is the microphone itself.
    const problem = dictation.problem;
    useEffect(() => {
        if (!problem || state.phase === "off")
            return;
        if (problem === "silence") {
            dictationRef.current.clearProblem();
            dispatch({ type: "heard", text: "" });
        }
        else {
            dispatch({ type: "problem" });
        }
    }, [problem, state.phase]);
    // The turn is sent once, when the phase becomes "thinking".
    useEffect(() => {
        if (state.phase !== "thinking")
            return;
        const mine = ++turn.current;
        let live = true;
        onTurn
            .current(state.said)
            .then((answer) => {
            if (live && mine === turn.current)
                dispatch({ type: "answer", text: answer ?? "" });
        })
            .catch(() => {
            if (live && mine === turn.current)
                dispatch({ type: "no-answer" });
        });
        return () => {
            live = false;
        };
    }, [state.phase, state.said]);
    // The voice follows the phase; when the reading ends, the person's turn begins.
    const speechRef = useRef(speech);
    useEffect(() => {
        speechRef.current = speech;
    });
    const reading = useRef(false);
    useEffect(() => {
        if (voice && state.answer) {
            reading.current = false;
            speechRef.current.speak(state.answer);
        }
        else {
            reading.current = false;
            speechRef.current.stop();
        }
    }, [voice, state.answer]);
    useEffect(() => {
        if (!voice)
            return;
        if (speech.speaking)
            reading.current = true;
        // Reading began and is over (or the device has no voice at all): listen.
        else if (reading.current || !speech.supported)
            dispatch({ type: "spoken" });
    }, [voice, speech.speaking, speech.supported]);
    const start = useCallback(() => dispatch({ type: "start" }), []);
    const end = useCallback(() => {
        turn.current++;
        dispatch({ type: "end" });
    }, []);
    const press = useCallback(() => {
        if (state.phase === "listening")
            dictationRef.current.stop();
        else if (state.phase === "speaking")
            dispatch({ type: "interrupt" });
    }, [state.phase]);
    return {
        supported: dictation.supported,
        state,
        dictation,
        start,
        end,
        press,
    };
}
//# sourceMappingURL=use-voice-mode.js.map