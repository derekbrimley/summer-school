import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { WonderBookEntry } from "@/lib/types";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const url = new URL(req.url);
  const profileId = url.searchParams.get("profileId");
  const family = url.searchParams.get("family") === "true";

  if (!profileId && !family) {
    return NextResponse.json(
      { error: "profileId or family=true is required" },
      { status: 400 }
    );
  }

  const [{ data: drawings }, { data: reflections }, { data: photos }] =
    await Promise.all([
      profileId && !family
        ? supabase
            .from("drawings")
            .select("*")
            .eq("profile_id", profileId)
            .order("created_at", { ascending: false })
        : supabase
            .from("drawings")
            .select("*")
            .order("created_at", { ascending: false }),
      profileId && !family
        ? supabase
            .from("reflections")
            .select("*")
            .eq("profile_id", profileId)
            .order("created_at", { ascending: false })
        : supabase
            .from("reflections")
            .select("*")
            .order("created_at", { ascending: false }),
      profileId && !family
        ? supabase
            .from("photos")
            .select("*")
            .eq("profile_id", profileId)
            .order("created_at", { ascending: false })
        : supabase
            .from("photos")
            .select("*")
            .order("created_at", { ascending: false }),
    ]);

  const entries: WonderBookEntry[] = [
    ...(drawings ?? []).map((d) => ({ type: "drawing" as const, data: d })),
    ...(reflections ?? []).map((r) => ({
      type: "reflection" as const,
      data: r,
    })),
    ...(photos ?? []).map((p) => ({ type: "photo" as const, data: p })),
  ];

  entries.sort(
    (a, b) =>
      new Date(b.data.created_at).getTime() -
      new Date(a.data.created_at).getTime()
  );

  return NextResponse.json({ entries });
}
