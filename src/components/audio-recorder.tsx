"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface AudioRecorderProps {
  profileId: string;
  lessonId: string;
  age: number;
  onSaved: () => void;
  onClose: () => void;
}

export function AudioRecorder({
  profileId,
  lessonId,
  age,
  onSaved,
  onClose,
}: AudioRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "review" | "saving">("idle");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  useEffect(() => cleanup, [cleanup]);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      chunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        setState("review");
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.current = recorder;
      recorder.start();
      setDuration(0);
      setState("recording");

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      setError("Could not access the microphone. Please check permissions.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorder.current?.stop();
  }

  function tryAgain() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    setState("idle");
  }

  async function save() {
    if (!chunks.current.length) return;
    setState("saving");

    const blob = new Blob(chunks.current, { type: "audio/webm" });
    const formData = new FormData();
    formData.append("file", blob, "reflection.webm");
    formData.append("profileId", profileId);
    formData.append("lessonId", lessonId);
    formData.append("durationSec", String(duration));

    const res = await fetch("/api/reflections", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      onSaved();
    } else {
      setError("Failed to save. Please try again.");
      setState("review");
    }
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-8 flex flex-col items-center gap-6">
        <div className="flex w-full justify-between items-start">
          <h2 className={`font-bold text-gray-800 ${age <= 4 ? "text-2xl" : "text-xl"}`}>
            Tell Me About It!
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            &times;
          </button>
        </div>

        <p className={`text-gray-500 text-center ${age <= 4 ? "text-lg" : "text-sm"}`}>
          {age <= 4
            ? "Press the big button and tell me what you learned!"
            : "What did you learn or make? Press the button and tell me!"}
        </p>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        {/* Record button */}
        <button
          onClick={state === "recording" ? stopRecording : startRecording}
          disabled={state === "review" || state === "saving"}
          className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl transition-all ${
            state === "recording"
              ? "bg-red-500 text-white animate-pulse scale-110"
              : "bg-red-100 text-red-500 hover:bg-red-200"
          } disabled:opacity-30`}
        >
          {state === "recording" ? "■" : "🎙️"}
        </button>

        {/* Duration */}
        {(state === "recording" || state === "review") && (
          <p className="text-2xl font-mono text-gray-700">{formatTime(duration)}</p>
        )}

        {/* Recording indicator */}
        {state === "recording" && (
          <div className="flex gap-1 items-end h-8">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-red-400 rounded-full animate-bounce"
                style={{
                  height: `${12 + Math.random() * 20}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: "0.6s",
                }}
              />
            ))}
          </div>
        )}

        {/* Audio playback */}
        {state === "review" && audioUrl && (
          <audio controls src={audioUrl} className="w-full" />
        )}

        {/* Action buttons */}
        <div className="flex gap-3 w-full">
          {state === "review" && (
            <>
              <button
                onClick={save}
                className="flex-1 bg-green-500 text-white font-semibold py-3 rounded-xl hover:bg-green-600 transition-colors"
              >
                Save
              </button>
              <button
                onClick={tryAgain}
                className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Try Again
              </button>
            </>
          )}
          {state === "saving" && (
            <div className="flex-1 text-center py-3 text-gray-400 font-medium">
              Saving...
            </div>
          )}
          {(state === "idle" || state === "recording") && (
            <button
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
