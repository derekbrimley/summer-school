"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { QAPanel } from "./qa-panel";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

const PEN_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f97316", "#8b5cf6", "#1a1a1a"];

interface LessonViewerProps {
  lessonId: string;
  profileId: string;
  age: number;
  topicTitle: string;
  status: string;
  lessonText: string; // flat text for TTS (narrative joined)
}

export function LessonViewer({
  lessonId,
  profileId,
  age,
  topicTitle,
  status: initialStatus,
  lessonText,
}: LessonViewerProps) {
  const [status, setStatus] = useState(initialStatus);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [annotating, setAnnotating] = useState(false);
  const [penColor, setPenColor] = useState("#1a1a1a");
  const [penWidth, setPenWidth] = useState(3);
  const [erasing, setErasing] = useState(false);
  const [allStrokes, setAllStrokes] = useState<Record<number, Stroke[]>>({});
  const [showQA, setShowQA] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const currentStroke = useRef<{ x: number; y: number }[]>([]);

  const pdfUrl = `/api/lessons/${lessonId}/pdf`;

  // Load annotations for current page
  useEffect(() => {
    if (status !== "approved" && status !== "viewed") return;
    fetch(`/api/annotations?lessonId=${lessonId}&profileId=${profileId}`)
      .then((r) => r.json())
      .then(({ annotations }) => {
        const byPage: Record<number, Stroke[]> = {};
        for (const a of annotations ?? []) {
          byPage[a.page_number] = a.stroke_data;
        }
        setAllStrokes(byPage);
      });
  }, [lessonId, profileId, status]);

  // Redraw canvas when page changes or strokes update
  const redraw = useCallback(
    (strokes: Stroke[]) => {
      const canvas = canvasRef.current;
      if (!canvas || !pageWidth || !pageHeight) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
    },
    [pageWidth, pageHeight]
  );

  useEffect(() => {
    redraw(allStrokes[currentPage] ?? []);
  }, [currentPage, allStrokes, redraw]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!annotating) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentStroke.current = [getPos(e)];
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!annotating || !drawingRef.current) return;
    const pos = getPos(e);
    currentStroke.current.push(pos);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pts = currentStroke.current;
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = erasing ? "#ffffff" : penColor;
    ctx.lineWidth = erasing ? penWidth * 4 : penWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }

  async function onPointerUp() {
    if (!annotating || !drawingRef.current) return;
    drawingRef.current = false;
    const pts = [...currentStroke.current];
    currentStroke.current = [];
    if (pts.length < 2) return;

    const newStroke: Stroke = {
      points: pts,
      color: erasing ? "#ffffff" : penColor,
      width: erasing ? penWidth * 4 : penWidth,
    };
    const updated = [...(allStrokes[currentPage] ?? []), newStroke];
    setAllStrokes((prev) => ({ ...prev, [currentPage]: updated }));

    await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId,
        profileId,
        pageNumber: currentPage,
        strokeData: updated,
      }),
    });
  }

  function speakPage() {
    window.speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(lessonText);
    utterance.rate = age <= 4 ? 0.85 : 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

  // Auto-speak for Holland (age 4) on approval
  useEffect(() => {
    if (age <= 4 && status === "approved") speakPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function approve() {
    await fetch(`/api/lessons/${lessonId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    setStatus("approved");
  }

  // Parent approval screen
  if (status === "ready") {
    return (
      <div className="flex flex-col items-center gap-6 p-8 max-w-2xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 w-full text-center">
          <p className="text-lg font-semibold text-amber-800 mb-1">Lesson ready for review</p>
          <p className="text-sm text-amber-600">Take a quick look, then approve for {age <= 4 ? "Holland" : "Sylvie"} to begin.</p>
        </div>

        <div className="w-full border rounded-xl overflow-hidden shadow">
          <iframe src={pdfUrl} className="w-full h-[70vh]" title="Lesson preview" />
        </div>

        <div className="flex gap-4">
          <button
            onClick={approve}
            className="bg-green-500 text-white font-semibold px-8 py-3 rounded-2xl hover:bg-green-600 transition-colors text-lg"
          >
            ✓ Looks good — Start!
          </button>
          <button
            onClick={async () => {
              await fetch(`/api/lessons/${lessonId}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "ready" }),
              });
              window.location.href = `/${profileId}/topics`;
            }}
            className="border border-gray-300 text-gray-600 font-medium px-6 py-3 rounded-2xl hover:bg-gray-50 transition-colors"
          >
            ← Back to Topics
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm px-4 py-2 flex items-center gap-3 flex-wrap">
        <a href={`/${profileId}/topics`} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Map
        </a>
        <span className="font-semibold text-gray-800 flex-1 truncate">{topicTitle}</span>

        {/* Annotation toggle */}
        <button
          onClick={() => setAnnotating(!annotating)}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            annotating ? "bg-purple-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          ✏️ Draw
        </button>

        {/* TTS */}
        <button
          onClick={speakPage}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            speaking ? "bg-blue-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          🔊 {speaking ? "Stop" : "Read Aloud"}
        </button>

        {/* Q&A */}
        <button
          onClick={() => setShowQA(true)}
          className="px-3 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ❓ Ask
        </button>
      </div>

      {/* Annotation toolbar (shown when annotating) */}
      {annotating && (
        <div className="bg-purple-50 border-b border-purple-100 px-4 py-2 flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setErasing(false); setPenColor(c); }}
                className={`w-6 h-6 rounded-full border-2 transition-all ${penColor === c && !erasing ? "border-gray-700 scale-110" : "border-white"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <select
            value={penWidth}
            onChange={(e) => setPenWidth(Number(e.target.value))}
            className="text-xs border rounded px-1 py-0.5 bg-white"
          >
            <option value={2}>Fine</option>
            <option value={3}>Medium</option>
            <option value={6}>Thick</option>
          </select>
          <button
            onClick={() => setErasing(!erasing)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${erasing ? "bg-gray-700 text-white" : "border-gray-300 text-gray-600 hover:bg-white"}`}
          >
            Eraser
          </button>
          <button
            onClick={() => {
              setAllStrokes((prev) => ({ ...prev, [currentPage]: [] }));
              const canvas = canvasRef.current;
              if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
            }}
            className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50"
          >
            Clear page
          </button>
        </div>
      )}

      {/* PDF + Canvas */}
      <div className="flex-1 flex flex-col items-center py-6 px-4 bg-gray-100">
        <div ref={containerRef} className="relative shadow-lg" style={{ width: pageWidth || "auto" }}>
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div className="w-64 h-96 bg-white rounded-xl animate-pulse" />}
          >
            <Page
              pageNumber={currentPage}
              width={Math.min(816, typeof window !== "undefined" ? window.innerWidth - 32 : 816)}
              onRenderSuccess={(page) => {
                setPageWidth(page.width);
                setPageHeight(page.height);
              }}
              renderTextLayer={age > 4}
              renderAnnotationLayer={false}
            />
          </Document>

          {/* Annotation canvas overlay */}
          {pageWidth > 0 && pageHeight > 0 && (
            <canvas
              ref={canvasRef}
              width={pageWidth}
              height={pageHeight}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                touchAction: "none",
                cursor: !annotating ? "default" : erasing ? "cell" : "crosshair",
                pointerEvents: annotating ? "auto" : "none",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          )}
        </div>

        {/* Page nav */}
        {numPages > 1 && (
          <div className="flex items-center gap-4 mt-4 bg-white rounded-2xl shadow px-6 py-3">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="text-gray-500 disabled:opacity-30 hover:text-gray-800 text-lg"
            >
              ◀
            </button>
            <span className="text-sm text-gray-600 font-medium">
              Page {currentPage} of {numPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage === numPages}
              className="text-gray-500 disabled:opacity-30 hover:text-gray-800 text-lg"
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {showQA && (
        <QAPanel
          lessonId={lessonId}
          profileId={profileId}
          age={age}
          topicTitle={topicTitle}
          onClose={() => setShowQA(false)}
        />
      )}
    </div>
  );
}
