// src/Commoncomponents/SiteAssistant.jsx
import React, { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Loader2, MessageCircle } from "lucide-react";
import { api } from "../services/fresherApi";

const SUGGESTIONS = [
  "How do I book a session?",
  "செஷன் எப்படி புக் பண்றது?",
  "Refund eppo kedaikum?",
];

const SiteAssistant = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm MNC Assistant 👋 Ask me anything about MNCConnect in any language — English, தமிழ், हिंदी, తెలుగు, മലയാളം, ಕನ್ನಡ… or Tanglish!",
    },
  ]);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;

    const next = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const d = await api("/assistant/chat", {
        method: "POST",
        body: {
          // skip the greeting; send only the real conversation
          messages: next
            .slice(1)
            .map(({ role, content }) => ({ role, content })),
        },
      });
      setMessages((m) => [...m, { role: "assistant", content: d.reply }]);
    } catch (err) {
      console.error("assistant failed:", err);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            err?.message && /busy|login|session/i.test(err.message)
              ? err.message
              : "Sorry, something went wrong. Please try again in a moment. / மன்னிக்கவும், மீண்டும் முயற்சிக்கவும்.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex h-[32rem] max-h-[85vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-5 w-5" /> MNC Assistant
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={500}
              placeholder="Ask in any language..."
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SiteAssistant;
