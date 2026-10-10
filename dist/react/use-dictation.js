"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MAX_AUDIO_FILE_BYTES, MAX_RECORDING_MS, PERMISSION_WAIT_MS, RECORDING_MIME_CANDIDATES, START_TIMEOUT_MS, audioFileName, deadRecogniserStillTrusted, fallbackCanRescue, liveWords, problemFor, problemForRecording, reasonFromBody, reasonOf, TranscriptionError, } from "../dictation.js";
function recogniser() {
    if (typeof window === "undefined")
        return undefined;
    const w = window;
    return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
function canRecord() {
    return (typeof window !== "undefined" &&
        typeof MediaRecorder !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia);
}
const noSubscribe = () => () => { };
const DEFAULT_REMEMBER_KEY = "chatkit.dictation.recogniser-dead.v1";
function readDead(key) {
    if (!key)
        return false;
    try {
        const raw = window.localStorage.getItem(key);
        return deadRecogniserStillTrusted(raw === null ? null : Number(raw));
    }
    catch {
        return false;
    }
}
function rememberDead(key) {
    if (!key)
        return;
    try {
        window.localStorage.setItem(key, String(Date.now()));
    }
    catch {
        /* private mode — the person simply waits again next time */
    }
}
async function awaitingPermission() {
    try {
        const s = await navigator.permissions.query({ name: "microphone" });
        return s.state === "prompt";
    }
    catch {
        return false;
    }
}
async function postAudio(url, audio, locale) {
    const body = new FormData();
    const name = audioFileName(audio);
    body.append("audio", new File([audio], name, { type: audio.type || "audio/webm" }));
    body.append("locale", locale);
    const res = await fetch(url, { method: "POST", body });
    if (!res.ok) {
        const said = reasonFromBody(await res.json().catch(() => null));
        throw new TranscriptionError(said, res.status);
    }
    const data = (await res.json().catch(() => ({})));
    return typeof data.text === "string" ? data.text.trim() : "";
}
/**
 * Speaking instead of typing — with a microphone that is never a dead button.
 *
 * Browser recogniser first (unless `prefer: "server"`); when it is missing, or
 * accepts `start()` and then says nothing (heidi measured nine silent seconds
 * on a real Chromium), the same press RECORDS and the server transcribes. A
 * failure always ends as a `problem` the composer shows in words.
 *
 * Every microphone track is stopped on every exit path. A mic left open on
 * someone's device because a request failed is the worst bug a chat can have.
 */
export function useDictation(opts) {
    const { prefer = "browser", maxRecordingMs = MAX_RECORDING_MS, maxAudioFileBytes = MAX_AUDIO_FILE_BYTES, } = opts;
    const rememberKey = opts.rememberKey === undefined ? DEFAULT_REMEMBER_KEY : opts.rememberKey;
    const hasServer = Boolean(opts.transcribe || opts.transcribeUrl);
    const supported = useSyncExternalStore(noSubscribe, () => Boolean(recogniser()) || (hasServer && canRecord()), () => false);
    const [status, setStatus] = useState("idle");
    const [startedAt, setStartedAt] = useState(null);
    const [liveText, setLiveText] = useState("");
    const [problem, setProblemState] = useState(null);
    const [problemDetail, setProblemDetail] = useState(null);
    // The last take the server failed on — kept so a retry costs a tap, not a
    // repeat of everything that was said. Cleared by anything that moves on.
    const failedTake = useRef(null);
    const [canRetry, setCanRetry] = useState(false);
    const setProblem = useCallback((next) => {
        setProblemState(next);
        setProblemDetail(null);
        if (next === null || next !== "unavailable") {
            failedTake.current = null;
            setCanRetry(false);
        }
    }, []);
    const failTake = useCallback((audio, error) => {
        setProblemState("unavailable");
        setProblemDetail(reasonOf(error));
        failedTake.current = audio;
        setCanRetry(true);
    }, []);
    // Latest options in refs, assigned in an effect (never during render), so a
    // take that outlives a re-render calls the current callbacks.
    const optsRef = useRef(opts);
    useEffect(() => {
        optsRef.current = opts;
    });
    const recRef = useRef(null);
    /** The recogniser that only PREVIEWS while the server leg records. */
    const previewRef = useRef(null);
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const cancelledRef = useRef(false);
    const capTimer = useRef(null);
    const locale = useCallback(() => {
        const l = optsRef.current.lang ??
            (typeof document !== "undefined" ? document.documentElement.lang : "") ??
            "";
        return l || (typeof navigator !== "undefined" ? navigator.language : "en") || "en";
    }, []);
    const stopPreview = useCallback(() => {
        const p = previewRef.current;
        previewRef.current = null;
        try {
            p?.abort();
        }
        catch {
            /* already gone */
        }
    }, []);
    /**
     * Live words beside a server-leg recording. Best effort and never load-
     * bearing: a recogniser that is missing, refuses, or says nothing leaves
     * the wave on screen, and the take — the recording — is untouched. Its
     * failures are deliberately not fed to the problem line: the person is
     * being recorded fine, and "mic" or "unavailable" would be a lie about that.
     */
    const startPreview = useCallback(() => {
        const Ctor = recogniser();
        if (!Ctor)
            return;
        let rec;
        try {
            rec = new Ctor();
            rec.lang = locale();
            rec.continuous = true;
            rec.interimResults = true;
        }
        catch {
            return;
        }
        const finals = [];
        rec.onstart = null;
        rec.onresult = (event) => {
            if (previewRef.current !== rec)
                return;
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const r = event.results[i];
                const t = r?.[0]?.transcript ?? "";
                if (r && r.isFinal)
                    finals.push(t);
                else
                    interim += t;
            }
            setLiveText(liveWords(finals, interim));
        };
        rec.onerror = () => {
            if (previewRef.current === rec)
                previewRef.current = null;
        };
        rec.onend = () => {
            if (previewRef.current === rec)
                previewRef.current = null;
        };
        try {
            rec.start();
            previewRef.current = rec;
        }
        catch {
            /* no preview, still a take */
        }
    }, [locale]);
    const releaseMic = useCallback(() => {
        stopPreview();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (capTimer.current) {
            clearTimeout(capTimer.current);
            capTimer.current = null;
        }
    }, [stopPreview]);
    const deliver = useCallback((said) => {
        const t = said.trim();
        if (t)
            optsRef.current.onText(t);
        else
            setProblem("silence");
    }, []);
    const transcribe = useCallback(async (audio) => {
        const o = optsRef.current;
        const lang = locale().split("-")[0] ?? "en";
        if (o.transcribe)
            return o.transcribe(audio, lang);
        if (o.transcribeUrl)
            return postAudio(o.transcribeUrl, audio, lang);
        throw new Error("no server leg");
    }, [locale]);
    /** The server leg: record, then transcribe. */
    const record = useCallback(async () => {
        if (!canRecord() || !(optsRef.current.transcribe || optsRef.current.transcribeUrl)) {
            setProblem("unavailable");
            setStatus("idle");
            return;
        }
        setProblem(null);
        cancelledRef.current = false;
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        catch (e) {
            setProblem(problemForRecording(e));
            setStatus("idle");
            return;
        }
        streamRef.current = stream;
        let rec;
        try {
            const mime = RECORDING_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported?.(m));
            rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        }
        catch (e) {
            releaseMic();
            setProblem(problemForRecording(e));
            setStatus("idle");
            return;
        }
        const chunks = [];
        rec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0)
                chunks.push(e.data);
        };
        rec.onstop = async () => {
            releaseMic();
            recorderRef.current = null;
            setStartedAt(null);
            if (cancelledRef.current) {
                setLiveText("");
                setStatus("idle");
                return;
            }
            const audio = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
            if (audio.size === 0) {
                setLiveText("");
                setProblem("silence");
                setStatus("idle");
                return;
            }
            // The live words stay on screen, dimmed, while the server transcribes:
            // the person keeps seeing what they said until the real words land.
            setStatus("transcribing");
            try {
                deliver(await transcribe(audio));
            }
            catch (e) {
                failTake(audio, e);
            }
            finally {
                setLiveText("");
                setStatus("idle");
            }
        };
        recorderRef.current = rec;
        rec.start();
        setLiveText("");
        startPreview();
        setStatus("listening");
        setStartedAt(Date.now());
        capTimer.current = setTimeout(() => {
            if (recorderRef.current?.state === "recording")
                recorderRef.current.stop();
        }, maxRecordingMs);
    }, [deliver, failTake, maxRecordingMs, releaseMic, setProblem, startPreview, transcribe]);
    /** The browser leg, with the silent-recogniser watchdog. */
    const listen = useCallback((Ctor) => {
        setProblem(null);
        cancelledRef.current = false;
        const rec = new Ctor();
        rec.lang = locale();
        // Whole thoughts, not one breath: a take ends when the person presses
        // confirm (or the cap), not at the first pause.
        rec.continuous = true;
        // Interim results are what make the words appear as they are spoken;
        // only the final ones are delivered.
        rec.interimResults = true;
        const current = () => recRef.current === rec;
        const heard = [];
        let started = false;
        let handedOff = false;
        const finish = (next) => {
            if (!current())
                return;
            recRef.current = null;
            if (capTimer.current) {
                clearTimeout(capTimer.current);
                capTimer.current = null;
            }
            setStatus("idle");
            setStartedAt(null);
            setLiveText("");
            if (next)
                setProblem(next);
        };
        const handOff = () => {
            // The recogniser cannot do this here — record instead, and do not make
            // the person rediscover that on the next press.
            handedOff = true;
            rememberDead(rememberKey);
            finish(null);
            try {
                rec.abort();
            }
            catch {
                /* already gone */
            }
            void record();
        };
        rec.onstart = () => {
            started = true;
        };
        rec.onresult = (event) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const r = event.results[i];
                const t = r?.[0]?.transcript ?? "";
                if (r && r.isFinal !== false)
                    heard.push(t);
                else
                    interim += t;
            }
            if (current())
                setLiveText(liveWords(heard, interim));
        };
        rec.onerror = (event) => {
            const why = problemFor(event?.error);
            if (fallbackCanRescue(why) && canRecord() && hasServer && !cancelledRef.current) {
                handOff();
                return;
            }
            finish(why);
        };
        rec.onend = () => {
            if (!current() || handedOff)
                return;
            const said = heard.join(" ");
            finish(null);
            if (!cancelledRef.current)
                deliver(said);
        };
        recRef.current = rec;
        try {
            rec.start();
        }
        catch {
            if (canRecord() && hasServer)
                handOff();
            else
                finish("unavailable");
            return;
        }
        setLiveText("");
        setStatus("listening");
        setStartedAt(Date.now());
        capTimer.current = setTimeout(() => {
            if (current())
                rec.stop();
        }, maxRecordingMs);
        const giveUpAt = Date.now() + PERMISSION_WAIT_MS;
        const watch = () => {
            setTimeout(async () => {
                if (started || !current())
                    return;
                if (Date.now() < giveUpAt && (await awaitingPermission())) {
                    watch();
                    return;
                }
                if (started || !current())
                    return;
                if (canRecord() && hasServer)
                    handOff();
                else
                    finish("unavailable");
            }, START_TIMEOUT_MS);
        };
        watch();
    }, [deliver, hasServer, locale, maxRecordingMs, record, rememberKey]);
    const start = useCallback(() => {
        if (status !== "idle")
            return;
        const Ctor = recogniser();
        const serverFirst = prefer === "server" && canRecord() && hasServer;
        if (Ctor && !serverFirst && !readDead(rememberKey))
            listen(Ctor);
        else if (canRecord() && hasServer)
            void record();
        else if (Ctor)
            listen(Ctor);
        else
            setProblem("unavailable");
    }, [hasServer, listen, prefer, record, rememberKey, status]);
    const stop = useCallback(() => {
        const rec = recRef.current;
        if (rec)
            rec.stop();
        const rc = recorderRef.current;
        if (rc && rc.state !== "inactive")
            rc.stop();
    }, []);
    const cancel = useCallback(() => {
        cancelledRef.current = true;
        const rec = recRef.current;
        recRef.current = null;
        try {
            rec?.abort();
        }
        catch {
            /* already gone */
        }
        const rc = recorderRef.current;
        if (rc && rc.state !== "inactive")
            rc.stop();
        releaseMic();
        setLiveText("");
        setStatus("idle");
        setStartedAt(null);
    }, [releaseMic]);
    // A promise, not fire-and-forget: a composer handed three memos at once
    // transcribes them in order, so the words arrive in the order they were
    // picked. The status is the mic's — one spinner, one meaning.
    const transcribeFile = useCallback(async (audio) => {
        if (!hasServer) {
            setProblem("unavailable");
            return;
        }
        if (audio.size > maxAudioFileBytes) {
            setProblem("fileTooLarge");
            return;
        }
        if (audio.size === 0) {
            setProblem("silence");
            return;
        }
        setProblem(null);
        setStatus("transcribing");
        try {
            deliver(await transcribe(audio));
        }
        catch (e) {
            failTake(audio, e);
        }
        finally {
            setStatus("idle");
        }
    }, [deliver, failTake, hasServer, maxAudioFileBytes, setProblem, transcribe]);
    const retry = useCallback(async () => {
        const audio = failedTake.current;
        if (!audio || status !== "idle")
            return;
        setProblem(null);
        setStatus("transcribing");
        try {
            deliver(await transcribe(audio));
        }
        catch (e) {
            failTake(audio, e);
        }
        finally {
            setStatus("idle");
        }
    }, [deliver, failTake, setProblem, status, transcribe]);
    const toggle = useCallback(() => {
        // A press while the server is answering is ignored: a second take would
        // race the first one's words into the box.
        if (status === "transcribing")
            return;
        if (status === "listening")
            stop();
        else
            start();
    }, [start, status, stop]);
    // A live microphone must not outlive the component that opened it.
    useEffect(() => () => {
        cancelledRef.current = true;
        try {
            recRef.current?.abort();
        }
        catch {
            /* gone */
        }
        try {
            previewRef.current?.abort();
        }
        catch {
            /* gone */
        }
        const rc = recorderRef.current;
        if (rc && rc.state !== "inactive")
            rc.stop();
        streamRef.current?.getTracks().forEach((t) => t.stop());
    }, []);
    return {
        supported,
        status,
        startedAt,
        liveText,
        problem,
        problemDetail,
        canRetry,
        retry,
        clearProblem: () => setProblem(null),
        start,
        stop,
        cancel,
        toggle,
        canTranscribeFile: hasServer,
        transcribeFile,
    };
}
//# sourceMappingURL=use-dictation.js.map