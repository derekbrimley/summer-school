import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const profileId = formData.get("profileId") as string | null;
  const topicId = formData.get("topicId") as string | null;
  const lessonId = formData.get("lessonId") as string | null;
  const prompt = formData.get("prompt") as string | null;

  if (!file || !profileId || !topicId || !prompt) {
    return NextResponse.json(
      { error: "file, profileId, topicId, and prompt are required" },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const path = `${id}.png`;

  const { error: uploadError } = await supabase.storage
    .from("drawings")
    .upload(path, file, { contentType: "image/png" });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("drawings").getPublicUrl(path);

  const { data, error } = await supabase
    .from("drawings")
    .insert({
      id,
      profile_id: profileId,
      topic_id: topicId,
      lesson_id: lessonId || null,
      image_url: publicUrl,
      prompt,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ drawing: data });
}
