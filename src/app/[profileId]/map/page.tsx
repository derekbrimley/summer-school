import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CuriosityMap } from "@/components/curiosity-map";

export default async function MapPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const supabase = getSupabaseAdmin() as any;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, age")
    .eq("id", profileId)
    .single();

  if (!profile) {
    return <p className="p-8 text-center text-gray-500">Profile not found.</p>;
  }

  return (
    <main className="flex flex-col min-h-screen p-4 gap-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold flex-1">
          {profile.name}&apos;s Curiosity Map
        </h1>
        <Link
          href={`/${profileId}/wonder-book`}
          className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-700 text-xs font-medium hover:bg-purple-200 transition-colors"
        >
          📖 Wonder Book
        </Link>
        <Link
          href={`/${profileId}/topics`}
          className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors"
        >
          All Topics
        </Link>
      </div>

      <p className="text-sm text-gray-500">
        Tap any topic to explore it. Bright nodes are ones you&apos;ve already visited!
      </p>

      <CuriosityMap
        profileId={profileId}
        profileName={profile.name}
        age={profile.age}
      />
    </main>
  );
}
