import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET — list unapproved AI-suggested topics
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any;

  const { data, error } = await supabase
    .from("topics")
    .select("id, title, description, parent_topic, source, created_at")
    .eq("approved", false)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with parent topic title for context
  const parentIds = [...new Set((data ?? []).map((t: { parent_topic: string | null }) => t.parent_topic).filter(Boolean))];
  let parentTitles: Record<string, string> = {};
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from("topics")
      .select("id, title")
      .in("id", parentIds);
    parentTitles = Object.fromEntries((parents ?? []).map((p: { id: string; title: string }) => [p.id, p.title]));
  }

  const suggestions = (data ?? []).map((t: { id: string; title: string; description: string | null; parent_topic: string | null; source: string; created_at: string }) => ({
    ...t,
    parent_topic_title: t.parent_topic ? parentTitles[t.parent_topic] ?? null : null,
  }));

  return NextResponse.json({ suggestions });
}

// POST — approve, dismiss, or edit a suggestion
export async function POST(request: NextRequest) {
  const { action, topicId, title, description, guidance_notes, reference_material } = await request.json();

  if (!topicId || !action) {
    return NextResponse.json({ error: "topicId and action are required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any;

  if (action === "dismiss") {
    const { error } = await supabase.from("topics").delete().eq("id", topicId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Also clean up any topic_connections referencing this topic
    await supabase.from("topic_connections").delete().or(`from_topic.eq.${topicId},to_topic.eq.${topicId}`);
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    const updates: Record<string, unknown> = { approved: true };
    if (title?.trim()) updates.title = title.trim();
    if (description?.trim()) updates.description = description.trim();
    if (guidance_notes !== undefined) updates.guidance_notes = guidance_notes?.trim() || null;
    if (reference_material !== undefined) updates.reference_material = reference_material?.trim() || null;

    const { data, error } = await supabase
      .from("topics")
      .update(updates)
      .eq("id", topicId)
      .select("id, title, description, guidance_notes, reference_material")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ topic: data });
  }

  return NextResponse.json({ error: "Invalid action. Use 'approve' or 'dismiss'." }, { status: 400 });
}
