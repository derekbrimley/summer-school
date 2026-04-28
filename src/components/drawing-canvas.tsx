"use client";

import { useRef, useCallback, useState } from "react";
import { Tldraw, Editor } from "tldraw";
import "tldraw/tldraw.css";

interface DrawingCanvasProps {
  profileId: string;
  topicId: string;
  lessonId: string;
  prompt: string;
  age: number;
  onSaved: () => void;
  onClose: () => void;
}

export function DrawingCanvas({
  profileId,
  topicId,
  lessonId,
  prompt,
  age,
  onSaved,
  onClose,
}: DrawingCanvasProps) {
  const editorRef = useRef<Editor | null>(null);
  const [saving, setSaving] = useState(false);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  async function handleSave() {
    const editor = editorRef.current;
    if (!editor) return;

    setSaving(true);
    try {
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) {
        onClose();
        return;
      }

      const { blob } = await editor.toImage([...shapeIds], {
        format: "png",
        background: true,
        padding: 16,
      });

      const formData = new FormData();
      formData.append("file", blob, "drawing.png");
      formData.append("profileId", profileId);
      formData.append("topicId", topicId);
      formData.append("lessonId", lessonId);
      formData.append("prompt", prompt);

      const res = await fetch("/api/drawings", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-green-50 border-b border-green-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-sm font-medium"
        >
          &larr; Back to Lesson
        </button>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-500 text-white font-semibold px-6 py-2 rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save to Wonder Book"}
        </button>
      </div>

      {/* Prompt */}
      <div className="bg-green-50 px-4 pb-3">
        <p className={`text-green-800 font-medium ${age <= 4 ? "text-lg" : "text-sm"}`}>
          {prompt}
        </p>
      </div>

      {/* tldraw canvas */}
      <div className="flex-1">
        <Tldraw onMount={handleMount} />
      </div>
    </div>
  );
}
