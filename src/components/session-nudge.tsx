"use client";

import { NudgeLevel } from "@/lib/use-session-timer";

const MESSAGES: Record<NonNullable<NudgeLevel>, { emoji: string; title: string; body: string }> = {
  soft: {
    emoji: "☀️",
    title: "You've been exploring for a while!",
    body: "Want to take a break and try your project?",
  },
  gentle: {
    emoji: "🌙",
    title: "Almost time to wrap up.",
    body: "Want to save your work and tell me about it?",
  },
  firm: {
    emoji: "🌟",
    title: "Great exploring today!",
    body: "Time to go do something with your hands. See you next time!",
  },
};

interface Props {
  nudge: NudgeLevel;
  onDismiss: () => void;
  onOpenRecorder: () => void;
}

export function SessionNudge({ nudge, onDismiss, onOpenRecorder }: Props) {
  if (!nudge) return null;
  const msg = MESSAGES[nudge];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full text-center flex flex-col gap-4">
        <div className="text-5xl">{msg.emoji}</div>
        <h2 className="text-xl font-bold text-gray-800">{msg.title}</h2>
        <p className="text-gray-600">{msg.body}</p>
        <div className="flex flex-col gap-2 mt-2">
          {nudge !== "firm" && (
            <button
              onClick={onDismiss}
              className="py-2.5 px-6 rounded-2xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
            >
              Keep Exploring
            </button>
          )}
          <button
            onClick={() => { onOpenRecorder(); onDismiss(); }}
            className="py-2.5 px-6 rounded-2xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors"
          >
            🎤 Tell Me About It!
          </button>
        </div>
      </div>
    </div>
  );
}
