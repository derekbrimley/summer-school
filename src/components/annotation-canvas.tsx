"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface AnnotationCanvasProps {
  width: number;
  height: number;
  pageNumber: number;
  lessonId: string;
  profileId: string;
  initialStrokes?: Stroke[];
  onSave?: (strokes: Stroke[]) => void;
}

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f97316", "#8b5cf6", "#1a1a1a"];

export function AnnotationCanvas({
  width,
  height,
  pageNumber,
  lessonId,
  profileId,
  initialStrokes = [],
  onSave,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes);
  const [activeColor, setActiveColor] = useState("#1a1a1a");
  const [penWidth, setPenWidth] = useState(3);
  const [erasing, setErasing] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const currentStroke = useRef<{ x: number; y: number }[]>([]);
  const saving = useRef(false);

  const redraw = useCallback((strokeList: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokeList) {
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
  }, []);

  useEffect(() => { redraw(strokes); }, [strokes, redraw]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (width / rect.width),
      y: (e.clientY - rect.top) * (height / rect.height),
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setDrawing(true);
    currentStroke.current = [getPos(e)];
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const pos = getPos(e);
    currentStroke.current.push(pos);

    // Live draw the current stroke
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pts = currentStroke.current;
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = erasing ? "#ffffff" : activeColor;
    ctx.lineWidth = erasing ? penWidth * 4 : penWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }

  async function onPointerUp() {
    if (!drawing) return;
    setDrawing(false);
    const pts = [...currentStroke.current];
    currentStroke.current = [];
    if (pts.length < 2) return;

    const newStroke: Stroke = {
      points: pts,
      color: erasing ? "#ffffff" : activeColor,
      width: erasing ? penWidth * 4 : penWidth,
    };
    const updated = [...strokes, newStroke];
    setStrokes(updated);

    if (!saving.current) {
      saving.current = true;
      try {
        await fetch(`/api/annotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, profileId, pageNumber, strokeData: updated }),
        });
      } finally {
        saving.current = false;
      }
    }
    onSave?.(updated);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setErasing(false); setActiveColor(c); }}
              className={`w-6 h-6 rounded-full border-2 transition-all ${activeColor === c && !erasing ? "border-gray-800 scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <select
          value={penWidth}
          onChange={(e) => setPenWidth(Number(e.target.value))}
          className="text-xs border rounded px-1 py-0.5"
        >
          <option value={2}>Fine</option>
          <option value={3}>Medium</option>
          <option value={6}>Thick</option>
        </select>
        <button
          onClick={() => setErasing(!erasing)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${erasing ? "bg-gray-800 text-white" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}
        >
          Eraser
        </button>
        <button
          onClick={() => setStrokes([])}
          className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50"
        >
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", touchAction: "none", cursor: erasing ? "cell" : "crosshair" }}
        className="absolute inset-0"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </div>
  );
}
