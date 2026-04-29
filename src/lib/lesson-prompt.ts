import { LessonJson } from "./types";

const LESSON_JSON_SCHEMA = JSON.stringify({
  title: "string",
  subtitle: "string",
  narrative: [
    {
      heading: "string",
      body: "string",
      image_suggestion: "string",
    },
  ],
  did_you_know: ["string"],
  wonder_questions: ["string"],
  activity: {
    type: "drawing | labeling | sorting | matching | free_response",
    prompt: "string",
    instructions_4yo: "string",
    instructions_7yo: "string",
  },
  project_card: {
    title: "string",
    description: "string",
    materials: ["string"],
    steps_4yo: ["string"],
    steps_7yo: ["string"],
    wonder_questions: ["string"],
  },
  branching_topics: [
    {
      title: "string",
      teaser: "string",
      connection: "string",
    },
  ],
  video_suggestions: [
    {
      title: "string",
      channel: "string",
      url: "string",
      duration_minutes: "number",
    },
  ],
  conversation_starters: ["string"],
});

export function buildLessonPrompt(
  topic: string,
  childName: string,
  age: number,
  options?: { guidanceNotes?: string | null; referenceMaterial?: string | null }
): { system: string; user: string } {
  const system = `You are a lesson generator for WonderPath, a children's exploration app.

Generate a structured lesson about the given topic for a ${age}-year-old child named ${childName}.

CONTENT GUIDELINES:
- Use only well-established facts from reliable sources: Britannica Kids, DK Children's Encyclopedia, National Geographic Kids, NASA Space Place, Smithsonian, BBC Bitesize, PBS LearningMedia.
- If you are uncertain about any fact, flag it with [VERIFY] so the parent can check.
- Use warm, enthusiastic, age-appropriate language.
- For a 4-year-old: very simple sentences, concrete and sensory descriptions, relate everything to the child's experience. Target 300–500 words total for the narrative.
- For a 7-year-old: slightly more complex vocabulary (but still accessible), include cause-and-effect reasoning, some numbers and comparisons. Target 500–800 words total for the narrative.
- Include 2–3 narrative sections, each with an image suggestion.
- Include 2–3 "Did You Know?" facts.
- Include 3 open-ended "Wonder Questions" (not quiz questions — genuine invitations to think and wonder).

ACTIVITY:
- Choose one activity type from: drawing, labeling, sorting, matching, or free_response.
- Provide separate instructions for a 4-year-old and a 7-year-old.
- The activity should be completable in 5–10 minutes with a stylus on a tablet.

PROJECT CARD:
- Design a hands-on offline project using common household materials.
- Provide separate steps for a 4-year-old (simpler, with adult help) and a 7-year-old (more independent).
- Include 2 "wonder questions" to discuss while doing the project.

BRANCHING TOPICS:
- Suggest 3–5 related topics the child might explore next.
- For each, provide a title, a one-sentence teaser (exciting and curiosity-provoking), and a one-sentence connection explaining how it relates to the current topic.
- At least one branch should be cross-disciplinary (e.g., a science topic branching to history, art, or geography).

VIDEO SUGGESTIONS:
- Suggest 1–2 videos from these channels ONLY: SciShow Kids, Crash Course Kids, National Geographic Kids, PBS Kids, Sesame Street, StoryBots.
- Provide the video title, channel name, and approximate duration.
- If you cannot confidently identify a real video from these channels, omit this field entirely rather than guessing.

CONVERSATION STARTERS:
- Provide 2 conversation starters the parent can use at dinner to discuss this topic with the child.

WHERE RELEVANT, include a "Go Find It" suggestion in the project_card wonder_questions — a simple real-world observation the child can do related to this topic, specific to the Salt Lake City / Wasatch Front area when possible.

Respond ONLY with a valid JSON object matching this schema:
${LESSON_JSON_SCHEMA}`;

  let user = `Generate a lesson about "${topic}".`;

  if (options?.guidanceNotes) {
    user += `\n\nPARENT GUIDANCE (follow these directions carefully — the parent has specific preferences for how this topic should be taught):\n${options.guidanceNotes}`;
  }

  if (options?.referenceMaterial) {
    user += `\n\nREFERENCE MATERIAL (use this as your primary factual source — restructure it into the WonderPath lesson format with age-appropriate language, but draw your content from this material rather than general knowledge):\n${options.referenceMaterial}`;
  }

  return { system, user };
}

export function parseLessonResponse(text: string): LessonJson {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in response");
  }
  return JSON.parse(jsonMatch[0]) as LessonJson;
}
