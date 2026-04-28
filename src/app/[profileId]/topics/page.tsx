import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { GenerateLessonButton } from "./generate-lesson-button";

export default async function TopicsPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;

  const [{ data: profile }, { data: topics }, { data: lessons }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", profileId).single(),
    supabase.from("topics").select("id, title, description").order("created_at"),
    supabase
      .from("lessons")
      .select("id, topic_id, status, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false }),
  ]);

  if (!profile) {
    return <p className="p-8 text-center">Profile not found.</p>;
  }

  // Map topic_id → most recent lesson for that topic
  const lessonByTopic = new Map<string, { id: string; status: string }>();
  for (const lesson of lessons ?? []) {
    if (!lessonByTopic.has(lesson.topic_id)) {
      lessonByTopic.set(lesson.topic_id, { id: lesson.id, status: lesson.status });
    }
  }

  return (
    <main className="flex flex-col items-center min-h-screen p-8 gap-8">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-gray-400 hover:text-gray-600">
          &larr; Back
        </Link>
        <h1 className="text-3xl font-bold">
          {profile.name}&apos;s Topics
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full">
        {topics?.map((topic) => {
          const existing = lessonByTopic.get(topic.id);
          return (
            <div
              key={topic.id}
              className="flex flex-col gap-2 p-6 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all"
            >
              <h2 className="text-lg font-semibold">{topic.title}</h2>
              {topic.description && (
                <p className="text-sm text-gray-500">{topic.description}</p>
              )}
              {existing ? (
                <div className="mt-auto pt-2 flex flex-col gap-2">
                  <Link
                    href={`/${profileId}/lessons/${existing.id}`}
                    className="w-full py-2 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors text-center"
                  >
                    Continue Lesson
                  </Link>
                  <GenerateLessonButton topicId={topic.id} profileId={profileId} label="Generate New" />
                </div>
              ) : (
                <GenerateLessonButton topicId={topic.id} profileId={profileId} />
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
