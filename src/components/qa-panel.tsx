"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface QAPanelProps {
  lessonId: string;
  profileId: string;
  age: number;
  topicTitle: string;
  onClose: () => void;
}

const QUICK_QUESTIONS = ["Why?", "How?", "Tell me more", "What happens if...?"];
const QUESTION_CAP = 5;

export function QAPanel({ lessonId, profileId, age, topicTitle, onClose }: QAPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function ask(question: string) {
    if (!question.trim() || loading || questionsUsed >= QUESTION_CAP) return;

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, profileId, question }),
      });
      const data = await res.json();

      if (data.capped) {
        setQuestionsUsed(QUESTION_CAP);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
        setQuestionsUsed(data.questionsUsed);

        if (age <= 4 && data.answer) {
          const utterance = new SpeechSynthesisUtterance(data.answer);
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const remaining = QUESTION_CAP - questionsUsed;
  const capped = questionsUsed >= QUESTION_CAP;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:w-[480px] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-lg">Ask about {topicTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {messages.length === 0 && (
            <p className="text-gray-400 text-sm text-center mt-4">
              Ask anything about {topicTitle}!
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-purple-500 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-400">
                Thinking...
              </div>
            </div>
          )}
          {capped && (
            <div className="text-center text-sm text-purple-600 bg-purple-50 rounded-xl p-4 mt-2">
              You&apos;ve asked {QUESTION_CAP} great questions! Ready to draw or pick your next topic?
            </div>
          )}
        </div>

        <div className="border-t px-5 py-4 flex flex-col gap-3">
          <div className="text-xs text-gray-400 text-center">
            {capped ? "No questions remaining" : `${remaining} question${remaining === 1 ? "" : "s"} remaining`}
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                disabled={capped || loading}
                onClick={() => ask(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {age > 4 && (
            <form
              onSubmit={(e) => { e.preventDefault(); ask(input); }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={capped || loading}
                placeholder="Type a question..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={!input.trim() || capped || loading}
                className="bg-purple-500 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Ask
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
