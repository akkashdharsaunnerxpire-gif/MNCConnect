import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useLocation, useNavigate } from "react-router-dom";

import {
  Avatar,
  Box,
  ButtonBase,
  CircularProgress,
  IconButton,
  InputBase,
  Stack,
  Typography,
} from "@mui/material";

import {
  X,
  Reply,
  CheckCheck,
  Send,
  Check,
  ArrowUpRight,
} from "lucide-react";

import { socket } from "../utils/socket";
import { isChatOpen } from "../utils/chatOpenRegistry";

import {
  api as fresherApi,
  ENDPOINTS as FRESHER_ENDPOINTS,
} from "../services/fresherApi";

import {
  api as mentorApi,
  ENDPOINTS as MENTOR_ENDPOINTS,
} from "../services/mentorApi";

// ================= CONFIG =================

const MAX_ALERTS = 3;
const AUTO_HIDE_MS = 7000;
const MAX_LEN = 1000;
const MAX_SEEN = 300;

// Site theme (same as the mentor portal): blue-600 primary, slate neutrals
const ACCENT = "#2563eb";
const ACCENT_DARK = "#1d4ed8";
const ACCENT_SOFT = "#eff6ff";
const ACCENT_LINE = "#bfdbfe";

const bare = (s) => String(s || "").split(":").pop();

const initialsOf = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (
    (parts[0][0] || "") +
    (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
};

const imageFromMessage = (m) =>
  m?.senderImage ||
  m?.senderProfilePic ||
  m?.senderPic ||
  m?.sender?.profilePic ||
  m?.sender?.image ||
  m?.sender?.avatar ||
  m?.sender?.photo ||
  m?.profilePic ||
  m?.image ||
  "";

const imageFromPerson = (p) =>
  p?.profilePic || p?.image || p?.avatar || p?.photo || "";

// ================= NOTIFICATION ITEM =================

const ChatAlertItem = memo(function ChatAlertItem({
  item,
  onClose,
  onView,
  onReply,
  onMarkRead,
}) {
  const [hovered, setHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replySent, setReplySent] = useState(false);

  const [readDone, setReadDone] = useState(false);
  const [readLoading, setReadLoading] = useState(false);

  const [actionError, setActionError] = useState("");

  const inputRef = useRef(null);


  // Single source of truth for pausing the auto-hide.
  const paused = hovered || replyOpen || replySending;

  useEffect(() => {
    setImgFailed(false);
  }, [item.image]);

  useEffect(() => {
    if (replyOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [replyOpen]);

  const toggleReply = () => {
    setReplyOpen((prev) => !prev);
    setActionError("");
  };

  const sendReply = async (e) => {
    e?.preventDefault?.();

    const message = replyText.trim();
    if (!message || replySending || replySent) return;

    setReplySending(true);
    setActionError("");

    try {
      await onReply(item, message);
      setReplyText("");
      setReplySent(true);
      setReplyOpen(false);
    } catch (error) {
      setActionError(error?.message || "Message could not be sent.");
    } finally {
      setReplySending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      sendReply(e);
    } else if (e.key === "Escape") {
      setReplyOpen(false);
    }
  };

  const handleMarkRead = async () => {
    if (readDone || readLoading) return;

    setReadLoading(true);
    setActionError("");

    try {
      await onMarkRead(item);
      setReadDone(true);
    } catch (error) {
      setActionError(error?.message || "Could not mark as read.");
    } finally {
      setReadLoading(false);
    }
  };

  const pillSx = {
    height: 32,
    px: 1.4,
    gap: 0.6,
    borderRadius: "999px",
    fontSize: 12,
    fontWeight: 600,
    transition: "background-color .15s, color .15s, border-color .15s",
    "&:focus-visible": {
      outline: `2px solid ${ACCENT}`,
      outlineOffset: 2,
    },
    "&.Mui-disabled": { opacity: 0.7 },
  };

  return (
    <Box
      role="alert"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
        p: 1.75,
        pt: 1.5,
        borderRadius: "18px",
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow:
          "0 1px 2px rgba(16,24,40,.05), 0 14px 32px -8px rgba(16,24,40,.22)",
        overflow: "hidden",
        pointerEvents: "auto",
        fontFamily: "inherit",
        "& .MuiTypography-root, & .MuiInputBase-root, & .MuiButtonBase-root": {
          fontFamily: "inherit",
        },
        animation: "chatAlertIn .32s cubic-bezier(.2,.9,.3,1.1) both",
      }}
    >
      {/* HEADER */}
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <Box
          sx={{
            p: "2px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #2563eb, #06b6d4)",
            flexShrink: 0,
          }}
        >
          <Avatar
            src={!imgFailed ? item.image || undefined : undefined}
            alt={item.name}
            imgProps={{
              referrerPolicy: "no-referrer",
              onError: () => setImgFailed(true),
            }}
            sx={{
              width: 40,
              height: 40,
              border: "2px solid #fff",
              bgcolor: ACCENT_SOFT,
              color: ACCENT,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {initialsOf(item.name)}
          </Avatar>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            noWrap
            sx={{
              fontSize: 14,
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.25,
            }}
          >
            {item.name || "New user"}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#64748b", lineHeight: 1.3 }}>
            sent you a message · just now
          </Typography>
        </Box>

        <IconButton
          size="small"
          aria-label="Dismiss notification"
          onClick={() => onClose(item.key)}
          sx={{
            color: "#94a3b8",
            "&:hover": { color: "#0f172a", bgcolor: "#f1f5f9" },
          }}
        >
          <X size={16} />
        </IconButton>
      </Stack>

      {/* MESSAGE BUBBLE — click opens the chat */}
      <ButtonBase
        onClick={() => onView(item)}
        aria-label="Open conversation"
        sx={{
          display: "block",
          width: "100%",
          mt: 1.4,
          px: 1.5,
          py: 1.1,
          textAlign: "left",
          borderRadius: "4px 16px 16px 16px",
          backgroundColor: ACCENT_SOFT,
          border: `1px solid ${ACCENT_LINE}`,
          transition: "border-color .15s",
          "&:hover": { borderColor: ACCENT },
          "&:hover .open-hint": { opacity: 1 },
          "&:focus-visible": {
            outline: `2px solid ${ACCENT}`,
            outlineOffset: 2,
          },
        }}
      >
        <Typography
          sx={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "#1e293b",
            overflowWrap: "anywhere",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            pr: 2.5,
          }}
        >
          {item.text || "You have received a new message."}
        </Typography>

        <Box
          className="open-hint"
          sx={{
            position: "absolute",
            right: 10,
            top: 8,
            opacity: 0.45,
            color: ACCENT,
            display: "flex",
            transition: "opacity .15s",
          }}
        >
          <ArrowUpRight size={15} />
        </Box>
      </ButtonBase>

      {/* ACTIONS */}
      <Stack direction="row" spacing={0.9} alignItems="center" sx={{ mt: 1.4 }}>
        <ButtonBase
          onClick={toggleReply}
          aria-expanded={replyOpen}
          sx={{
            ...pillSx,
            bgcolor: replyOpen ? "#f1f5f9" : ACCENT,
            color: replyOpen ? "#334155" : "#fff",
            "&:hover": { bgcolor: replyOpen ? "#e2e8f0" : ACCENT_DARK },
          }}
        >
          <Reply size={14} />
          {replyOpen ? "Cancel" : "Reply"}
        </ButtonBase>

        <ButtonBase
          onClick={handleMarkRead}
          disabled={readDone || readLoading}
          sx={{
            ...pillSx,
            border: "1px solid",
            borderColor: readDone ? "#bfdbfe" : "#e2e8f0",
            bgcolor: readDone ? "#eff6ff" : "#fff",
            color: readDone ? "#2563eb" : "#475569",
            "&:hover": { bgcolor: readDone ? "#eff6ff" : "#f8fafc" },
          }}
        >
          {readLoading ? (
            <CircularProgress size={13} thickness={5} color="inherit" />
          ) : (
            <CheckCheck size={14} />
          )}
          {readDone ? "Read" : "Mark as read"}
        </ButtonBase>

        <Box sx={{ flex: 1 }} />

        <ButtonBase
          onClick={() => onView(item)}
          sx={{
            ...pillSx,
            color: ACCENT,
            "&:hover": { bgcolor: ACCENT_SOFT },
          }}
        >
          Open chat
        </ButtonBase>
      </Stack>

      {/* INLINE REPLY */}
      {replyOpen && (
        <Box
          component="form"
          onSubmit={sendReply}
          sx={{ mt: 1.4, animation: "chatAlertIn .2s ease-out both" }}
        >
          <Stack
            direction="row"
            alignItems="flex-end"
            spacing={0.75}
            sx={{
              pl: 1.5,
              pr: 0.6,
              py: 0.6,
              borderRadius: "22px",
              border: `1.5px solid ${ACCENT_LINE}`,
              bgcolor: "#fff",
              transition: "border-color .15s",
              "&:focus-within": { borderColor: ACCENT },
            }}
          >
            <InputBase
              inputRef={inputRef}
              fullWidth
              multiline
              maxRows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={onKeyDown}
              placeholder={`Reply to ${item.name || "this message"}`}
              disabled={replySending}
              inputProps={{ "aria-label": "Reply message" }}
              sx={{ fontSize: 13.5, py: 0.6, color: "#0f172a" }}
            />

            <IconButton
              type="submit"
              aria-label="Send reply"
              disabled={!replyText.trim() || replySending}
              sx={{
                width: 34,
                height: 34,
                flexShrink: 0,
                bgcolor: ACCENT,
                color: "#fff",
                "&:hover": { bgcolor: ACCENT_DARK },
                "&.Mui-disabled": { bgcolor: "#e2e8f0", color: "#94a3b8" },
              }}
            >
              {replySending ? (
                <CircularProgress size={15} thickness={5} color="inherit" />
              ) : (
                <Send size={15} />
              )}
            </IconButton>
          </Stack>

          <Typography
            sx={{ fontSize: 11, color: "#94a3b8", mt: 0.6, textAlign: "right" }}
          >
            Enter to send · Shift+Enter for a new line · {replyText.length}/
            {MAX_LEN}
          </Typography>
        </Box>
      )}

      {/* STATUS */}
      {replySent && (
        <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 1.1 }}>
          <Check size={14} color="#10b981" />
          <Typography sx={{ fontSize: 12, color: "#047857", fontWeight: 600 }}>
            Reply sent
          </Typography>
        </Stack>
      )}

      {actionError && (
        <Typography
          role="status"
          sx={{ mt: 1, fontSize: 12, color: "#dc2626", fontWeight: 500 }}
        >
          {actionError}
        </Typography>
      )}

      {/* AUTO-HIDE PROGRESS — also drives the close, so pause and
          timer can never go out of sync */}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: "3px",
          width: "100%",
          bgcolor: ACCENT_SOFT,
        }}
      >
        <Box
          onAnimationEnd={() => onClose(item.key)}
          sx={{
            height: "100%",
            width: "100%",
            bgcolor: ACCENT,
            transformOrigin: "left",
            animation: `chatAlertProgress ${AUTO_HIDE_MS}ms linear forwards`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      </Box>
    </Box>
  );
});

// ================= CHAT ALERT HOST =================

export default function ChatAlertHost({ role, getMyId }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [items, setItems] = useState([]);

  const seen = useRef(new Set());
  const personCache = useRef(new Map());

  // Keep latest values in refs so the socket listener is not
  // re-subscribed on every render.
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const getMyIdRef = useRef(getMyId);
  getMyIdRef.current = getMyId;

  const close = useCallback((key) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const openChat = useCallback(
    (item) => {
      if (!item?.bookingId) return;

      close(item.key);

      const target =
        role === "mentor" ? "/mentor/sessions" : "/Home/my-bookings";

      navigate(target, {
        state: {
          openChatId: String(item.bookingId),
          openChatAction: true,
        },
      });
    },
    [close, navigate, role],
  );

  // ================= INLINE REPLY SEND =================

  const sendReply = useCallback((item, message) => {
    return new Promise((resolve, reject) => {
      if (!item?.bookingId || !message?.trim()) {
        reject(new Error("Invalid message."));
        return;
      }

      if (!socket.connected) {
        reject(new Error("Connection lost. Please try again."));
        return;
      }

      socket.emit(
        "chat:send",
        {
          bookingId: String(item.bookingId),
          text: message.trim(),
          replyToId: item.messageId || null,
        },
        (res) => {
          if (res?.ok) resolve(res.message);
          else reject(new Error(res?.message || "Could not send reply."));
        },
      );
    });
  }, []);

  // ================= MARK AS READ =================

  const markRead = useCallback((item) => {
    return new Promise((resolve, reject) => {
      if (!item?.bookingId || !item?.messageId) {
        reject(new Error("Message ID is unavailable."));
        return;
      }

      if (!socket.connected) {
        reject(new Error("Connection lost. Please try again."));
        return;
      }

      socket.emit(
        "chat:read",
        {
          bookingId: String(item.bookingId),
          messageIds: [String(item.messageId)],
        },
        (res) => {
          if (res?.ok) resolve(res);
          else reject(new Error(res?.message || "Could not mark as read."));
        },
      );
    });
  }, []);

  // ================= COUNTERPART PROFILE =================

  const fetchPerson = useCallback(
    (bookingId) => {
      if (personCache.current.has(bookingId)) {
        return personCache.current.get(bookingId);
      }

      const call = role === "mentor" ? mentorApi : fresherApi;
      const eps = role === "mentor" ? MENTOR_ENDPOINTS : FRESHER_ENDPOINTS;

      const promise = Promise.resolve()
        .then(() => call(`${eps.booking(bookingId)}/counterpart`))
        .then((d) => ({
          name: d?.person?.name || "",
          image: imageFromPerson(d?.person),
        }))
        .catch(() => {
          // Do not cache failures — allow a retry next time.
          personCache.current.delete(bookingId);
          return { name: "", image: "" };
        });

      personCache.current.set(bookingId, promise);
      return promise;
    },
    [role],
  );

  // ================= SOCKET MESSAGE LISTENER =================

  useEffect(() => {
    const onMsg = (m) => {
      if (!m) return;

      // Ignore my own messages
      if (role === "mentor") {
        if (m.senderRole === "mentor") return;
      } else {
        const senderId = bare(m.senderId);
        const myId = bare(getMyIdRef.current?.());

        if (senderId ? senderId === myId : m.senderRole === "fresher") {
          return;
        }
      }

      // Ignore while inside a meeting room
      if (/\/meeting(?:\/|$)/i.test(pathRef.current)) return;

      const ids = [m.requestGroupId, m.bookingId].filter(Boolean).map(String);
      const bookingId = ids[0];

      if (!bookingId) return;

      // Ignore if that chat is already open
      if (ids.some(isChatOpen)) return;

      // Duplicate prevention (bounded so it cannot grow forever)
      const mid = String(m._id || m.id || "");

      if (mid) {
        if (seen.current.has(mid)) return;
        seen.current.add(mid);

        if (seen.current.size > MAX_SEEN) {
          const oldest = seen.current.values().next().value;
          seen.current.delete(oldest);
        }
      }

      const name =
        m.senderName ||
        m.sender?.name ||
        (m.senderRole === "mentor" ? "Employee" : "Student");

      const image = imageFromMessage(m);
      const key = mid || `${Date.now()}-${Math.random()}`;

      const item = {
        key,
        bookingId,
        messageId: mid,
        name,
        text: String(m.text || ""),
        image,
      };

      setItems((prev) => [item, ...prev].slice(0, MAX_ALERTS));

      // Profile photo fallback
      if (!image) {
        fetchPerson(bookingId).then((person) => {
          if (!person?.image) return;

          if (m.senderName && person.name && person.name !== m.senderName) {
            return;
          }

          setItems((prev) =>
            prev.map((it) =>
              it.key === key ? { ...it, image: person.image } : it,
            ),
          );
        });
      }
    };

    socket.on("chat:message", onMsg);

    return () => {
      socket.off("chat:message", onMsg);
    };
  }, [role, fetchPerson]);

  if (!items.length) return null;

  return (
    <>
      <style>
        {`
          @keyframes chatAlertIn {
            from { opacity: 0; transform: translateY(-10px) scale(.98); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }

          @keyframes chatAlertProgress {
            from { transform: scaleX(1); }
            to   { transform: scaleX(0); }
          }

          @media (prefers-reduced-motion: reduce) {
            [role="alert"] { animation: none !important; }
          }
        `}
      </style>

      <Box
        aria-live="polite"
        sx={{
          position: "fixed",
          top: { xs: 12, sm: 16 },
          right: { xs: 10, sm: 18 },
          zIndex: 20000,
          width: { xs: "calc(100% - 20px)", sm: "400px" },
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
          pointerEvents: "none",
        }}
      >
        {items.map((item) => (
          <ChatAlertItem
            key={item.key}
            item={item}
            onClose={close}
            onView={openChat}
            onReply={sendReply}
            onMarkRead={markRead}
          />
        ))}
      </Box>
    </>
  );
}