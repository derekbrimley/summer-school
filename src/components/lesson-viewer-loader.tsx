"use client";

import dynamic from "next/dynamic";

const LessonViewer = dynamic(
  () => import("@/components/lesson-viewer").then((m) => m.LessonViewer),
  {
    ssr: false,
    loading: () => (
      <div className="p-8 text-center text-gray-400">Loading lesson...</div>
    ),
  }
);

export function LessonViewerLoader(props: React.ComponentProps<typeof LessonViewer>) {
  return <LessonViewer {...props} />;
}
