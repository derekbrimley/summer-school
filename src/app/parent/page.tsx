import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ParentDashboardClient } from "./parent-dashboard-client";

export default async function ParentPage() {
  const supabase = getSupabaseAdmin() as any;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, age")
    .order("age", { ascending: false });

  return (
    <main className="flex flex-col min-h-screen p-4 gap-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold flex-1">Parent Dashboard</h1>
      </div>
      <ParentDashboardClient profiles={profiles ?? []} />
    </main>
  );
}
