// src/Commoncomponents/ChatPanel.jsx
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  Check,
  CheckCheck,
  Loader2,
  MessageSquare,
  Reply,
  Send,
  Smile,
  X,
} from "lucide-react";
import { socket } from "../utils/socket";
import EmojiPicker from "./EmojiPicker";
import {
  playSendSound,
  playReceiveSound,
  unlockAudio,
  setChatActive,
} from "../utils/chatSounds";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const MAX_LEN = 1000;
const PAGE_SIZE = 50;

/* ---------------- helpers ---------------- */
const fmtTime = (d) =>
  d
    ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};

const dayLabel = (d) => {
  const x = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(x) === dayKey(today)) return "Today";
  if (dayKey(x) === dayKey(yesterday)) return "Yesterday";

  return x.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// WhatsApp style: "last seen today at 1:21 PM" / "yesterday at ..." / "28 Oct at ..."
const formatLastSeen = (d) => {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";

  const time = x.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const label = dayLabel(x);
  if (label === "Today") return `last seen today at ${time}`;
  if (label === "Yesterday") return `last seen yesterday at ${time}`;
  return `last seen ${x.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })} at ${time}`;
};

// true when message has only 1-6 emojis (no normal text) -> show it big
const isEmojiOnly = (text = "") => {
  const t = text.trim();
  if (!t) return false;
  const pictos = t.match(/\p{Extended_Pictographic}/gu);
  if (!pictos || pictos.length > 6) return false;

  const rest = t
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u200d\ufe0f\u{1F3FB}-\u{1F3FF}\s]/gu, "");
  return rest.length === 0;
};

/* ---------- GROUP helpers: who sent it ---------- */
// name colours (WhatsApp group style) - each person keeps one colour
const NAME_COLORS = [
  "text-rose-600",
  "text-indigo-600",
  "text-amber-600",
  "text-teal-600",
  "text-fuchsia-600",
  "text-sky-600",
  "text-orange-600",
  "text-lime-700",
];

const colorFor = (key = "") => {
  let h = 0;
  const s = String(key);
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
};

// "fresher:123" / "mentor:456" / "123"  ->  "123" / "456" / "123"
const bare = (s) => String(s || "").split(":").pop();

const senderIdOf = (m) => {
  if (!m) return "";
  const raw =
    m.senderId ||
    m.sender?._id ||
    m.sender?.id ||
    (typeof m.sender === "string" ? m.sender : "");
  return bare(raw);
};

// name: from the message itself, else from the live participant list, else a label
const nameFor = (m, names = {}) =>
  m?.senderName ||
  m?.sender?.name ||
  names[senderIdOf(m)] ||
  (m?.senderRole === "mentor" ? "Employee" : "Member");

/**
 * WhatsApp style ticks
 * ✓   grey = sent
 * ✓✓  grey = delivered
 * ✓✓  blue = read
 */
const Ticks = memo(function Ticks({ message }) {
  if (message.readAt) {
    return (
      <CheckCheck size={16} className="text-[#53bdeb]" aria-label="Read" />
    );
  }
  if (message.deliveredAt) {
    return (
      <CheckCheck size={16} className="text-slate-400" aria-label="Delivered" />
    );
  }
  return <Check size={16} className="text-slate-400" aria-label="Sent" />;
});

const initialsOf = (title = "") => {
  const name = title.replace(/^chat with\s+/i, "").trim();
  if (!name) return "?";
  const parts = name.split(/\s+/);
  return (
    (parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
};

/**
 * One chat bubble.
 *  - tap / click the bubble  -> reply to it (WhatsApp style)
 *  - hover reply icon (desktop) does the same
 *  - tap the quoted part     -> jump to the original message
 *  - GROUP: the sender's name is shown on top of every message from others
 * Selecting text (to copy) does NOT trigger reply.
 */
const MessageRow = memo(function MessageRow({
  m,
  mine,
  firstInGroup,
  lastInGroup,
  group,
  senderLabel,
  quoteMine,
  quoteLabel,
  colorKey,
  highlight,
  onReply,
  onJump,
}) {
  const big = isEmojiOnly(m.text);

  const handleReply = () => {
    const sel = typeof window !== "undefined" ? window.getSelection?.() : null;
    if (sel && String(sel).trim()) return; // user is selecting text to copy
    onReply(m);
  };

  const replyBtn = (
    <button
      type="button"
      onClick={() => onReply(m)}
      aria-label="Reply"
      className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 opacity-0 transition hover:bg-white/80 group-hover/row:opacity-100 focus:opacity-100 sm:flex"
    >
      <Reply size={16} />
    </button>
  );

  // GROUP: name above the message (only other people, not me)
  const showName = group && !mine && firstInGroup;
  const isEmployee = m.senderRole === "mentor";

  return (
    <div
      data-mid={String(m._id)}
      className={`group/row flex w-full items-center gap-1 rounded-lg transition-colors duration-500 ${
        mine ? "justify-end" : "justify-start"
      } ${firstInGroup ? "mt-3" : "mt-0.5"} ${
        highlight ? "bg-sky-300/40" : ""
      }`}
    >
      {mine && replyBtn}

      <div
        onClick={handleReply}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleReply()}
        title="Tap to reply"
        className={`max-w-[80%] cursor-pointer select-text px-3 py-1.5 text-sm text-slate-900 shadow-sm ${
          mine
            ? `bg-[#d9fdd3] ${
                lastInGroup ? "rounded-2xl rounded-tr-md" : "rounded-2xl"
              }`
            : `bg-white ${
                lastInGroup ? "rounded-2xl rounded-tl-md" : "rounded-2xl"
              }`
        }`}
      >
        {showName && (
          <p
            className={`mb-0.5 flex items-center gap-1.5 text-[12px] font-semibold ${colorFor(colorKey)}`}
          >
            <span className="truncate">{senderLabel}</span>
            {isEmployee && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-indigo-600">
                Employee
              </span>
            )}
          </p>
        )}

        {m.replyTo && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onJump(m.replyTo.messageId);
            }}
            className={`mb-1 block w-full rounded-lg border-l-4 px-2.5 py-1.5 text-left ${
              mine ? "bg-black/5" : "bg-slate-100"
            } ${quoteMine ? "border-emerald-500" : "border-blue-500"}`}
          >
            <span
              className={`block text-[11px] font-semibold ${
                quoteMine ? "text-emerald-700" : "text-blue-600"
              }`}
            >
              {quoteLabel}
            </span>
            <span className="line-clamp-2 block break-words text-xs text-slate-600">
              {m.replyTo.text}
            </span>
          </button>
        )}

        <p
          className={`whitespace-pre-wrap break-words ${
            big ? "text-4xl leading-tight" : "leading-relaxed"
          }`}
        >
          {m.text}
        </p>
        <div className="mt-0.5 flex items-center justify-end gap-1">
          <span className="text-[10px] text-slate-500">
            {fmtTime(m.createdAt)}
          </span>
          {mine && <Ticks message={m} />}
        </div>
      </div>

      {!mine && replyBtn}
    </div>
  );
});

const DayDivider = memo(function DayDivider({ label }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm">
        {label}
      </span>
    </div>
  );
});

/**
 * variant="modal"  -> centered popup (Sessions / My Bookings "Message" button)
 * variant="panel"  -> right side panel (inside the meeting room). Keep it mounted
 *                     and toggle with `open` so new messages are still received.
 *
 * group={true}     -> GROUP chat: EVERYBODY can write, and the sender's name is
 *                     shown on every message from other people.
 *                     myUserId : my user id (all freshers have the same role)
 *                     names    : { [userId]: "Name" } fallback when the server
 *                                message has no senderName
 * group={false}    -> single chat: no names (only 2 people)
 *
 * Auth = HttpOnly cookie (credentials: "include" + socket handshake cookie).
 */
export default function ChatPanel({
  bookingId,
  role, // "mentor" | "fresher"
  title = "Chat",
  variant = "modal",
  open = true,
  onClose,
  onIncoming,
  group = false,
  myUserId = "",
  names = {},
}) {
  const peerRole = role === "mentor" ? "fresher" : "mentor";
  const peerName = title.replace(/^chat with\s+/i, "").trim() || "Contact";

  // ids of the messages I sent in this chat (works even if the server sends no senderId)
  const mineIdsRef = useRef(new Set());

  // single: the role tells who sent it.
  // group : employee = role, fresher = sender id (all freshers share one role)
  const isMine = useCallback(
    (m) => {
      if (mineIdsRef.current.has(String(m._id))) return true;
      if (!group) return m.senderRole === role;

      if (role === "mentor") return m.senderRole === "mentor";

      const sid = senderIdOf(m);
      if (sid && myUserId) return sid === bare(myUserId);
      return false;
    },
    [group, myUserId, role],
  );
  const isMineRef = useRef(isMine);
  isMineRef.current = isMine;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [joined, setJoined] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState(null);
  const [visible, setVisible] = useState(
    () =>
      typeof document === "undefined" || document.visibilityState === "visible",
  );
  const [err, setErr] = useState("");
  const [showJump, setShowJump] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // reply state
  const [replyTo, setReplyTo] = useState(null); // the message being replied to
  const [highlightId, setHighlightId] = useState(null);
  const highlightTimer = useRef(null);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const sendingRef = useRef(false);
  const readSentRef = useRef(new Set());
  const soundedRef = useRef(new Set());
  const incomingRef = useRef(onIncoming);
  incomingRef.current = onIncoming;

  // latest `open` value for the socket handler (no need to re-subscribe)
  const openRef = useRef(open);
  openRef.current = open;

  const emojiPickerRef = useRef(null);
  const emojiBtnRef = useRef(null);

  const initialScrollDone = useRef(false);
  const stickToBottom = useRef(true);
  const forceScroll = useRef(false);
  const prevLength = useRef(0);
  const loadingOlderRef = useRef(false);
  const restoreScroll = useRef(null);

  const addMessage = useCallback((m) => {
    setMessages((prev) =>
      prev.some((p) => String(p._id) === String(m._id)) ? prev : [...prev, m],
    );
  }, []);

  /* ---------------- reply helpers ---------------- */
  const startReply = useCallback((m) => {
    setReplyTo(m);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const cancelReply = useCallback(() => setReplyTo(null), []);

  // scroll to the original message and flash it
  const jumpTo = useCallback((id) => {
    const el = scrollRef.current?.querySelector(`[data-mid="${id}"]`);
    if (!el) return; // original is older than what is loaded
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightId(String(id));
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 1600);
  }, []);

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  /* ---------------- unlock audio on first user interaction ---------------- */
  useEffect(() => {
    const events = ["pointerdown", "keydown", "touchstart"];
    const handler = () => {
      unlockAudio();
      events.forEach((ev) => window.removeEventListener(ev, handler));
    };
    events.forEach((ev) => window.addEventListener(ev, handler));
    return () =>
      events.forEach((ev) => window.removeEventListener(ev, handler));
  }, []);

  /* ---------------- tell the app this chat is open (no notification sound) ---------------- */
  useEffect(() => {
    if (!bookingId || !open) return undefined;
    setChatActive(bookingId, true);
    return () => setChatActive(bookingId, false);
  }, [bookingId, open]);

  /* ---------------- data + socket ---------------- */
  useEffect(() => {
    if (!bookingId) return undefined;
    let cancelled = false;

    setJoined(false);
    setPeerOnline(false);
    setPeerLastSeen(null);
    setLoading(true);
    setHasMore(false);
    setMessages([]);
    setReplyTo(null);
    setErr("");
    initialScrollDone.current = false;
    stickToBottom.current = true;
    prevLength.current = 0;
    restoreScroll.current = null;
    loadingOlderRef.current = false;
    readSentRef.current = new Set();
    soundedRef.current = new Set();
    mineIdsRef.current = new Set();

    const matches = (m) =>
      [m.bookingId, m.requestGroupId]
        .filter(Boolean)
        .map(String)
        .includes(String(bookingId));

    // 1. history (latest page only) - cookie auth
    fetch(
      `${API_URL}/chat/${encodeURIComponent(bookingId)}?limit=${PAGE_SIZE}`,
      { credentials: "include" },
    )
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.success) {
          setMessages(d.messages || []);
          setHasMore(Boolean(d.hasMore));
        } else {
          setErr(d.message || "Could not load chat.");
        }
      })
      .catch(() => !cancelled && setErr("Could not load chat."))
      .finally(() => !cancelled && setLoading(false));

    // 2. live - the server knows the user from the socket cookie
    const join = () => {
      socket.emit("chat:join", { bookingId }, (res) => {
        if (cancelled) return;
        if (res?.ok) {
          setJoined(true);
          setErr("");
          setPeerOnline(Boolean(res.online?.[peerRole]));
          setPeerLastSeen(res.lastSeen || null);
        } else {
          setErr(res?.message || "Chat unavailable.");
        }
      });
    };

    const onMsg = (m) => {
      if (!matches(m)) return;

      addMessage(m);

      if (!isMineRef.current(m)) {
        const id = String(m._id);
        if (!soundedRef.current.has(id)) {
          soundedRef.current.add(id);
          // panel closed -> the global notification hook plays the ding instead
          if (openRef.current) playReceiveSound();
        }
        incomingRef.current?.(m);
      }
    };

    const onReceipt = (r) => {
      const ids = new Set((r.messageIds || []).map(String));
      if (!ids.size) return;

      setMessages((prev) =>
        prev.map((m) => {
          if (!ids.has(String(m._id))) return m;

          if (r.status === "read") {
            return {
              ...m,
              deliveredAt: m.deliveredAt || r.deliveredAt || r.readAt,
              readAt: r.readAt || m.readAt,
            };
          }

          return { ...m, deliveredAt: r.deliveredAt || m.deliveredAt };
        }),
      );
    };

    const onPresence = (p) => {
      if (!matches(p)) return;
      setPeerOnline(Boolean(p.online?.[peerRole]));
      if (p.lastSeen?.[peerRole]) setPeerLastSeen(p.lastSeen[peerRole]);
    };

    const onDisconnect = () => {
      setJoined(false);
      setPeerOnline(false);
    };

    socket.on("chat:message", onMsg);
    socket.on("chat:receipt", onReceipt);
    socket.on("chat:presence", onPresence);
    socket.on("connect", join);
    socket.on("disconnect", onDisconnect);
    if (!socket.connected) socket.connect();
    else join();

    return () => {
      cancelled = true;
      socket.off("chat:message", onMsg);
      socket.off("chat:receipt", onReceipt);
      socket.off("chat:presence", onPresence);
      socket.off("connect", join);
      socket.off("disconnect", onDisconnect);
      socket.emit("chat:leave", { bookingId });
    };
  }, [bookingId, role, peerRole, addMessage]);

  /* ---------------- load older messages (scroll to top) ---------------- */
  const loadOlder = useCallback(() => {
    if (loadingOlderRef.current || !hasMore || !messages.length) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);

    const before = messages[0].createdAt;

    fetch(
      `${API_URL}/chat/${encodeURIComponent(
        bookingId,
      )}?limit=${PAGE_SIZE}&before=${encodeURIComponent(before)}`,
      { credentials: "include" },
    )
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        const older = d.messages || [];

        if (older.length) {
          const el = scrollRef.current;
          if (el) {
            restoreScroll.current = {
              height: el.scrollHeight,
              top: el.scrollTop,
            };
          }

          setMessages((prev) => {
            const ids = new Set(prev.map((p) => String(p._id)));
            return [...older.filter((m) => !ids.has(String(m._id))), ...prev];
          });
        }

        setHasMore(Boolean(d.hasMore));
      })
      .catch(() => {})
      .finally(() => {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      });
  }, [bookingId, hasMore, messages]);

  /* ---------------- scrolling ---------------- */
  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance < 80;
    stickToBottom.current = atBottom;
    setShowJump(!atBottom);

    if (el.scrollTop < 60) loadOlder();
  };

  useLayoutEffect(() => {
    if (!open || loading) return;

    if (!initialScrollDone.current) {
      scrollToBottom(false);
      initialScrollDone.current = true;
      prevLength.current = messages.length;
      return;
    }

    if (restoreScroll.current) {
      const { height, top } = restoreScroll.current;
      restoreScroll.current = null;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight - height + top;
      prevLength.current = messages.length;
      return;
    }

    if (messages.length === prevLength.current) return;
    prevLength.current = messages.length;

    if (stickToBottom.current || forceScroll.current) {
      scrollToBottom(!forceScroll.current);
      forceScroll.current = false;
    }
  }, [messages, open, loading, scrollToBottom]);

  useLayoutEffect(() => {
    if (open && !loading) {
      scrollToBottom(false);
      stickToBottom.current = true;
      setShowJump(false);
    }
  }, [open, loading, scrollToBottom]);

  /* ---------------- is this tab visible? (read only when the user can see it) ---------------- */
  useEffect(() => {
    const update = () =>
      setVisible(document.visibilityState === "visible" && document.hasFocus());
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);

  /* ---------------- read receipts (blue ticks) ---------------- */
  useEffect(() => {
    if (!open || !joined || !visible) return;

    const unread = messages
      .filter(
        (m) =>
          !isMine(m) && !m.readAt && !readSentRef.current.has(String(m._id)),
      )
      .map((m) => String(m._id));

    if (!unread.length) return;

    unread.forEach((id) => readSentRef.current.add(id));

    socket.emit("chat:read", { bookingId, messageIds: unread }, (res) => {
      if (!res?.ok) {
        unread.forEach((id) => readSentRef.current.delete(id));
      }
    });
  }, [messages, open, joined, visible, isMine, bookingId]);

  /* ---------------- modal: Esc to close ---------------- */
  useEffect(() => {
    if (variant !== "modal" || !onClose) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant, onClose]);

  /* ---------------- emoji picker: outside click / Esc / panel closed ---------------- */
  useEffect(() => {
    if (!showEmoji) return undefined;

    const onDown = (e) => {
      if (
        emojiPickerRef.current?.contains(e.target) ||
        emojiBtnRef.current?.contains(e.target)
      ) {
        return;
      }
      setShowEmoji(false);
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setShowEmoji(false);
      }
    };

    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [showEmoji]);

  useEffect(() => {
    if (!open) setShowEmoji(false);
  }, [open]);

  /* ---------------- sending ---------------- */
  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  };

  const insertEmoji = (emoji) => {
    const el = textareaRef.current;

    if (!el) {
      setText((p) => (p + emoji).slice(0, MAX_LEN));
      return;
    }

    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + emoji + text.slice(end)).slice(
      0,
      MAX_LEN,
    );
    setText(next);

    requestAnimationFrame(() => {
      el.focus();
      const pos = Math.min(start + emoji.length, next.length);
      el.setSelectionRange(pos, pos);
      resizeTextarea();
    });
  };

  const send = () => {
    const t = text.trim();

    if (!t || sendingRef.current || !socket.connected) return;

    unlockAudio();

    sendingRef.current = true;
    setSending(true);
    setErr("");
    setShowEmoji(false);

    socket.emit(
      "chat:send",
      { bookingId, text: t, replyToId: replyTo?._id || null },
      (res) => {
        sendingRef.current = false;
        setSending(false);

        if (res?.ok) {
          playSendSound();
          forceScroll.current = true;
          setText("");
          setReplyTo(null);
          if (res.message) {
            mineIdsRef.current.add(String(res.message._id));
            addMessage(res.message);
          }
          requestAnimationFrame(() => {
            if (textareaRef.current) textareaRef.current.style.height = "auto";
            textareaRef.current?.focus();
          });
        } else {
          setErr(res?.message || "Could not send. Try again.");
        }
      },
    );
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  /* ---------------- group messages by day / sender ---------------- */
  const rows = useMemo(() => {
    const out = [];
    let lastDay = "";
    let lastSide = "";

    // single: "me" / "peer".  group: "me" / one key per person
    const sideOf = (m) =>
      isMine(m) ? "me" : group ? senderIdOf(m) || m.senderRole || "x" : "peer";

    // is the quoted message mine?
    const quoteMineOf = (m) => {
      const r = m.replyTo;
      if (!r) return false;
      if (!group) return r.senderRole === role;
      if (role === "mentor") return r.senderRole === "mentor";
      const sid = bare(r.senderId);
      return Boolean(sid && myUserId && sid === bare(myUserId));
    };

    messages.forEach((m, i) => {
      const dk = dayKey(m.createdAt);
      const side = sideOf(m);

      if (dk !== lastDay) {
        out.push({
          type: "day",
          key: `day-${dk}`,
          label: dayLabel(m.createdAt),
        });
        lastDay = dk;
        lastSide = "";
      }

      const next = messages[i + 1];
      const firstInGroup = side !== lastSide;
      const lastInGroup =
        !next || sideOf(next) !== side || dayKey(next.createdAt) !== dk;

      const quoteMine = quoteMineOf(m);
      const senderLabel = nameFor(m, names);

      out.push({
        type: "msg",
        key: String(m._id),
        m,
        mine: side === "me",
        firstInGroup,
        lastInGroup,
        senderLabel,
        colorKey: senderIdOf(m) || senderLabel,
        quoteMine,
        quoteLabel: quoteMine
          ? "You"
          : group
            ? nameFor(m.replyTo, names)
            : peerName,
      });
      lastSide = side;
    });

    return out;
  }, [messages, isMine, group, names, role, myUserId, peerName]);

  /* ---------------- UI ---------------- */
  const statusText = !joined
    ? "Connecting…"
    : group
      ? "Group chat · everyone in this session"
      : peerOnline
        ? "Online"
        : formatLastSeen(peerLastSeen) || "Offline";

  const body = (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
            {initialsOf(title)}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                group
                  ? joined
                    ? "bg-emerald-500"
                    : "bg-slate-300"
                  : peerOnline
                    ? "bg-emerald-500"
                    : "bg-slate-300"
              }`}
            />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {title}
            </h3>
            <p
              className={`flex items-center gap-1 text-[11px] font-medium ${
                !joined
                  ? "text-slate-400"
                  : group || peerOnline
                    ? "text-emerald-600"
                    : "text-slate-400"
              }`}
              aria-live="polite"
            >
              {!joined && <Loader2 size={10} className="animate-spin" />}
              {statusText}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto bg-[#efeae2] px-4 py-4"
          style={{ overscrollBehavior: "contain" }}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center text-slate-400">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/70">
                <MessageSquare size={24} className="text-blue-500" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700">
                No messages yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Send a message to start the conversation.
              </p>
            </div>
          ) : (
            <>
              {loadingOlder && (
                <div className="flex justify-center py-2 text-slate-400">
                  <Loader2 className="animate-spin" size={16} />
                </div>
              )}

              {rows.map((row) =>
                row.type === "day" ? (
                  <DayDivider key={row.key} label={row.label} />
                ) : (
                  <MessageRow
                    key={row.key}
                    m={row.m}
                    mine={row.mine}
                    firstInGroup={row.firstInGroup}
                    lastInGroup={row.lastInGroup}
                    group={group}
                    senderLabel={row.senderLabel}
                    colorKey={row.colorKey}
                    quoteMine={row.quoteMine}
                    quoteLabel={row.quoteLabel}
                    highlight={highlightId === row.key}
                    onReply={startReply}
                    onJump={jumpTo}
                  />
                ),
              )}
            </>
          )}
        </div>

        {showJump && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            aria-label="Scroll to latest message"
            className="absolute bottom-3 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:bg-slate-50"
          >
            <ArrowDown size={16} />
          </button>
        )}
      </div>

      {err && (
        <p className="shrink-0 border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
          {err}
        </p>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-slate-200 bg-white">
        {/* replying to ... */}
        {replyTo && (
          <div className="px-3 pt-3">
            <div
              className={`flex items-center gap-2 rounded-xl border-l-4 bg-slate-50 px-3 py-2 ${
                isMine(replyTo) ? "border-emerald-500" : "border-blue-500"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[11px] font-semibold ${
                    isMine(replyTo) ? "text-emerald-700" : "text-blue-600"
                  }`}
                >
                  {isMine(replyTo)
                    ? "You"
                    : group
                      ? nameFor(replyTo, names)
                      : peerName}
                </p>
                <p className="truncate text-xs text-slate-600">
                  {replyTo.text}
                </p>
              </div>
              <button
                type="button"
                onClick={cancelReply}
                aria-label="Cancel reply"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        <div className="relative flex items-end gap-2 p-3">
          {showEmoji && (
            <EmojiPicker pickerRef={emojiPickerRef} onPick={insertEmoji} />
          )}

          <button
            ref={emojiBtnRef}
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            aria-label="Emoji"
            aria-expanded={showEmoji}
            className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full transition ${
              showEmoji
                ? "bg-blue-50 text-blue-600"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            }`}
          >
            <Smile size={22} />
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              resizeTextarea();
            }}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_LEN}
            placeholder="Type a message…"
            className="max-h-28 min-h-[42px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />

          <button
            type="button"
            onClick={send}
            disabled={!text.trim() || sending}
            aria-label="Send"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Send size={17} />
            )}
          </button>
        </div>
      </div>
    </>
  );

  if (variant === "panel") {
    return (
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-full flex-col bg-white shadow-2xl sm:w-96 ${
          open ? "flex" : "hidden"
        }`}
      >
        {body}
      </aside>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="flex h-[75vh] max-h-[640px] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        {body}
      </div>
    </div>
  );
}