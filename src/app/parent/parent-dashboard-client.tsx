"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface Profile {
  id: string;
  name: string;
  age: number;
}

interface TimelineEvent {
  id: string;
  profile_id: string;
  profile_name: string;
  type: "lesson" | "drawing" | "reflection" | "photo";
  topic_title?: string;
  detail?: string;
  created_at: string;
}

interface Stat {
  profile_id: string;
  profile_name: string;
  total_topics: number;
  lessons_today: number;
  session_minutes_today: number;
}

interface Starter {
  profile_name: string;
  starter: string;
}

interface DashboardData {
  timeline: TimelineEvent[];
  stats: Stat[];
  starters: Starter[];
}

const EVENT_ICONS: Record<string, string> = {
  lesson: "📖",
  drawing: "🎨",
  reflection: "🎤",
  photo: "📸",
};

const PROFILE_COLORS: Record<string, string> = {
  Sylvie: "bg-purple-100 text-purple-700 border-purple-200",
  Holland: "bg-amber-100 text-amber-700 border-amber-200",
};

function colorClass(name: string) {
  return PROFILE_COLORS[name] ?? "bg-gray-100 text-gray-700 border-gray-200";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupByDate(events: TimelineEvent[]) {
  const groups = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const key = formatDate(e.created_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return groups;
}

type Tab = "timeline" | "wonder-books" | "topics";

export function ParentDashboardClient({ profiles }: { profiles: Profile[] }) {
  const [tab, setTab] = useState<Tab>("timeline");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingTopic, setAddingTopic] = useState<string | null>(null); // profileId
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/parent/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  async function handleAddTopic(profileId: string) {
    if (!newTopicTitle.trim()) return;
    setSubmitting(true);
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTopicTitle.trim(), profileId, source: "parent_added" }),
    });
    setSubmitting(false);
    setNewTopicTitle("");
    setAddingTopic(null);
    setAddSuccess(true);
    setTimeout(() => setAddSuccess(false), 3000);
  }

  useEffect(() => {
    if (addingTopic && inputRef.current) inputRef.current.focus();
  }, [addingTopic]);

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(["timeline", "wonder-books", "topics"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "wonder-books" ? "Wonder Books" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12 text-gray-400">Loading…</div>
      )}

      {/* Timeline Tab */}
      {!loading && tab === "timeline" && data && (
        <div className="flex flex-col gap-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            {data.stats.map((s) => (
              <div key={s.profile_id} className={`rounded-2xl border p-4 ${colorClass(s.profile_name)}`}>
                <p className="font-bold text-lg">{s.profile_name}</p>
                <p className="text-sm mt-1">
                  {s.lessons_today > 0
                    ? `${s.lessons_today} lesson${s.lessons_today > 1 ? "s" : ""} today · ~${s.session_minutes_today} min`
                    : "No lessons today yet"}
                </p>
                <p className="text-xs mt-0.5 opacity-70">{s.total_topics} topic{s.total_topics !== 1 ? "s" : ""} explored total</p>
              </div>
            ))}
          </div>

          {/* Conversation starters */}
          {data.starters.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <p className="font-semibold text-orange-800 mb-2">🍽️ Dinner Table Starters</p>
              <ul className="flex flex-col gap-1.5">
                {data.starters.map((s, i) => (
                  <li key={i} className="text-sm text-orange-700">
                    <span className="font-medium">{s.profile_name}:</span> {s.starter}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timeline */}
          <div className="flex flex-col gap-5">
            {Array.from(groupByDate(data.timeline)).map(([date, events]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{date}</p>
                <div className="flex flex-col gap-2">
                  {events.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                      <span className="text-xl leading-none mt-0.5">{EVENT_ICONS[e.type]}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded-full border mr-1.5 ${colorClass(e.profile_name)}`}>
                          {e.profile_name}
                        </span>
                        <span className="text-sm text-gray-700">{e.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {data.timeline.length === 0 && (
              <p className="text-center text-gray-400 py-8">No activity yet — start exploring!</p>
            )}
          </div>
        </div>
      )}

      {/* Wonder Books Tab */}
      {!loading && tab === "wonder-books" && (
        <div className="flex flex-col gap-4">
          {profiles.map((p) => (
            <Link
              key={p.id}
              href={`/${p.id}/wonder-book`}
              className={`flex items-center gap-4 p-4 rounded-2xl border ${colorClass(p.name)} hover:shadow-md transition-all`}
            >
              <span className="text-3xl">{p.name === "Sylvie" ? "🦋" : "🌻"}</span>
              <div>
                <p className="font-bold">{p.name}&apos;s Wonder Book</p>
                <p className="text-xs opacity-70">Drawings, photos &amp; reflections</p>
              </div>
              <span className="ml-auto text-lg opacity-50">→</span>
            </Link>
          ))}
          <Link
            href={`/${profiles[0]?.id}/wonder-book`}
            className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 bg-gray-50 text-gray-700 hover:shadow-md transition-all"
          >
            <span className="text-3xl">👨‍👩‍👧‍👦</span>
            <div>
              <p className="font-bold">Family Wonder Book</p>
              <p className="text-xs opacity-70">Both children together</p>
            </div>
            <span className="ml-auto text-lg opacity-50">→</span>
          </Link>
        </div>
      )}

      {/* Topics Tab */}
      {!loading && tab === "topics" && (
        <div className="flex flex-col gap-6">
          {addSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm font-medium text-center">
              ✓ Topic added! It&apos;ll appear on the curiosity map.
            </div>
          )}

          {profiles.map((p) => (
            <div key={p.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{p.name === "Sylvie" ? "🦋" : "🌻"}</span>
                <h2 className="font-bold text-gray-800">{p.name}</h2>
                <Link
                  href={`/${p.id}/map`}
                  className="ml-auto text-xs text-purple-600 hover:underline"
                >
                  View Map →
                </Link>
              </div>

              {addingTopic === p.id ? (
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newTopicTitle}
                    onChange={(e) => setNewTopicTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTopic(p.id);
                      if (e.key === "Escape") { setAddingTopic(null); setNewTopicTitle(""); }
                    }}
                    placeholder="e.g. Black holes, Origami, Bees…"
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    disabled={submitting}
                  />
                  <button
                    onClick={() => handleAddTopic(p.id)}
                    disabled={submitting || !newTopicTitle.trim()}
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-purple-700 transition-colors"
                  >
                    {submitting ? "Adding…" : "Add"}
                  </button>
                  <button
                    onClick={() => { setAddingTopic(null); setNewTopicTitle(""); }}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTopic(p.id)}
                  className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-all text-sm font-medium"
                >
                  <span className="text-lg">+</span> Add a topic for {p.name}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
