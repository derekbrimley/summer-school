import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

type ProfileRow = { id: string; name: string; age: number };
type ExplorationRow = {
  id: string; profile_id: string; lesson_id: string; topic_id: string;
  started_at: string; completed_at: string | null;
};
type LessonRow = {
  id: string; topic_id: string; profile_id: string; status: string;
  lesson_json: Record<string, unknown> | null; created_at: string; viewed_at: string | null;
};
type DrawingRow = { id: string; profile_id: string; topic_id: string | null; prompt: string | null; created_at: string };
type ReflectionRow = { id: string; profile_id: string; lesson_id: string; duration_sec: number | null; created_at: string };
type PhotoRow = { id: string; profile_id: string; topic_id: string | null; caption: string | null; created_at: string };
type TopicRow = { id: string; title: string };

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any;

  const [
    { data: profilesRaw },
    { data: explorationsRaw },
    { data: lessonsRaw },
    { data: drawingsRaw },
    { data: reflectionsRaw },
    { data: photosRaw },
  ] = await Promise.all([
    supabase.from("profiles").select("id, name, age").order("age", { ascending: false }),
    supabase.from("explorations").select("id, profile_id, lesson_id, topic_id, started_at, completed_at").order("started_at", { ascending: false }),
    supabase.from("lessons").select("id, topic_id, profile_id, status, lesson_json, created_at, viewed_at").order("created_at", { ascending: false }),
    supabase.from("drawings").select("id, profile_id, topic_id, prompt, created_at").order("created_at", { ascending: false }),
    supabase.from("reflections").select("id, profile_id, lesson_id, duration_sec, created_at").order("created_at", { ascending: false }),
    supabase.from("photos").select("id, profile_id, topic_id, caption, created_at").order("created_at", { ascending: false }),
  ]);

  const profiles = (profilesRaw ?? []) as ProfileRow[];
  const explorations = (explorationsRaw ?? []) as ExplorationRow[];
  const lessons = (lessonsRaw ?? []) as LessonRow[];
  const drawings = (drawingsRaw ?? []) as DrawingRow[];
  const reflections = (reflectionsRaw ?? []) as ReflectionRow[];
  const photos = (photosRaw ?? []) as PhotoRow[];

  // Fetch topics for enrichment
  const topicIds = [
    ...new Set([
      ...explorations.map((e) => e.topic_id),
      ...drawings.map((d) => d.topic_id).filter((id): id is string => id != null),
      ...photos.map((p) => p.topic_id).filter((id): id is string => id != null),
    ]),
  ];
  const { data: topicsRaw } = topicIds.length
    ? await supabase.from("topics").select("id, title").in("id", topicIds)
    : { data: [] };

  const topicMap = new Map<string, string>(((topicsRaw ?? []) as TopicRow[]).map((t) => [t.id, t.title]));
  const lessonMap = new Map<string, LessonRow>(lessons.map((l) => [l.id, l]));
  const profileMap = new Map<string, ProfileRow>(profiles.map((p) => [p.id, p]));

  type TimelineEvent = {
    id: string;
    profile_id: string;
    profile_name: string;
    type: "lesson" | "drawing" | "reflection" | "photo";
    topic_title?: string;
    detail?: string;
    created_at: string;
  };

  const events: TimelineEvent[] = [];

  for (const e of explorations) {
    const lesson = lessonMap.get(e.lesson_id);
    const profile = profileMap.get(e.profile_id);
    if (!lesson || !profile) continue;
    const topicTitle = topicMap.get(e.topic_id) ?? "Unknown topic";
    events.push({
      id: e.id,
      profile_id: e.profile_id,
      profile_name: profile.name,
      type: "lesson",
      topic_title: topicTitle,
      detail: `explored ${topicTitle}`,
      created_at: e.started_at,
    });
  }

  for (const d of drawings) {
    const profile = profileMap.get(d.profile_id);
    if (!profile) continue;
    events.push({
      id: d.id,
      profile_id: d.profile_id,
      profile_name: profile.name,
      type: "drawing",
      topic_title: d.topic_id ? topicMap.get(d.topic_id) : undefined,
      detail: d.prompt ? `drew: "${d.prompt.slice(0, 60)}"` : "created a drawing",
      created_at: d.created_at,
    });
  }

  for (const r of reflections) {
    const profile = profileMap.get(r.profile_id);
    if (!profile) continue;
    const lesson = lessonMap.get(r.lesson_id);
    events.push({
      id: r.id,
      profile_id: r.profile_id,
      profile_name: profile.name,
      type: "reflection",
      topic_title: lesson ? topicMap.get(lesson.topic_id) : undefined,
      detail: r.duration_sec ? `recorded ${r.duration_sec}s reflection` : "recorded a reflection",
      created_at: r.created_at,
    });
  }

  for (const p of photos) {
    const profile = profileMap.get(p.profile_id);
    if (!profile) continue;
    events.push({
      id: p.id,
      profile_id: p.profile_id,
      profile_name: profile.name,
      type: "photo",
      topic_title: p.topic_id ? topicMap.get(p.topic_id) : undefined,
      detail: p.caption ? `photo: "${p.caption}"` : "uploaded a photo",
      created_at: p.created_at,
    });
  }

  events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Stats per profile
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = profiles.map((p) => {
    const profileLessons = lessons.filter((l) => l.profile_id === p.id);
    const exploredTopicIds = new Set(
      profileLessons
        .filter((l) => l.status === "viewed" || l.status === "approved")
        .map((l) => l.topic_id)
    );
    const todayLessons = profileLessons.filter((l) => new Date(l.created_at) >= today);
    return {
      profile_id: p.id,
      profile_name: p.name,
      total_topics: exploredTopicIds.size,
      lessons_today: todayLessons.length,
      session_minutes_today: todayLessons.length * 10,
    };
  });

  // Conversation starters from most recent lessons
  const starters: { profile_name: string; starter: string }[] = [];
  for (const p of profiles) {
    const recent = lessons.filter((l) => l.profile_id === p.id && l.lesson_json).slice(0, 3);
    for (const l of recent) {
      const cs = l.lesson_json?.conversation_starters as string[] | undefined;
      if (cs?.length) {
        starters.push({ profile_name: p.name, starter: cs[0] });
        break;
      }
    }
  }

  return NextResponse.json({ timeline: events, stats, starters, profiles });
}
