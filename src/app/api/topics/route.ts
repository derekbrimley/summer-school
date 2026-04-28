import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { title, description, profileId, source } = await request.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  type TopicRow = { id: string; title: string; description: string | null; source: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: topicRaw, error } = await (supabase as any)
    .from("topics")
    .insert({
      title: title.trim(),
      description: description?.trim() ?? null,
      source: source ?? "parent_added",
    })
    .select("id, title, description, source")
    .single();

  const topic = topicRaw as TopicRow | null;

  if (error || !topic) {
    console.error("Supabase insert error:", error);
    return NextResponse.json({ error: "Failed to create topic", detail: error?.message }, { status: 500 });
  }

  // If profileId provided, also add to that child's curiosity map connections (no-op for now;
  // the topic appears on all maps until we scope topics per profile in v2)
  void profileId;

  return NextResponse.json({ topic });
}
