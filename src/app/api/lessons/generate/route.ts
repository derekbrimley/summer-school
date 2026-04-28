import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { buildLessonPrompt, parseLessonResponse } from "@/lib/lesson-prompt";
import { fetchLessonImages } from "@/lib/unsplash";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const { topicId, profileId } = await request.json();

  if (!topicId || !profileId) {
    return NextResponse.json(
      { error: "topicId and profileId are required" },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("name, age")
    .eq("id", profileId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("title")
    .eq("id", topicId)
    .single();

  if (topicError || !topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const { data: lesson, error: insertError } = await supabase
    .from("lessons")
    .insert({
      topic_id: topicId,
      profile_id: profileId,
      status: "generating",
    })
    .select("id")
    .single();

  if (insertError || !lesson) {
    return NextResponse.json(
      { error: "Failed to create lesson record" },
      { status: 500 }
    );
  }

  const { system, user } = buildLessonPrompt(
    topic.title,
    profile.name,
    profile.age
  );

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content in response");
    }

    const lessonJson = parseLessonResponse(textBlock.text);

    // Fetch Unsplash images for each narrative section
    const imageSuggestions = lessonJson.narrative.map(
      (s: { image_suggestion: string }) => s.image_suggestion
    );
    const imageUrls = await fetchLessonImages(imageSuggestions);
    for (let i = 0; i < lessonJson.narrative.length; i++) {
      if (imageUrls[i]) {
        lessonJson.narrative[i].image_url = imageUrls[i] ?? undefined;
      }
    }

    const { error: updateError } = await supabase
      .from("lessons")
      .update({ lesson_json: lessonJson, status: "ready" })
      .eq("id", lesson.id);

    if (updateError) {
      throw new Error("Failed to update lesson with generated content");
    }

    return NextResponse.json({ lessonId: lesson.id, lesson: lessonJson });
  } catch (error) {
    await supabase
      .from("lessons")
      .update({ status: "generating" })
      .eq("id", lesson.id);

    const message =
      error instanceof Error ? error.message : "Unknown error during generation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
