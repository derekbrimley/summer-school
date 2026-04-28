"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateLessonButton({
  topicId,
  profileId,
  label,
}: {
  topicId: string;
  profileId: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/lessons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, profileId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate lesson");
      }

      router.push(`/${profileId}/lessons/${data.lessonId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-auto pt-2">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-2 px-4 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Generating..." : label ?? "Start Lesson"}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
