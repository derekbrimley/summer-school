import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { topicId } = await params;
  const { title, description, guidance_notes, reference_material } = await request.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any;

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title?.trim() || null;
  if (description !== undefined) updates.description = description?.trim() || null;
  if (guidance_notes !== undefined) updates.guidance_notes = guidance_notes?.trim() || null;
  if (reference_material !== undefined) updates.reference_material = reference_material?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  const { topicId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any;

  // Check if any lessons exist for this topic — if so, block deletion
  const { count } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("topic_id", topicId);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "This topic has lessons and can't be deleted. You can unapprove it instead to hide it from the kids." },
      { status: 409 }
    );
  }

  // Clean up referencing rows in dependency order
  await supabase.from("drawings").delete().eq("topic_id", topicId);
  await supabase.from("photos").delete().eq("topic_id", topicId);
  await supabase.from("explorations").delete().eq("topic_id", topicId);
  await supabase.from("topic_connections").delete().or(`from_topic.eq.${topicId},to_topic.eq.${topicId}`);
  // Clear parent_topic references from child topics
  await supabase.from("topics").update({ parent_topic: null }).eq("parent_topic", topicId);

  const { error } = await supabase.from("topics").delete().eq("id", topicId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
