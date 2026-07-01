"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Mic, Square, Sparkles, AlertTriangle, Volume2 } from "lucide-react";

// Uses the browser's built-in SpeechRecognition - free, no API key, no
// audio ever leaves the device for transcription. Best supported in
// Chrome/Edge (desktop and Android); Safari/Firefox support is patchy,
// so this degrades to "not available" rather than half-working.
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

export default function VoiceNoteRecorder({
  onTranscriptReady,
  analyzing,
  analysisError,
  analysisResult,
  usageLimitReached,
}: {
  onTranscriptReady: (transcript: string) => void;
  analyzing: boolean;
  analysisError: string | null;
  analysisResult: { confidence: string; notes: string } | null;
  usageLimitReached: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [liveText, setLiveText] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [speechDetected, setSpeechDetected] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");

  const getRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    return Ctor ? new Ctor() : null;
  }, []);

  // Cleanup on unmount
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
    if (!recognition) {
      setUnsupported(true);
      return;
    }

    // If restarting, keep previous transcript
    finalRef.current = transcript;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-AU";

    recognition.onstart = () => {
      setRecording(true);
    };

    recognition.onresult = (event) => {
      setSpeechDetected(true);
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalRef.current += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }
      setLiveText(finalRef.current + interim);
    };

    recognition.onerror = (event) => {
      switch (event.error) {
        case "not-allowed":
          setRecError("Microphone access denied. Click the 🔒 icon in your browser's address bar and allow microphone access.");
          break;
        case "no-speech":
          // Don't show error for no-speech, just stop gracefully
          break;
        case "audio-capture":
          setRecError("No microphone found. Make sure a mic is connected and enabled.");
          break;
        case "network":
          setRecError("Network error during speech recognition. Check your connection and try again.");
          break;
        case "aborted":
          // Intentional - ignore
          break;
        default:
          setRecError(`Speech recognition error: ${event.error}. Try Chrome or Edge browser.`);
      }
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
      // Persist whatever we captured
      setTranscript(finalRef.current.trim());
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
    setTranscript(finalRef.current.trim());
    setLiveText("");
  }

  if (unsupported) {
    return (
      <div className="card border-2 border-[var(--line)]">
        <p className="font-semibold text-[var(--ink)] mb-1">Voice notes aren&apos;t supported in this browser</p>
        <p className="text-[12.5px] text-[var(--ink-faint)]">Try Chrome or Edge on desktop/Android. Safari and Firefox don&apos;t support speech recognition yet.</p>
      </div>
    );
  }

  return (
    <div className="card border-2 border-[var(--amber-light)]">
      <div className="flex items-start gap-3 mb-3">
        <Mic size={18} className="text-[var(--amber-deep)] mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-[var(--ink)]">Voice note</p>
          <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">
            Walk the site and describe the job out loud. AI turns it into a draft quote you review before saving.
          </p>
        </div>
      </div>

      {/* Recording button */}
      {!recording ? (
        <button onClick={startRecording} className="btn-secondary w-full justify-center">
          <Mic size={15} className="text-[var(--amber-deep)]" />
          {transcript ? "Record more" : "Start recording"}
        </button>
      ) : (
        <button onClick={stopRecording} className="w-full bg-red-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 animate-pulse">
          <Square size={14} />
          Stop recording
        </button>
      )}

      {/* Live transcript area - shows while recording */}
      {recording && (
        <div className="mt-3 bg-white border border-[var(--amber)] rounded-xl p-4 min-h-[80px]">
          {/* Status indicator */}
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-[12px] font-bold text-red-500 uppercase tracking-wide">
              {speechDetected ? "Hearing you..." : "Listening... speak now"}
            </span>
            {!speechDetected && (
              <span className="text-[11px] text-[var(--ink-faint)] ml-auto">Waiting for speech</span>
            )}
          </div>

          {/* Live text stream */}
          <p className="text-[14px] text-[var(--ink)] leading-relaxed min-h-[1.5em]">
            {liveText || (
              <span className="text-[var(--ink-faint)] italic">Your words will appear here as you speak...</span>
            )}
            {speechDetected && <span className="inline-block w-[2px] h-[1.1em] bg-[var(--amber)] ml-0.5 animate-pulse align-middle" />}
          </p>
        </div>
      )}

      {/* Recording errors */}
      {recError && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
          <p className="text-[13px] text-red-700">{recError}</p>
        </div>
      )}

      {/* Final transcript (editable) - shown after recording stops */}
      {!recording && transcript && (
        <>
          {/* Label */}
          <div className="flex items-center gap-2 mt-3 mb-1.5">
            <Volume2 size={13} className="text-[var(--ink-faint)]" />
            <span className="text-[11px] font-bold text-[var(--ink-faint)] uppercase tracking-wide">Transcript</span>
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={4}
            className="app-field text-[13px]"
            placeholder="Transcript will appear here..."
          />
          <button
            onClick={() => onTranscriptReady(transcript)}
            disabled={analyzing || !transcript.trim()}
            className="btn-secondary w-full justify-center mt-2"
          >
            <Sparkles size={15} className="text-[var(--amber-deep)]" />
            {analyzing ? "Generating quote from voice..." : "Generate quote from voice note"}
          </button>
        </>
      )}

      {/* Analysis error */}
      {analysisError && (
        <div className="mt-3 bg-[var(--red-bg)] rounded-lg px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle size={14} className="text-[var(--red)] mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] text-[var(--red)]">{analysisError}</p>
            {usageLimitReached && (
              <Link href="/settings" className="text-[12.5px] font-semibold text-[var(--red)] underline">
                Upgrade in Settings →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Analysis result */}
      {analysisResult && (
        <div className={`mt-3 rounded-lg px-3 py-2.5 flex items-start gap-2 ${analysisResult.confidence === "low" ? "bg-[var(--red-bg)]" : "bg-amber-50"}`}>
          <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${analysisResult.confidence === "low" ? "text-[var(--red)]" : "text-amber-600"}`} />
          <div>
            <p className={`text-[13px] font-semibold ${analysisResult.confidence === "low" ? "text-[var(--red)]" : "text-amber-800"}`}>
              Fields pre-filled ({analysisResult.confidence} confidence) - review before saving
            </p>
            {analysisResult.notes && (
              <p className={`text-[12.5px] mt-1 ${analysisResult.confidence === "low" ? "text-red-500" : "text-amber-700"}`}>{analysisResult.notes}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
