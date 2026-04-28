import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const { status } = await req.json();

  if (!["approved", "viewed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { status };
  if (status === "approved") updates.approved_at = new Date().toISOString();
  if (status === "viewed") updates.viewed_at = new Date().toISOString();

  const { error } = await supabase
    .from("lessons")
    .update(updates)
    .eq("id", lessonId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
