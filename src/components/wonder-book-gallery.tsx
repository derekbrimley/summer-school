"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { WonderBookEntry } from "@/lib/types";

type ViewMode = "date" | "topic" | "family";

interface WonderBookGalleryProps {
  profileId: string;
  profileName: string;
  age: number;
  profiles: { id: string; name: string }[];
  topics: { id: string; title: string }[];
}

export function WonderBookGallery({
  profileId,
  profileName,
  age,
  profiles,
  topics,
}: WonderBookGalleryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("date");
  const [entries, setEntries] = useState<WonderBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WonderBookEntry | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params =
      viewMode === "family"
        ? `family=true&profileId=${profileId}`
        : `profileId=${profileId}`;
    fetch(`/api/wonder-book?${params}`)
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then(({ entries }) => setEntries(entries ?? []))
      .finally(() => setLoading(false));
  }, [profileId, viewMode]);

  const topicMap = new Map(topics.map((t) => [t.id, t.title]));
  const profileMap = new Map(profiles.map((p) => [p.id, p.name]));

  function groupByTopic() {
    const groups = new Map<string, WonderBookEntry[]>();
    for (const entry of entries) {
      const topicId =
        entry.type === "reflection"
          ? "reflections"
          : (entry.data as { topic_id?: string | null }).topic_id ?? "other";
      const key = topicMap.get(topicId) ?? (topicId === "reflections" ? "Reflections" : "Other");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }
    return groups;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <main className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <Link
          href={`/${profileId}/topics`}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold flex-1">
          {viewMode === "family" ? "Family" : `${profileName}'s`} Wonder Book
        </h1>
      </div>

      {/* View mode tabs */}
      <div className="bg-white border-b px-4 py-2 flex gap-2">
        {(["date", "topic", "family"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              viewMode === mode
                ? "bg-purple-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {mode === "date" ? "By Date" : mode === "topic" ? "By Topic" : "Family"}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-1.5 rounded-full text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          📸 Upload Photo
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 bg-gray-50">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className={age <= 4 ? "text-2xl" : "text-lg"}>No entries yet!</p>
            <p className="text-sm mt-2">
              Drawings, recordings, and photos will show up here.
            </p>
          </div>
        ) : viewMode === "topic" ? (
          <div className="flex flex-col gap-8">
            {[...groupByTopic()].map(([topicTitle, items]) => (
              <div key={topicTitle}>
                <h2 className="text-lg font-semibold text-gray-700 mb-3">
                  {topicTitle}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {items.map((entry) => (
                    <EntryCard
                      key={entry.data.id}
                      entry={entry}
                      profileMap={profileMap}
                      showProfile={false}
                      formatDate={formatDate}
                      onSelect={() => setSelected(entry)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {entries.map((entry) => (
              <EntryCard
                key={entry.data.id}
                entry={entry}
                profileMap={profileMap}
                showProfile={viewMode === "family"}
                formatDate={formatDate}
                onSelect={() => setSelected(entry)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selected && (
        <Lightbox entry={selected} onClose={() => setSelected(null)} />
      )}

      {/* Upload modal */}
      {showUpload && (
        <PhotoUploadModal
          profileId={profileId}
          profiles={profiles}
          topics={topics}
          onUploaded={() => {
            setShowUpload(false);
            fetch(`/api/wonder-book?profileId=${profileId}`)
              .then((r) => r.json())
              .then(({ entries }) => setEntries(entries ?? []));
          }}
          onClose={() => setShowUpload(false)}
        />
      )}
    </main>
  );
}

function EntryCard({
  entry,
  profileMap,
  showProfile,
  formatDate,
  onSelect,
}: {
  entry: WonderBookEntry;
  profileMap: Map<string, string>;
  showProfile: boolean;
  formatDate: (d: string) => string;
  onSelect: () => void;
}) {
  const typeIcon =
    entry.type === "drawing" ? "🎨" : entry.type === "reflection" ? "🎤" : "📸";

  return (
    <button
      onClick={onSelect}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-purple-300 transition-all text-left flex flex-col"
    >
      {entry.type === "drawing" || entry.type === "photo" ? (
        <div className="aspect-square bg-gray-100 relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.data.image_url}
            alt={entry.type === "drawing" ? entry.data.prompt : entry.data.caption ?? "Photo"}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-square bg-purple-50 flex items-center justify-center">
          <div className="text-center">
            <span className="text-4xl">🎤</span>
            <p className="text-sm text-purple-600 mt-2 font-medium">
              {entry.data.duration_sec
                ? `${Math.floor(entry.data.duration_sec / 60)}:${(entry.data.duration_sec % 60).toString().padStart(2, "0")}`
                : "Recording"}
            </p>
          </div>
        </div>
      )}
      <div className="p-3 flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span>{typeIcon}</span>
          <span>{formatDate(entry.data.created_at)}</span>
          {showProfile && (
            <span className="ml-auto text-purple-500 font-medium">
              {profileMap.get(entry.data.profile_id) ?? ""}
            </span>
          )}
        </div>
        {entry.type === "drawing" && (
          <p className="text-xs text-gray-600 line-clamp-2">{entry.data.prompt}</p>
        )}
        {entry.type === "photo" && entry.data.caption && (
          <p className="text-xs text-gray-600 line-clamp-2">{entry.data.caption}</p>
        )}
      </div>
    </button>
  );
}

function Lightbox({
  entry,
  onClose,
}: {
  entry: WonderBookEntry;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <span className="font-semibold text-gray-700">
            {entry.type === "drawing"
              ? "Drawing"
              : entry.type === "reflection"
                ? "Recording"
                : "Photo"}
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-4">
          {(entry.type === "drawing" || entry.type === "photo") && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={entry.data.image_url}
              alt=""
              className="w-full rounded-lg"
            />
          )}
          {entry.type === "reflection" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <span className="text-6xl">🎤</span>
              <audio controls src={entry.data.audio_url} className="w-full max-w-md" />
            </div>
          )}
        </div>

        {entry.type === "drawing" && (
          <p className="px-4 pb-4 text-sm text-gray-500">{entry.data.prompt}</p>
        )}
        {entry.type === "photo" && entry.data.caption && (
          <p className="px-4 pb-4 text-sm text-gray-500">{entry.data.caption}</p>
        )}

        <p className="px-4 pb-4 text-xs text-gray-400">
          {new Date(entry.data.created_at).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}

function PhotoUploadModal({
  profileId,
  profiles,
  topics,
  onUploaded,
  onClose,
}: {
  profileId: string;
  profiles: { id: string; name: string }[];
  topics: { id: string; title: string }[];
  onUploaded: () => void;
  onClose: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(profileId);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileBlob = useRef<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileBlob.current = file;
    setPreview(URL.createObjectURL(file));
  }

  async function handleUpload() {
    if (!fileBlob.current) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", fileBlob.current);
    formData.append("profileId", selectedProfile);
    if (selectedTopic) formData.append("topicId", selectedTopic);
    if (caption.trim()) formData.append("caption", caption.trim());

    const res = await fetch("/api/photos", {
      method: "POST",
      body: formData,
    });

    setUploading(false);
    if (res.ok) {
      if (preview) URL.revokeObjectURL(preview);
      onUploaded();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-bold text-gray-800">Upload Photo</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* File input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        {preview ? (
          <button onClick={() => fileRef.current?.click()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="w-full rounded-lg max-h-64 object-cover"
            />
          </button>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-12 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-purple-300 hover:text-purple-400 transition-colors"
          >
            <span className="text-4xl block mb-2">📸</span>
            Tap to take or choose a photo
          </button>
        )}

        {/* Child selector */}
        <label className="text-sm text-gray-600">
          For:
          <select
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            className="ml-2 border rounded-lg px-2 py-1 text-sm"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {/* Topic selector */}
        <label className="text-sm text-gray-600">
          Topic:
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="ml-2 border rounded-lg px-2 py-1 text-sm"
          >
            <option value="">None</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>

        {/* Caption */}
        <input
          type="text"
          placeholder="Add a caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!fileBlob.current || uploading}
          className="w-full bg-green-500 text-white font-semibold py-3 rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>
    </div>
  );
}
