"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Mic, Square, FileText, AlertTriangle } from "lucide-react";

// Same Web Speech API approach as VoiceNoteRecorder.tsx - free, on-device,
// no audio ever leaves the browser. Best supported in Chrome/Edge.
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: { [i: number]: { [j: number]: { transcript: string }; isFinal: boolean }; length: number } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

/**
 * JobDescriptionField
 * -------------------
 * A plain text/voice description available on every quote, regardless of
 * trade - "talk to what the tradie is doing" for extra context on the
 * quote itself, and (since this feeds the same site_notes column jobs.ts
 * already copies from quote -> job on acceptance) the record of what was
 * actually agreed once it becomes a job, so the team isn't guessing at
 * scope later.
 *
 * Deliberately NOT the AI-quote-generation flow VoiceNoteRecorder drives
 * (no "generate quote from this", no structured field extraction) - this
 * is just descriptive text, typed or spoken, that goes straight into
 * site_notes as-is.
 */
export default function JobDescriptionField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [speechDetected, setSpeechDetected] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const sessionBaseRef = useRef("");
  const valueRef = useRef(value);
  valueRef.current = value;

  const getRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    return Ctor ? new Ctor() : null;
  }, []);

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.abort(); } catch { /* noop */ }
    };
  }, []);

  function startRecording() {
    setRecError(null);
    setSpeechDetected(false);
    setLiveText("");

    const recognition = getRecognition();
    if (!recognition) { setUnsupported(true); return; }

    // Whatever's already typed/recorded becomes the base this session
    // appends onto, so voice and typing can be freely mixed.
    sessionBaseRef.current = valueRef.current ? valueRef.current + " " : "";
    finalRef.current = sessionBaseRef.current;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-AU";

    recognition.onstart = () => setRecording(true);

    recognition.onresult = (event) => {
      setSpeechDetected(true);
      // Same cumulative-vs-incremental handling as VoiceNoteRecorder -
      // some Android Chrome builds report each "final" result as the
      // full cumulative transcript rather than an independent segment.
      // Detecting and handling both prevents a self-repeating stutter.
      let finalThisSession = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const segment = result[0].transcript.trim();
          if (!segment) continue;
          const acc = finalThisSession.trim();
          if (acc && segment.toLowerCase().startsWith(acc.toLowerCase())) {
            finalThisSession = segment + " ";
          } else {
            finalThisSession += segment + " ";
          }
        } else {
          interim += result[0].transcript;
        }
      }
      finalRef.current = (sessionBaseRef.current + finalThisSession).trim();
      setLiveText([finalRef.current, interim].filter(Boolean).join(" "));
      onChange(finalRef.current);
    };

    recognition.onerror = (event) => {
      switch (event.error) {
        case "not-allowed":
          setRecError("Microphone access denied. Allow it in your browser's address bar.");
          break;
        case "no-speech":
          break;
        case "audio-capture":
          setRecError("No microphone found.");
          break;
        case "network":
          setRecError("Network error during speech recognition.");
          break;
        case "aborted":
          break;
        default:
          setRecError(`Speech recognition error: ${event.error}. Try Chrome or Edge.`);
      }
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
      onChange(finalRef.current.trim());
      setLiveText("");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setRecError("Could not start microphone. Try refreshing the page.");
      setRecording(false);
    }
  }

  function stopRecording() {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setRecording(false);
    onChange(finalRef.current.trim());
    setLiveText("");
  }

  return (
    <div className="card">
      <div className="flex items-start gap-3 mb-3">
        <FileText size={16} className="text-[var(--amber-deep)] mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-[var(--ink)]">Job description</p>
          <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">
            Talk through what you&apos;re doing and why - extra context on the quote, and the record of what was agreed once this becomes a job. Type it or talk it out.
          </p>
        </div>
      </div>

      <textarea
        value={recording ? liveText : value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={recording}
        rows={4}
        placeholder="e.g. Client wants power run to the new shed. Existing switchboard has capacity, no upgrade needed. Access via side gate."
        className="app-field text-[13px]"
      />

      <div className="flex items-center justify-between mt-2">
        {recording && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-[11px] font-bold text-red-500 uppercase tracking-wide">
              {speechDetected ? "Hearing you..." : "Listening..."}
            </span>
          </div>
        )}
        <div className="ml-auto">
          {!recording ? (
            !unsupported && (
              <button onClick={startRecording} className="btn-secondary text-[12.5px] py-2 px-3">
                <Mic size={13} className="text-[var(--amber-deep)]" /> {value ? "Add more by voice" : "Record instead"}
              </button>
            )
          ) : (
            <button onClick={stopRecording} className="bg-red-600 text-white rounded-xl px-3 py-2 text-[12.5px] font-semibold flex items-center gap-1.5 animate-pulse">
              <Square size={11} /> Stop
            </button>
          )}
        </div>
      </div>

      {unsupported && (
        <p className="text-[11px] text-[var(--ink-faint)] mt-2">
          Voice input isn&apos;t supported in this browser (try Chrome or Edge) - typing still works fine above.
        </p>
      )}
      {recError && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={13} className="text-red-600 mt-0.5 shrink-0" />
          <p className="text-[12px] text-red-700">{recError}</p>
        </div>
      )}
    </div>
  );
}
