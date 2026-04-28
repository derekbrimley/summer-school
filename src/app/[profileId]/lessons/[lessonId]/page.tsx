import { supabase } from "@/lib/supabase";
import { LessonJson } from "@/lib/types";
import { LessonViewer } from "@/components/lesson-viewer";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ profileId: string; lessonId: string }>;
}) {
  const { profileId, lessonId } = await params;

  const [{ data: lesson }, { data: profile }] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, status, lesson_json, topic_id")
      .eq("id", lessonId)
      .single(),
    supabase.from("profiles").select("name, age").eq("id", profileId).single(),
  ]);

  if (!lesson || !lesson.lesson_json || !profile) {
    return <p className="p-8 text-center text-gray-500">Lesson not found.</p>;
  }

  const { data: topic } = await supabase
    .from("topics")
    .select("title")
    .eq("id", lesson.topic_id)
    .single();

  const content = lesson.lesson_json as LessonJson;

  // Flat text for TTS: title + narrative bodies
  const lessonText = [
    content.title,
    content.subtitle,
    ...content.narrative.map((s) => `${s.heading}. ${s.body}`),
    "Did you know?",
    ...content.did_you_know,
    "Wonder questions:",
    ...content.wonder_questions,
  ].join(" ");

  return (
    <LessonViewer
      lessonId={lessonId}
      profileId={profileId}
      age={profile.age}
      topicTitle={topic?.title ?? content.title}
      status={lesson.status}
      lessonText={lessonText}
    />
  );
}
