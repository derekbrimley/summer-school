import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, age")
    .order("age", { ascending: false });

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-12 p-8">
      <h1 className="text-4xl font-bold tracking-tight">WonderPath</h1>

      <div className="flex gap-8">
        {profiles?.map((profile) => (
          <Link
            key={profile.id}
            href={`/${profile.id}/topics`}
            className="flex flex-col items-center justify-center w-48 h-48 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 border-2 border-purple-200 hover:border-purple-400 hover:shadow-lg transition-all text-center gap-2"
          >
            <span className="text-5xl">
              {profile.name === "Sylvie" ? "🦋" : "🌻"}
            </span>
            <span className="text-2xl font-semibold">{profile.name}</span>
            <span className="text-sm text-gray-500">Age {profile.age}</span>
          </Link>
        ))}
      </div>

      <Link
        href="/parent"
        className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        Parent Dashboard
      </Link>
    </main>
  );
}
