import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const profileId = formData.get("profileId") as string | null;
  const lessonId = formData.get("lessonId") as string | null;
  const durationSec = formData.get("durationSec") as string | null;

  if (!file || !profileId || !lessonId) {
    return NextResponse.json(
      { error: "file, profileId, and lessonId are required" },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const path = `${id}.webm`;

  const { error: uploadError } = await supabase.storage
    .from("reflections")
    .upload(path, file, { contentType: "audio/webm" });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("reflections").getPublicUrl(path);

  const { data, error } = await supabase
    .from("reflections")
    .insert({
      id,
      profile_id: profileId,
      lesson_id: lessonId,
      audio_url: publicUrl,
      duration_sec: durationSec ? parseInt(durationSec, 10) : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reflection: data });
}
