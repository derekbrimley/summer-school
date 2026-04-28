import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseAdmin() as any;

  type TopicRow = { id: string; title: string; description: string | null; source: string };
  type ConnectionRow = { from_topic: string; to_topic: string; label: string | null };
  type LessonRow = { id: string; topic_id: string; status: string };

  const [
    { data: topicsRaw },
    { data: connectionsRaw },
    { data: lessonsRaw },
  ] = await Promise.all([
    supabase.from("topics").select("id, title, description, source").order("created_at"),
    supabase.from("topic_connections").select("from_topic, to_topic, label"),
    supabase
      .from("lessons")
      .select("id, topic_id, status")
      .eq("profile_id", profileId),
  ]);

  const topics = topicsRaw as TopicRow[] | null;
  const connections = connectionsRaw as ConnectionRow[] | null;
  const lessons = lessonsRaw as LessonRow[] | null;

  // Determine which topics this profile has explored (any lesson in approved/viewed state)
  const exploredTopicIds = new Set(
    (lessons ?? [])
      .filter((l) => l.status === "approved" || l.status === "viewed")
      .map((l) => l.topic_id)
  );

  // Most recent lesson per topic (for linking to lesson page)
  const latestLesson = new Map<string, string>();
  for (const l of (lessons ?? []).slice().reverse()) {
    latestLesson.set(l.topic_id, l.id);
  }

  // Deduplicate topics by title (case-insensitive), preferring explored topics
  const seenTitles = new Map<string, TopicRow>();
  const duplicateIds = new Set<string>();
  for (const t of topics ?? []) {
    const key = t.title.toLowerCase().trim();
    const prev = seenTitles.get(key);
    if (prev) {
      // Keep whichever one has been explored; otherwise keep the earlier one
      if (!exploredTopicIds.has(prev.id) && exploredTopicIds.has(t.id)) {
        duplicateIds.add(prev.id);
        seenTitles.set(key, t);
      } else {
        duplicateIds.add(t.id);
      }
    } else {
      seenTitles.set(key, t);
    }
  }

  // Build a mapping from duplicate IDs to the canonical (surviving) topic ID
  const canonicalId = new Map<string, string>();
  for (const t of topics ?? []) {
    const key = t.title.toLowerCase().trim();
    const canonical = seenTitles.get(key)!;
    if (t.id !== canonical.id) {
      canonicalId.set(t.id, canonical.id);
    }
  }

  const nodes = (topics ?? [])
    .filter((t) => !duplicateIds.has(t.id))
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      source: t.source,
      explored: exploredTopicIds.has(t.id),
      lessonId: latestLesson.get(t.id) ?? null,
    }));

  const nodeIdSet = new Set(nodes.map((n) => n.id));

  // Remap edges so duplicate topic IDs point to the canonical survivor,
  // then deduplicate edges and drop any that reference unknown nodes
  const edgeSeen = new Set<string>();
  const edges = (connections ?? [])
    .map((e) => ({
      from_topic: canonicalId.get(e.from_topic) ?? e.from_topic,
      to_topic: canonicalId.get(e.to_topic) ?? e.to_topic,
      label: e.label,
    }))
    .filter((e) => {
      if (e.from_topic === e.to_topic) return false;
      if (!nodeIdSet.has(e.from_topic) || !nodeIdSet.has(e.to_topic)) return false;
      const key = `${e.from_topic}->${e.to_topic}`;
      if (edgeSeen.has(key)) return false;
      edgeSeen.add(key);
      return true;
    });

  return NextResponse.json({ nodes, edges });
}
