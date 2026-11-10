import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { socket } from "../utils/socket";
import { isChatOpen } from "../utils/chatOpenRegistry";

const MAX_ALERTS = 3;
const AUTO_HIDE_MS = 7000;
const bare = (s) => String(s || "").split(":").pop();

const initialsOf = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (
    (parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
};

const ChatAlertItem = memo(function ChatAlertItem({ item, onClose, onReply }) {
  const [paused, setPaused] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const t = setTimeout(() => onClose(item.key), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [paused, item.key, onClose]);

  return (
    <div
      role="alert"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ animation: "chatAlertIn .3s cubic-bezier(.22,1,.36,1) both" }}
      className="pointer-events-auto relative grid grid-cols-[32px_1fr] gap-x-3 rounded-xl border border-slate-200 bg-white p-3.5 pr-9 text-slate-900 shadow-xl ring-1 ring-black/5"
    >
      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-indigo-100 text-xs font-bold text-indigo-700">
        {item.image && !imgFailed ? (
          <img
            src={item.image}
            alt={item.name}
            onError={() => setImgFailed(true)}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          initialsOf(item.name)
        )}
      </span>

      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="truncate">{item.name}</span>
          <span className="truncate font-normal text-slate-500">
            sent you a message
          </span>
        </p>
        <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">
          &quot;{item.text}&quot;
        </p>

        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => onClose(item.key)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => onReply(item)}
            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Reply
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onClose(item.key)}
        aria-label="Close"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <X size={14} />
      </button>
    </div>
  );
});

/**
 * Shows an alert when a chat message arrives and that chat is NOT open.
 * role: "fresher" | "mentor"
 * getMyId: function returning my user id (fresher only, to ignore my own messages)
 */
export default function ChatAlertHost({ role, getMyId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const seen = useRef(new Set());
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const close = useCallback(
    (key) => setItems((prev) => prev.filter((i) => i.key !== key)),
    [],
  );

  const reply = useCallback(
    (item) => {
      close(item.key);
      navigate(role === "mentor" ? "/mentor/sessions" : "/Home/my-bookings", {
        state: { openChatId: item.bookingId },
      });
    },
    [close, navigate, role],
  );

  useEffect(() => {
    const onMsg = (m) => {
      if (!m) return;

      // my own message -> no alert
      if (role === "mentor") {
        if (m.senderRole === "mentor") return;
      } else {
        const sid = bare(m.senderId);
        const me = String(getMyId?.() || "");
        if (sid ? sid === me : m.senderRole === "fresher") return;
      }

      // inside the meeting room we do not want to push the user out of the call
      if (/\/meeting\//.test(pathRef.current)) return;

      const ids = [m.requestGroupId, m.bookingId].filter(Boolean).map(String);
      const bookingId = ids[0];
      if (!bookingId) return;

      // that chat is open right now -> no alert
      if (ids.some(isChatOpen)) return;

      const mid = String(m._id || m.id || "");
      if (mid) {
        if (seen.current.has(mid)) return;
        seen.current.add(mid);
      }

      const name =
        m.senderName ||
        m.sender?.name ||
        (m.senderRole === "mentor" ? "Employee" : "Student");

      setItems((prev) =>
        [
          {
            key: mid || `${Date.now()}-${Math.random()}`,
            bookingId,
            name,
            text: String(m.text || ""),
            image: m.sender?.image || m.senderImage || "",
          },
          ...prev,
        ].slice(0, MAX_ALERTS),
      );
    };

    socket.on("chat:message", onMsg);
    return () => socket.off("chat:message", onMsg);
  }, [role, getMyId]);

  if (!items.length) return null;

  return (
    <>
      <style>{`
        @keyframes chatAlertIn {
          from { opacity: 0; transform: translateY(-10px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) { [role="alert"] { animation: none !important; } }
      `}</style>
      <div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {items.map((item) => (
          <ChatAlertItem
            key={item.key}
            item={item}
            onClose={close}
            onReply={reply}
          />
        ))}
      </div>
    </>
  );
}