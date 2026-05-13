import { getSupabaseAdmin } from "@/lib/supabase";
import { WonderBookGallery } from "@/components/wonder-book-gallery";

export default async function WonderBookPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const supabase = getSupabaseAdmin() as any;

  const [{ data: profile }, { data: profiles }, { data: topics }] =
    await Promise.all([
      supabase.from("profiles").select("name, age").eq("id", profileId).single(),
      supabase.from("profiles").select("id, name").order("age", { ascending: false }),
      supabase.from("topics").select("id, title").order("title"),
    ]);

  if (!profile) {
    return <p className="p-8 text-center text-gray-500">Profile not found.</p>;
  }

  return (
    <WonderBookGallery
      profileId={profileId}
      profileName={profile.name}
      age={profile.age}
      profiles={profiles ?? []}
      topics={topics ?? []}
    />
  );
}
