import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

type TopicRow = {
  id: string;
  title: string;
  description: string | null;
  guidance_notes: string | null;
};

type LessonRow = {
  id: string;
  topic_id: string;
  status: string;
  lesson_json: Record<string, unknown> | null;
};

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any;

  // Fetch recent approved topics
  const { data: topicsRaw, error: topicsError } = await supabase
    .from("topics")
    .select("id, title, description, guidance_notes")
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(5);

  if (topicsError) {
    return NextResponse.json({ error: topicsError.message }, { status: 500 });
  }

  const topics = (topicsRaw ?? []) as TopicRow[];

  if (!topics.length) {
    return NextResponse.json({
      topic: null,
      prompt: null,
      message: "No approved topics found",
    });
  }

  // Try to find a topic with a ready lesson that has content
  for (const topic of topics) {
    const { data: lessonsRaw } = await supabase
      .from("lessons")
      .select("id, topic_id, status, lesson_json")
      .eq("topic_id", topic.id)
      .eq("status", "ready")
      .not("lesson_json", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const lessons = (lessonsRaw ?? []) as LessonRow[];

    if (lessons.length && lessons[0].lesson_json) {
      const lessonJson = lessons[0].lesson_json;

      // Try to extract a wonder question
      const wonderQuestions = lessonJson.wonder_questions as string[] | undefined;
      if (wonderQuestions?.length) {
        const randomIndex = Math.floor(Math.random() * wonderQuestions.length);
        return NextResponse.json({
          topic: {
            title: topic.title,
            description: topic.description,
          },
          prompt: {
            type: "wonder_question",
            text: wonderQuestions[randomIndex],
          },
        });
      }

      // Fall back to activity prompt
      const activity = lessonJson.activity as { prompt?: string } | undefined;
      if (activity?.prompt) {
        return NextResponse.json({
          topic: {
            title: topic.title,
            description: topic.description,
          },
          prompt: {
            type: "activity",
            text: activity.prompt,
          },
        });
      }

      // Fall back to conversation starter
      const conversationStarters = lessonJson.conversation_starters as string[] | undefined;
      if (conversationStarters?.length) {
        return NextResponse.json({
          topic: {
            title: topic.title,
            description: topic.description,
          },
          prompt: {
            type: "conversation_starter",
            text: conversationStarters[0],
          },
        });
      }
    }
  }

  // No topics with lessons found, return just the first topic
  return NextResponse.json({
    topic: {
      title: topics[0].title,
      description: topics[0].description,
    },
    prompt: {
      type: "description",
      text: topics[0].description || topics[0].guidance_notes || "Explore this topic today!",
    },
  });
}
