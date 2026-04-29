import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BranchingTopic } from "@/lib/types";

// Called after a lesson is viewed to persist branching topics into the DB
export async function POST(request: NextRequest) {
  const { lessonId, profileId } = await request.json();

  if (!lessonId || !profileId) {
    return NextResponse.json({ error: "lessonId and profileId are required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any;

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("topic_id, lesson_json")
    .eq("id", lessonId)
    .single();

  if (lessonError || !lesson?.lesson_json) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const lj = lesson.lesson_json as { branching_topics?: BranchingTopic[] };
  const branches = lj.branching_topics ?? [];
  if (!branches.length) return NextResponse.json({ created: 0 });

  // Idempotency: check if we already persisted branches for this lesson
  const { count: existingConnections } = await supabase
    .from("topic_connections")
    .select("*", { count: "exact", head: true })
    .eq("from_topic", lesson.topic_id);

  if ((existingConnections ?? 0) > 0) {
    return NextResponse.json({ created: 0, skipped: "already_persisted" });
  }

  const created: string[] = [];

  for (const branch of branches) {
    // Check if topic with this title already exists (use .limit(1) to avoid
    // maybeSingle() erroring when duplicates already exist)
    const { data: existingRows } = await supabase
      .from("topics")
      .select("id")
      .ilike("title", branch.title)
      .limit(1);

    let targetTopicId: string;
    const existing = existingRows?.[0];

    if (existing) {
      targetTopicId = existing.id;
    } else {
      const { data: newTopic, error: topicError } = await supabase
        .from("topics")
        .insert({
          title: branch.title,
          description: branch.teaser,
          parent_topic: lesson.topic_id,
          source: "ai_suggested",
          approved: false,
        })
        .select("id")
        .single();

      if (topicError || !newTopic) continue;
      targetTopicId = newTopic.id;
      created.push(targetTopicId);
    }

    // Insert connection if it doesn't already exist
    const { data: existingConn } = await supabase
      .from("topic_connections")
      .select("id")
      .eq("from_topic", lesson.topic_id)
      .eq("to_topic", targetTopicId)
      .limit(1);

    if (!existingConn?.length) {
      await supabase
        .from("topic_connections")
        .insert({
          from_topic: lesson.topic_id,
          to_topic: targetTopicId,
          label: branch.connection,
        });
    }
  }

  return NextResponse.json({ created: created.length });
}
