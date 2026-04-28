import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { GenerateLessonButton } from "./generate-lesson-button";

export default async function TopicsPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;

  const [{ data: profile }, { data: topics }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", profileId).single(),
    supabase.from("topics").select("id, title, description").order("created_at"),
  ]);

  if (!profile) {
    return <p className="p-8 text-center">Profile not found.</p>;
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
        {topics?.map((topic) => (
          <div
            key={topic.id}
            className="flex flex-col gap-2 p-6 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all"
          >
            <h2 className="text-lg font-semibold">{topic.title}</h2>
            {topic.description && (
              <p className="text-sm text-gray-500">{topic.description}</p>
            )}
            <GenerateLessonButton topicId={topic.id} profileId={profileId} />
          </div>
        ))}
      </div>
    </main>
  );
}
