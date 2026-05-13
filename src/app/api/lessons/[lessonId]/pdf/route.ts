import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { getSupabaseAdmin } from "@/lib/supabase";
import { LessonDocument } from "@/lib/lesson-pdf";
import { LessonJson } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const supabase = getSupabaseAdmin() as any;

  const { data: lesson } = await supabase
    .from("lessons")
    .select("lesson_json, profile_id")
    .eq("id", lessonId)
    .single();

  if (!lesson?.lesson_json) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("age")
    .eq("id", lesson.profile_id)
    .single();

  const age = profile?.age ?? 7;
  const content = lesson.lesson_json as LessonJson;

  const buffer = await renderToBuffer(
    React.createElement(LessonDocument, { content, age }) as React.ReactElement<DocumentProps>
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="lesson-${lessonId}.pdf"`,
    },
  });
}
