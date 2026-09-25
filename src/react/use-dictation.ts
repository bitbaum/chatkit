"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  MAX_RECORDING_MS,
  PERMISSION_WAIT_MS,
  RECORDING_MIME_CANDIDATES,
  START_TIMEOUT_MS,
  deadRecogniserStillTrusted,
  fallbackCanRescue,
  problemFor,
  problemForRecording,
  type DictationPreference,
  type DictationProblem,
} from "../dictation.js";

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{ isFinal?: boolean } & ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => RecognitionLike;

function recogniser(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function canRecord(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

const noSubscribe = () => () => {};

export type DictationStatus = "idle" | "listening" | "transcribing";

export type UseDictationOptions = {
  /** Receives what was said, once, when the take ends. */
  onText: (text: string) => void;
  /** BCP-47 language for the browser recogniser. Defaults to the page's
   *  `<html lang>`, then the browser's. The server leg receives its first part
   *  as `locale` and may detect the language itself. */
  lang?: string;
  /** Which path first. Default `browser` (free, instant); `server` for one
   *  model everywhere. Each falls back to the other when it cannot work. */
  prefer?: DictationPreference;
  /** Server leg: POST multipart `{ audio, locale }` → `{ text }`. */
  transcribeUrl?: string;
  /** Or bring your own server leg (a widget token, a different body). */
  transcribe?: (audio: Blob, locale: string) => Promise<string>;
  maxRecordingMs?: number;
  /** Where a dead recogniser is remembered (localStorage). `null` to never
   *  store anything on the device. */
  rememberKey?: string | null;
};

export type DictationController = {
  /** False only when neither path can work here — the mic is then hidden. */
  supported: boolean;
  status: DictationStatus;
  /** When the current take began (ms epoch), for the timer. */
  startedAt: number | null;
  problem: DictationProblem | null;
  clearProblem: () => void;
  start: () => void;
  /** End the take and deliver what was said. */
  stop: () => void;
  /** End the take and throw it away. */
  cancel: () => void;
  toggle: () => void;
};

const DEFAULT_REMEMBER_KEY = "chatkit.dictation.recogniser-dead.v1";

function readDead(key: string | null): boolean {
  if (!key) return false;
  try {
    const raw = window.localStorage.getItem(key);
    return deadRecogniserStillTrusted(raw === null ? null : Number(raw));
  } catch {
    return false;
  }
}

function rememberDead(key: string | null): void {
  if (!key) return;
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    /* private mode — the person simply waits again next time */
  }
}

async function awaitingPermission(): Promise<boolean> {
  try {
    const s = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return s.state === "prompt";
  } catch {
    return false;
  }
}

async function postAudio(url: string, audio: Blob, locale: string): Promise<string> {
  const body = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  body.append("audio", new File([audio], `voice.${ext}`, { type: audio.type || "audio/webm" }));
  body.append("locale", locale);
  const res = await fetch(url, { method: "POST", body });
  if (!res.ok) throw new Error(`transcription ${res.status}`);
  const data = (await res.json().catch(() => ({}))) as { text?: unknown };
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
export function useDictation(opts: UseDictationOptions): DictationController {
  const { prefer = "browser", maxRecordingMs = MAX_RECORDING_MS } = opts;
  const rememberKey = opts.rememberKey === undefined ? DEFAULT_REMEMBER_KEY : opts.rememberKey;
  const hasServer = Boolean(opts.transcribe || opts.transcribeUrl);

  const supported = useSyncExternalStore(
    noSubscribe,
    () => Boolean(recogniser()) || (hasServer && canRecord()),
    () => false,
  );

  const [status, setStatus] = useState<DictationStatus>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [problem, setProblem] = useState<DictationProblem | null>(null);

  // Latest options in refs, assigned in an effect (never during render), so a
  // take that outlives a re-render calls the current callbacks.
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const recRef = useRef<RecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locale = useCallback(() => {
    const l =
      optsRef.current.lang ??
      (typeof document !== "undefined" ? document.documentElement.lang : "") ??
      "";
    return l || (typeof navigator !== "undefined" ? navigator.language : "en") || "en";
  }, []);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (capTimer.current) {
      clearTimeout(capTimer.current);
      capTimer.current = null;
    }
  }, []);

  const deliver = useCallback((said: string) => {
    const t = said.trim();
    if (t) optsRef.current.onText(t);
    else setProblem("silence");
  }, []);

  const transcribe = useCallback(
    async (audio: Blob) => {
      const o = optsRef.current;
      const lang = locale().split("-")[0] ?? "en";
      if (o.transcribe) return o.transcribe(audio, lang);
      if (o.transcribeUrl) return postAudio(o.transcribeUrl, audio, lang);
      throw new Error("no server leg");
    },
    [locale],
  );

  /** The server leg: record, then transcribe. */
  const record = useCallback(async () => {
    if (!canRecord() || !(optsRef.current.transcribe || optsRef.current.transcribeUrl)) {
      setProblem("unavailable");
      setStatus("idle");
      return;
    }
    setProblem(null);
    cancelledRef.current = false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setProblem(problemForRecording(e));
      setStatus("idle");
      return;
    }
    streamRef.current = stream;
    let rec: MediaRecorder;
    try {
      const mime = RECORDING_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported?.(m));
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (e) {
      releaseMic();
      setProblem(problemForRecording(e));
      setStatus("idle");
      return;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = async () => {
      releaseMic();
      recorderRef.current = null;
      setStartedAt(null);
      if (cancelledRef.current) {
        setStatus("idle");
        return;
      }
      const audio = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (audio.size === 0) {
        setProblem("silence");
        setStatus("idle");
        return;
      }
      setStatus("transcribing");
      try {
        deliver(await transcribe(audio));
      } catch {
        setProblem("unavailable");
      } finally {
        setStatus("idle");
      }
    };
    recorderRef.current = rec;
    rec.start();
    setStatus("listening");
    setStartedAt(Date.now());
    capTimer.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, maxRecordingMs);
  }, [deliver, maxRecordingMs, releaseMic, transcribe]);

  /** The browser leg, with the silent-recogniser watchdog. */
  const listen = useCallback(
    (Ctor: RecognitionCtor) => {
      setProblem(null);
      cancelledRef.current = false;
      const rec = new Ctor();
      rec.lang = locale();
      // Whole thoughts, not one breath: a take ends when the person presses
      // confirm (or the cap), not at the first pause.
      rec.continuous = true;
      rec.interimResults = false;
      const current = () => recRef.current === rec;
      const heard: string[] = [];
      let started = false;
      let handedOff = false;

      const finish = (next: DictationProblem | null) => {
        if (!current()) return;
        recRef.current = null;
        if (capTimer.current) {
          clearTimeout(capTimer.current);
          capTimer.current = null;
        }
        setStatus("idle");
        setStartedAt(null);
        if (next) setProblem(next);
      };

      const handOff = () => {
        // The recogniser cannot do this here — record instead, and do not make
        // the person rediscover that on the next press.
        handedOff = true;
        rememberDead(rememberKey);
        finish(null);
        try {
          rec.abort();
        } catch {
          /* already gone */
        }
        void record();
      };

      rec.onstart = () => {
        started = true;
      };
      rec.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r && r.isFinal !== false) heard.push(r[0]?.transcript ?? "");
        }
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
        if (!current() || handedOff) return;
        const said = heard.join(" ");
        finish(null);
        if (!cancelledRef.current) deliver(said);
      };

      recRef.current = rec;
      try {
        rec.start();
      } catch {
        if (canRecord() && hasServer) handOff();
        else finish("unavailable");
        return;
      }
      setStatus("listening");
      setStartedAt(Date.now());
      capTimer.current = setTimeout(() => {
        if (current()) rec.stop();
      }, maxRecordingMs);

      const giveUpAt = Date.now() + PERMISSION_WAIT_MS;
      const watch = () => {
        setTimeout(async () => {
          if (started || !current()) return;
          if (Date.now() < giveUpAt && (await awaitingPermission())) {
            watch();
            return;
          }
          if (started || !current()) return;
          if (canRecord() && hasServer) handOff();
          else finish("unavailable");
        }, START_TIMEOUT_MS);
      };
      watch();
    },
    [deliver, hasServer, locale, maxRecordingMs, record, rememberKey],
  );

  const start = useCallback(() => {
    if (status !== "idle") return;
    const Ctor = recogniser();
    const serverFirst = prefer === "server" && canRecord() && hasServer;
    if (Ctor && !serverFirst && !readDead(rememberKey)) listen(Ctor);
    else if (canRecord() && hasServer) void record();
    else if (Ctor) listen(Ctor);
    else setProblem("unavailable");
  }, [hasServer, listen, prefer, record, rememberKey, status]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec) rec.stop();
    const rc = recorderRef.current;
    if (rc && rc.state !== "inactive") rc.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.abort();
    } catch {
      /* already gone */
    }
    const rc = recorderRef.current;
    if (rc && rc.state !== "inactive") rc.stop();
    releaseMic();
    setStatus("idle");
    setStartedAt(null);
  }, [releaseMic]);

  const toggle = useCallback(() => {
    // A press while the server is answering is ignored: a second take would
    // race the first one's words into the box.
    if (status === "transcribing") return;
    if (status === "listening") stop();
    else start();
  }, [start, status, stop]);

  // A live microphone must not outlive the component that opened it.
  useEffect(
    () => () => {
      cancelledRef.current = true;
      try {
        recRef.current?.abort();
      } catch {
        /* gone */
      }
      const rc = recorderRef.current;
      if (rc && rc.state !== "inactive") rc.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return {
    supported,
    status,
    startedAt,
    problem,
    clearProblem: () => setProblem(null),
    start,
    stop,
    cancel,
    toggle,
  };
}
