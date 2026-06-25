"use client";

import { useRef, useState } from "react";
import { Mic, Square, Sparkles, AlertTriangle } from "lucide-react";

// Uses the browser's built-in SpeechRecognition - free, no API key, no
// audio ever leaves the device for transcription. Best supported in
// Chrome/Edge (desktop and Android); Safari/Firefox support is patchy,
// so this degrades to "not available" rather than half-working.
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string }; isFinal: boolean }; length: number } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
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
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  function getRecognition(): SpeechRecognitionLike | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    return Ctor ? new Ctor() : null;
  }

  function startRecording() {
    const recognition = getRecognition();
    if (!recognition) {
      setUnsupported(true);
      return;
    }
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-AU";

    let finalTranscript = transcript;
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript + " ";
        else interim += result[0].transcript;
      }
      setTranscript(finalTranscript + interim);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  if (unsupported) {
    return (
      <div className="card border-2 border-[var(--line)]">
        <p className="font-semibold text-[var(--ink)] mb-1">Voice notes aren&apos;t supported in this browser</p>
        <p className="text-[12.5px] text-[var(--ink-faint)]">Try Chrome on Android, or just upload a drawing instead.</p>
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

      {transcript && (
        <>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={4}
            className="app-field text-[13px] mt-3"
            placeholder="Transcript will appear here as you talk..."
          />
          <button
            onClick={() => onTranscriptReady(transcript)}
            disabled={analyzing || recording}
            className="btn-secondary w-full justify-center mt-2"
          >
            <Sparkles size={15} className="text-[var(--amber-deep)]" />
            {analyzing ? "Generating quote from voice..." : "Generate quote from voice note"}
          </button>
        </>
      )}

      {analysisError && (
        <div className="mt-3 bg-[var(--red-bg)] rounded-lg px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle size={14} className="text-[var(--red)] mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] text-[var(--red)]">{analysisError}</p>
            {usageLimitReached && (
              <a href="/settings" className="text-[12.5px] font-semibold text-[var(--red)] underline">
                Upgrade in Settings →
              </a>
            )}
          </div>
        </div>
      )}

      {analysisResult && (
        <div className={`mt-3 rounded-lg px-3 py-2.5 flex items-start gap-2 ${analysisResult.confidence === "low" ? "bg-[var(--red-bg)]" : "bg-amber-50"}`}>
          <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${analysisResult.confidence === "low" ? "text-[var(--red)]" : "text-amber-600"}`} />
          <div>
            <p className={`text-[13px] font-semibold ${analysisResult.confidence === "low" ? "text-[var(--red)]" : "text-amber-800"}`}>
              Fields pre-filled ({analysisResult.confidence} confidence) — review before saving
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
