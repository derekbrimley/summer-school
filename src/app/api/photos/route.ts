import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const profileId = formData.get("profileId") as string | null;
  const topicId = formData.get("topicId") as string | null;
  const caption = formData.get("caption") as string | null;

  if (!file || !profileId) {
    return NextResponse.json(
      { error: "file and profileId are required" },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("photos").getPublicUrl(path);

  const { data, error } = await supabase
    .from("photos")
    .insert({
      id,
      profile_id: profileId,
      topic_id: topicId || null,
      image_url: publicUrl,
      caption: caption || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ photo: data });
}
