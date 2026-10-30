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

const MessageRow = memo(function MessageRow({
  m,
  mine,
  firstInGroup,
  lastInGroup,
}) {
  const big = isEmojiOnly(m.text);

  return (
    <div
      className={`flex w-full ${mine ? "justify-end" : "justify-start"} ${
        firstInGroup ? "mt-3" : "mt-0.5"
      }`}
    >
      <div
        className={`max-w-[80%] px-3 py-1.5 text-sm text-slate-900 shadow-sm ${
          mine
            ? `bg-[#d9fdd3] ${
                lastInGroup ? "rounded-2xl rounded-tr-md" : "rounded-2xl"
              }`
            : `bg-white ${
                lastInGroup ? "rounded-2xl rounded-tl-md" : "rounded-2xl"
              }`
        }`}
      >
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
 * Auth = HttpOnly cookie (credentials: "include" + socket handshake cookie).
 * The old `token` prop is accepted but no longer used.
 */
export default function ChatPanel({
  bookingId,
  role, // "mentor" | "fresher"
  title = "Chat",
  variant = "modal",
  open = true,
  onClose,
  onIncoming,
}) {
  const peerRole = role === "mentor" ? "fresher" : "mentor";

  // mentor and fresher are different roles, so the sender role tells who sent it
  const isMine = useCallback((m) => m.senderRole === role, [role]);

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
    setErr("");
    initialScrollDone.current = false;
    stickToBottom.current = true;
    prevLength.current = 0;
    restoreScroll.current = null;
    loadingOlderRef.current = false;
    readSentRef.current = new Set();
    soundedRef.current = new Set();

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

      if (m.senderRole !== role) {
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

    socket.emit("chat:send", { bookingId, text: t }, (res) => {
      sendingRef.current = false;
      setSending(false);

      if (res?.ok) {
        playSendSound();
        forceScroll.current = true;
        setText("");
        if (res.message) addMessage(res.message);
        requestAnimationFrame(() => {
          if (textareaRef.current) textareaRef.current.style.height = "auto";
          textareaRef.current?.focus();
        });
      } else {
        setErr(res?.message || "Could not send. Try again.");
      }
    });
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

    messages.forEach((m, i) => {
      const dk = dayKey(m.createdAt);
      const side = isMine(m) ? "me" : "peer";

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
        !next ||
        (isMine(next) ? "me" : "peer") !== side ||
        dayKey(next.createdAt) !== dk;

      out.push({
        type: "msg",
        key: String(m._id),
        m,
        mine: side === "me",
        firstInGroup,
        lastInGroup,
      });
      lastSide = side;
    });

    return out;
  }, [messages, isMine]);

  /* ---------------- UI ---------------- */
  const statusText = !joined
    ? "Connecting…"
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
                peerOnline ? "bg-emerald-500" : "bg-slate-300"
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
                  : peerOnline
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
      <div className="relative flex shrink-0 items-end gap-2 border-t border-slate-200 bg-white p-3">
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
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