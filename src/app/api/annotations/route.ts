import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { lessonId, profileId, pageNumber, strokeData } = await req.json();

  if (!lessonId || !profileId || pageNumber == null) {
    return NextResponse.json({ error: "lessonId, profileId, and pageNumber are required" }, { status: 400 });
  }

  // Upsert: one annotation record per lesson+profile+page
  const { data: existing } = await supabase
    .from("annotations")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("profile_id", profileId)
    .eq("page_number", pageNumber)
    .single();

  if (existing) {
    await supabase
      .from("annotations")
      .update({ stroke_data: strokeData })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("annotations")
      .insert({ lesson_id: lessonId, profile_id: profileId, page_number: pageNumber, stroke_data: strokeData });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lessonId");
  const profileId = url.searchParams.get("profileId");

  if (!lessonId || !profileId) {
    return NextResponse.json({ error: "lessonId and profileId are required" }, { status: 400 });
  }

  const { data } = await supabase
    .from("annotations")
    .select("page_number, stroke_data")
    .eq("lesson_id", lessonId)
    .eq("profile_id", profileId);

  return NextResponse.json({ annotations: data ?? [] });
}
