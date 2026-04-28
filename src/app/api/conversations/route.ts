import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { LessonJson } from "@/lib/types";

const anthropic = new Anthropic();
const QUESTION_CAP = 5;

export async function POST(req: NextRequest) {
  const { lessonId, profileId, question } = await req.json();

  if (!lessonId || !profileId || !question) {
    return NextResponse.json(
      { error: "lessonId, profileId, and question are required" },
      { status: 400 }
    );
  }

  const [{ data: lesson }, { data: profile }] = await Promise.all([
    supabase
      .from("lessons")
      .select("lesson_json, topic_id")
      .eq("id", lessonId)
      .single(),
    supabase.from("profiles").select("name, age").eq("id", profileId).single(),
  ]);

  if (!lesson?.lesson_json || !profile) {
    return NextResponse.json({ error: "Lesson or profile not found" }, { status: 404 });
  }

  const { data: topic } = await supabase
    .from("topics")
    .select("title")
    .eq("id", lesson.topic_id)
    .single();

  // Load or create conversation record
  let { data: conversation } = await supabase
    .from("conversations")
    .select("id, messages, question_count")
    .eq("lesson_id", lessonId)
    .eq("profile_id", profileId)
    .single();

  if (!conversation) {
    const { data: newConv } = await supabase
      .from("conversations")
      .insert({ lesson_id: lessonId, profile_id: profileId })
      .select("id, messages, question_count")
      .single();
    conversation = newConv;
  }

  if (!conversation) {
    return NextResponse.json({ error: "Failed to load conversation" }, { status: 500 });
  }

  if (conversation.question_count >= QUESTION_CAP) {
    return NextResponse.json({ capped: true, answer: null });
  }

  const content = lesson.lesson_json as LessonJson;
  const narrativeText = content.narrative
    .map((s) => `${s.heading}: ${s.body}`)
    .join("\n\n");

  const systemPrompt = `You are answering questions from a ${profile.age}-year-old child named ${profile.name} about "${topic?.title ?? "this topic"}".

Rules:
- Only discuss ${topic?.title ?? "this topic"} and directly related subjects.
- If the child asks about something unrelated, say: "That's a great question! But right now we're learning about ${topic?.title ?? "this topic"}. Maybe ask your mom or dad about that one!"
- Use simple, age-appropriate language.
- Keep answers to ${profile.age <= 4 ? "2-3 short sentences" : "3-5 sentences"}.
- Be warm, enthusiastic, and encouraging.
- Never make up facts. If unsure, say "I'm not sure about that — let's look it up together with your mom or dad!"
- Do not role-play as a character. Just be a helpful, friendly voice.

Context from the lesson:
${narrativeText}`;

  const existingMessages = (conversation.messages as { role: "user" | "assistant"; content: string }[]) ?? [];
  const messages = [
    ...existingMessages,
    { role: "user" as const, content: question },
  ];

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const answer = textBlock?.type === "text" ? textBlock.text : "";

  const updatedMessages = [
    ...messages,
    { role: "assistant" as const, content: answer },
  ];

  await supabase
    .from("conversations")
    .update({
      messages: updatedMessages,
      question_count: conversation.question_count + 1,
    })
    .eq("id", conversation.id);

  return NextResponse.json({
    answer,
    questionsUsed: conversation.question_count + 1,
    questionsRemaining: QUESTION_CAP - (conversation.question_count + 1),
    capped: false,
  });
}
