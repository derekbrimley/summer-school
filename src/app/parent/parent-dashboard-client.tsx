"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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

interface Suggestion {
  id: string;
  title: string;
  description: string | null;
  parent_topic: string | null;
  parent_topic_title: string | null;
  source: string;
  created_at: string;
}

interface ApprovedTopic {
  id: string;
  title: string;
  description: string | null;
  source: string;
  guidance_notes: string | null;
  reference_material: string | null;
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

// --- Reference Material Input (file upload + paste fallback) ---

function ReferenceInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"upload" | "paste">(value ? "paste" : "upload");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/upload-pdf", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        setUploading(false);
        return;
      }

      onChange(data.text);
      setFileName(data.fileName);
    } catch {
      setError("Upload failed — check your connection and try again.");
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (mode === "paste" || value) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label className="block text-xs font-medium text-gray-600">
            Reference Material
          </label>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setFileName(null); setMode("upload"); }}
              className="text-xs text-red-400 hover:text-red-600 hover:underline"
              disabled={disabled}
            >
              Clear
            </button>
          )}
        </div>
        {fileName && (
          <p className="text-xs text-green-600">Extracted from: {fileName}</p>
        )}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste text from a book, article, etc."
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
          disabled={disabled}
        />
        {!value && (
          <button
            type="button"
            onClick={() => setMode("upload")}
            className="self-start text-xs text-purple-600 hover:underline"
          >
            Upload a PDF instead
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="block text-xs font-medium text-gray-600">
        Reference Material <span className="font-normal text-gray-400">(upload a PDF or paste text)</span>
      </label>
      <div className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={disabled || uploading}
          className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 file:cursor-pointer file:transition-colors disabled:opacity-50"
        />
        {uploading && <span className="text-xs text-gray-500">Extracting text...</span>}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => setMode("paste")}
        className="self-start text-xs text-purple-600 hover:underline"
      >
        Paste text manually instead
      </button>
    </div>
  );
}

// --- Suggestion Card ---

function SuggestionCard({
  suggestion,
  onApprove,
  onDismiss,
}: {
  suggestion: Suggestion;
  onApprove: (id: string, edits?: { title?: string; guidance_notes?: string; reference_material?: string }) => void;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editTitle, setEditTitle] = useState(suggestion.title);
  const [guidance, setGuidance] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleApprove() {
    setBusy(true);
    await onApprove(suggestion.id, {
      title: editTitle !== suggestion.title ? editTitle : undefined,
      guidance_notes: guidance || undefined,
      reference_material: reference || undefined,
    });
    setBusy(false);
  }

  async function handleDismiss() {
    setBusy(true);
    await onDismiss(suggestion.id);
    setBusy(false);
  }

  return (
    <div className="border border-cyan-200 bg-cyan-50 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800">{suggestion.title}</p>
          {suggestion.description && (
            <p className="text-sm text-gray-600 mt-0.5">{suggestion.description}</p>
          )}
          {suggestion.parent_topic_title && (
            <p className="text-xs text-cyan-600 mt-1">
              Branched from: {suggestion.parent_topic_title}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={handleApprove}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleDismiss}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 pt-2 border-t border-cyan-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Guidance Notes <span className="font-normal text-gray-400">(optional — directions for the lesson)</span>
            </label>
            <textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="e.g. Focus on how volcanoes form, skip scary eruption details. Mention Mt. St. Helens since we visited."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
            />
          </div>
          <ReferenceInput value={reference} onChange={setReference} disabled={busy} />
          <button
            onClick={handleApprove}
            disabled={busy || !editTitle.trim()}
            className="self-start px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {busy ? "Saving..." : "Approve with Edits"}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Add Topic Form ---

function AddTopicForm({
  profileId,
  profileName,
  onCreated,
}: {
  profileId: string;
  profileName: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [guidance, setGuidance] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  async function handleSubmit() {
    if (!title.trim()) return;
    setSubmitting(true);
    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        profileId,
        source: "parent_added",
        guidance_notes: guidance.trim() || undefined,
        reference_material: reference.trim() || undefined,
      }),
    });
    setTitle("");
    setGuidance("");
    setReference("");
    setShowAdvanced(false);
    setSubmitting(false);
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-all text-sm font-medium"
      >
        <span className="text-lg">+</span> Add a topic for {profileName}
      </button>
    );
  }

  return (
    <div className="border border-purple-200 bg-purple-50 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !showAdvanced) handleSubmit();
            if (e.key === "Escape") { setOpen(false); setTitle(""); setGuidance(""); setReference(""); setShowAdvanced(false); }
          }}
          placeholder="e.g. Black holes, Origami, Bees..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          disabled={submitting}
        />
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            showAdvanced
              ? "border-purple-300 bg-purple-100 text-purple-700"
              : "border-gray-200 text-gray-500 hover:bg-gray-50"
          }`}
          title="Add guidance or reference material"
        >
          +Details
        </button>
        <button
          onClick={() => { setOpen(false); setTitle(""); setGuidance(""); setReference(""); setShowAdvanced(false); }}
          className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      {showAdvanced && (
        <div className="flex flex-col gap-3 pt-2 border-t border-purple-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Guidance Notes <span className="font-normal text-gray-400">(what should the lesson focus on?)</span>
            </label>
            <textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="e.g. Focus on the water cycle. Use our backyard garden as an example. Skip anything about floods."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              disabled={submitting}
            />
          </div>
          <ReferenceInput value={reference} onChange={setReference} disabled={submitting} />
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !title.trim()}
        className="self-start px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-purple-700 transition-colors"
      >
        {submitting ? "Adding..." : "Add Topic"}
      </button>
    </div>
  );
}

// --- Approved Topic Row ---

function ApprovedTopicRow({ topic, onUpdated, onRemoved }: { topic: ApprovedTopic; onUpdated: () => void; onRemoved: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [guidance, setGuidance] = useState(topic.guidance_notes ?? "");
  const [reference, setReference] = useState(topic.reference_material ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guidance_notes: guidance,
        reference_material: reference,
      }),
    });
    setSaving(false);
    setEditing(false);
    onUpdated();
  }

  async function handleRemove() {
    setSaving(true);
    await onRemoved(topic.id);
    setSaving(false);
  }

  const SOURCE_LABELS: Record<string, string> = {
    seed: "Starter",
    parent_added: "You added",
    ai_suggested: "AI suggested",
    child_requested: "Child asked",
  };

  const hasExtras = topic.guidance_notes || topic.reference_material;

  return (
    <div className="border border-gray-100 bg-white rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="font-medium text-gray-800 flex-1">{topic.title}</p>
        <span className="text-xs text-gray-400">{SOURCE_LABELS[topic.source] ?? topic.source}</span>
        <button
          onClick={() => setEditing(!editing)}
          className="text-xs text-purple-600 hover:underline"
        >
          {editing ? "Close" : hasExtras ? "Edit" : "Add Guidance"}
        </button>
        {!confirmRemove ? (
          <button
            onClick={() => setConfirmRemove(true)}
            className="text-xs text-red-400 hover:text-red-600 hover:underline"
          >
            Remove
          </button>
        ) : (
          <span className="flex items-center gap-1">
            <button
              onClick={handleRemove}
              disabled={saving}
              className="text-xs text-red-600 font-medium hover:underline disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              className="text-xs text-gray-400 hover:underline"
            >
              Cancel
            </button>
          </span>
        )}
      </div>

      {!editing && hasExtras && (
        <div className="flex gap-3 text-xs text-gray-500">
          {topic.guidance_notes && <span>Has guidance notes</span>}
          {topic.reference_material && <span>Has reference material</span>}
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Guidance Notes</label>
            <textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="What should the lesson focus on? What to skip?"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
            />
          </div>
          <ReferenceInput value={reference} onChange={setReference} />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setGuidance(topic.guidance_notes ?? ""); setReference(topic.reference_material ?? ""); }}
              className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Dashboard ---

export function ParentDashboardClient({ profiles }: { profiles: Profile[] }) {
  const [tab, setTab] = useState<Tab>("timeline");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Topics tab state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [approvedTopics, setApprovedTopics] = useState<ApprovedTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/parent/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  const loadTopicsData = useCallback(async () => {
    setTopicsLoading(true);
    const [suggestionsRes, topicsRes] = await Promise.all([
      fetch("/api/parent/suggestions").then((r) => r.json()),
      fetch("/api/parent/topics").then((r) => r.json()),
    ]);
    setSuggestions(suggestionsRes.suggestions ?? []);
    setApprovedTopics(topicsRes.topics ?? []);
    setTopicsLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "topics") loadTopicsData();
  }, [tab, loadTopicsData]);

  function showSuccess(msg: string) {
    setErrorMessage(null);
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  function showError(msg: string) {
    setSuccessMessage(null);
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  }

  async function handleApproveSuggestion(
    topicId: string,
    edits?: { title?: string; guidance_notes?: string; reference_material?: string }
  ) {
    await fetch("/api/parent/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", topicId, ...edits }),
    });
    showSuccess("Topic approved! It'll appear on the curiosity map.");
    loadTopicsData();
  }

  async function handleDismissSuggestion(topicId: string) {
    await fetch("/api/parent/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", topicId }),
    });
    showSuccess("Suggestion dismissed.");
    loadTopicsData();
  }

  async function handleRemoveTopic(topicId: string) {
    const res = await fetch(`/api/topics/${topicId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      showError(data.error ?? "Failed to remove topic.");
      return;
    }
    showSuccess("Topic removed.");
    loadTopicsData();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(["timeline", "wonder-books", "topics"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors relative ${
              tab === t ? "bg-white shadow text-gray-800" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "wonder-books" ? "Wonder Books" : t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "topics" && suggestions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {suggestions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12 text-gray-400">Loading...</div>
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
              <p className="font-semibold text-orange-800 mb-2">Dinner Table Starters</p>
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
              <span className="ml-auto text-lg opacity-50">&rarr;</span>
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
            <span className="ml-auto text-lg opacity-50">&rarr;</span>
          </Link>
        </div>
      )}

      {/* Topics Tab */}
      {!loading && tab === "topics" && (
        <div className="flex flex-col gap-6">
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm font-medium text-center">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium text-center">
              {errorMessage}
            </div>
          )}

          {/* Pending Suggestions */}
          {suggestions.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                Suggested Topics
                <span className="text-xs font-medium text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded-full">
                  {suggestions.length} pending
                </span>
              </h2>
              <p className="text-sm text-gray-500 -mt-1">
                These were suggested based on lessons the kids explored. Approve, edit, or dismiss.
              </p>
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onApprove={handleApproveSuggestion}
                  onDismiss={handleDismissSuggestion}
                />
              ))}
            </div>
          )}

          {/* Add New Topics */}
          {profiles.map((p) => (
            <div key={p.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{p.name === "Sylvie" ? "🦋" : "🌻"}</span>
                <h2 className="font-bold text-gray-800">{p.name}</h2>
                <Link
                  href={`/${p.id}/map`}
                  className="ml-auto text-xs text-purple-600 hover:underline"
                >
                  View Map &rarr;
                </Link>
              </div>

              <AddTopicForm
                profileId={p.id}
                profileName={p.name}
                onCreated={() => {
                  showSuccess("Topic added! It'll appear on the curiosity map.");
                  loadTopicsData();
                }}
              />
            </div>
          ))}

          {/* Existing Approved Topics */}
          {topicsLoading ? (
            <div className="text-center text-gray-400 py-4">Loading topics...</div>
          ) : approvedTopics.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h2 className="font-bold text-gray-800">All Topics ({approvedTopics.length})</h2>
              <p className="text-sm text-gray-500 -mt-1">
                Add guidance notes or reference material to shape how lessons are generated.
              </p>
              {approvedTopics.map((t) => (
                <ApprovedTopicRow key={t.id} topic={t} onUpdated={loadTopicsData} onRemoved={handleRemoveTopic} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
