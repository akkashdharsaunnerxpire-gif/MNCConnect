
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
  Button,
  IconButton,
  InputBase,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import {
  X,
  MessageCircle,
  Reply,
  Eye,
  CheckCheck,
  Send,
  Check,
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
  const [paused, setPaused] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replySent, setReplySent] = useState(false);

  const [readDone, setReadDone] = useState(false);
  const [readLoading, setReadLoading] = useState(false);

  const [actionError, setActionError] = useState("");

  const inputRef = useRef(null);

  useEffect(() => {
    setImgFailed(false);
  }, [item.image]);

  // Keep notification alive while replying
  useEffect(() => {
    if (replyOpen) setPaused(true);
  }, [replyOpen]);

  useEffect(() => {
    if (paused || replyOpen || replySending) return undefined;

    const timer = setTimeout(
      () => onClose(item.key),
      AUTO_HIDE_MS,
    );

    return () => clearTimeout(timer);
  }, [
    paused,
    replyOpen,
    replySending,
    item.key,
    onClose,
  ]);

  useEffect(() => {
    if (replyOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [replyOpen]);

  // ================= OPEN CHAT =================

  const openMessage = () => {
    onView(item);
  };

  // ================= INLINE REPLY =================

  const showReply = () => {
    setReplyOpen((prev) => !prev);
    setActionError("");
  };

  const sendReply = async (e) => {
    e.preventDefault();

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

  // ================= MARK AS READ =================

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

  return (
    <Paper
      elevation={0}
      role="alert"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        if (!replyOpen) setPaused(false);
      }}
      sx={{
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
        p: 1.6,
        borderRadius: "15px",
        border: "1px solid #e5e7eb",
        backgroundColor: "#fff",
        boxShadow: "0 8px 28px rgba(15,23,42,0.13)",
        overflow: "hidden",
        pointerEvents: "auto",
        animation: "chatAlertIn .25s ease-out both",
      }}
    >
      {/* HEADER */}

      <Stack direction="row" alignItems="center" spacing={1}>
        <Avatar
          src={!imgFailed ? item.image || undefined : undefined}
          alt={item.name}
          imgProps={{
            referrerPolicy: "no-referrer",
            onError: () => setImgFailed(true),
          }}
          sx={{
            width: 38,
            height: 38,
            flexShrink: 0,
            bgcolor: "#e8edff",
            color: "#3659c9",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {initialsOf(item.name)}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            noWrap
            sx={{
              fontSize: 13,
              fontWeight: 700,
              color: "#171717",
            }}
          >
            {item.name || "New user"}
          </Typography>

          <Typography sx={{ fontSize: 11, color: "#888" }}>
            sent you a message
          </Typography>
        </Box>

        <IconButton
          size="small"
          aria-label="Close notification"
          onClick={() => onClose(item.key)}
        >
          <X size={16} />
        </IconButton>
      </Stack>

      {/* MESSAGE CLICK -> OPEN CHAT */}

      <Button
        fullWidth
        onClick={openMessage}
        sx={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "flex-start",
          gap: 1,
          mt: 1.5,
          px: 1,
          py: 1,
          borderRadius: "9px",
          backgroundColor: "#f8fafc",
          color: "#475569",
          textAlign: "left",
          textTransform: "none",
          "&:hover": {
            backgroundColor: "#eff6ff",
          },
        }}
      >
        <MessageCircle
          size={14}
          style={{ flexShrink: 0, marginTop: 3 }}
        />

        <Typography
          sx={{
            fontSize: 12,
            lineHeight: 1.6,
            textAlign: "left",
            overflowWrap: "anywhere",
            whiteSpace: "normal",
          }}
        >
          {item.text || "You have received a new message."}
        </Typography>
      </Button>

      {/* ACTION BUTTONS */}

      <Stack direction="row" spacing={1} sx={{ mt: 1.3 }}>
        {/* REPLY BUTTON */}

        <Button
          fullWidth
          size="small"
          onClick={showReply}
          startIcon={<Reply size={14} />}
          sx={{
            height: 33,
            borderRadius: "8px",
            bgcolor: replyOpen ? "#334155" : "#171717",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "none",
            "&:hover": {
              bgcolor: "#333",
            },
          }}
        >
          {replyOpen ? "Cancel" : "Reply"}
        </Button>

        {/* MARK AS READ */}

        <Button
          fullWidth
          size="small"
          onClick={handleMarkRead}
          disabled={readDone || readLoading}
          startIcon={
            <CheckCheck
              size={14}
              color={readDone ? "#2684ff" : "currentColor"}
            />
          }
          sx={{
            height: 33,
            borderRadius: "8px",
            border: "1px solid #dbe3ef",
            color: readDone ? "#2684ff" : "#475569",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "none",
          }}
        >
          {readLoading
            ? "Reading..."
            : readDone
              ? "Read"
              : "Mark as read"}
        </Button>

        {/* VIEW */}

        <Button
          size="small"
          onClick={openMessage}
          startIcon={<Eye size={14} />}
          sx={{
            height: 33,
            minWidth: 65,
            borderRadius: "8px",
            color: "#475569",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "none",
          }}
        >
          View
        </Button>
      </Stack>

      {/* INLINE REPLY BOX - NO CHAT PANEL */}

      {replyOpen && (
        <Box
          component="form"
          onSubmit={sendReply}
          sx={{
            mt: 1.5,
            p: 1,
            borderRadius: "11px",
            border: "1px solid #dbe3ef",
            backgroundColor: "#f8fafc",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <InputBase
              inputRef={inputRef}
              fullWidth
              multiline
              maxRows={3}
              value={replyText}
              onChange={(e) =>
                setReplyText(e.target.value.slice(0, MAX_LEN))
              }
              placeholder="Type your reply..."
              disabled={replySending}
              sx={{
                px: 1,
                py: 0.7,
                fontSize: 13,
                backgroundColor: "#fff",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
              }}
            />

            <IconButton
              type="submit"
              disabled={!replyText.trim() || replySending}
              sx={{
                width: 38,
                height: 38,
                flexShrink: 0,
                bgcolor: "#171717",
                color: "#fff",
                "&:hover": { bgcolor: "#333" },
                "&.Mui-disabled": {
                  bgcolor: "#cbd5e1",
                  color: "#fff",
                },
              }}
              aria-label="Send reply"
            >
              <Send size={16} />
            </IconButton>
          </Stack>

          <Typography
            sx={{
              fontSize: 10,
              color: "#94a3b8",
              mt: 0.7,
              textAlign: "right",
            }}
          >
            {replyText.length}/{MAX_LEN} · Enter to send
          </Typography>
        </Box>
      )}

      {/* SUCCESS */}

      {replySent && (
        <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 1 }}>
          <Check size={13} color="#16a34a" />
          <Typography sx={{ fontSize: 11, color: "#16a34a" }}>
            Reply sent successfully
          </Typography>
        </Stack>
      )}

      {readDone && (
        <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 1 }}>
          <CheckCheck size={14} color="#2684ff" />
          <Typography sx={{ fontSize: 11, color: "#2684ff" }}>
            Message marked as read
          </Typography>
        </Stack>
      )}

      {actionError && (
        <Typography
          sx={{ mt: 1, fontSize: 11, color: "#dc2626" }}
        >
          {actionError}
        </Typography>
      )}

      {/* AUTO HIDE PROGRESS */}

      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: "3px",
          width: "100%",
          bgcolor: "#eef2ff",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: "100%",
            bgcolor: "#647eea",
            transformOrigin: "left",
            animation: `chatAlertProgress ${AUTO_HIDE_MS}ms linear forwards`,
            animationPlayState:
              paused || replyOpen || replySending ? "paused" : "running",
          }}
        />
      </Box>
    </Paper>
  );
});

// ================= CHAT ALERT HOST =================

export default function ChatAlertHost({ role, getMyId }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [items, setItems] = useState([]);

  const seen = useRef(new Set());

  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const personCache = useRef(new Map());

  // CLOSE ALERT

  const close = useCallback((key) => {
    setItems((prev) =>
      prev.filter((item) => item.key !== key),
    );
  }, []);

  // OPEN CHAT ONLY FOR MESSAGE CLICK / VIEW

  const openChat = useCallback(
    (item) => {
      if (!item?.bookingId) return;

      close(item.key);

      const target =
        role === "mentor"
          ? "/mentor/sessions"
          : "/Home/my-bookings";

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

  const sendReply = useCallback(
    (item, message) => {
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
            if (res?.ok) {
              resolve(res.message);
            } else {
              reject(
                new Error(res?.message || "Could not send reply."),
              );
            }
          },
        );
      });
    },
    [],
  );

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
          if (res?.ok) {
            resolve(res);
          } else {
            reject(
              new Error(res?.message || "Could not mark as read."),
            );
          }
        },
      );
    });
  }, []);

  // ================= COUNTERPART PROFILE =================

  const fetchPerson = useCallback(
    async (bookingId) => {
      if (personCache.current.has(bookingId)) {
        return personCache.current.get(bookingId);
      }

      const call =
        role === "mentor" ? mentorApi : fresherApi;

      const eps =
        role === "mentor"
          ? MENTOR_ENDPOINTS
          : FRESHER_ENDPOINTS;

      const promise = Promise.resolve()
        .then(() =>
          call(`${eps.booking(bookingId)}/counterpart`),
        )
        .then((d) => ({
          name: d?.person?.name || "",
          image: imageFromPerson(d?.person),
        }))
        .catch(() => ({
          name: "",
          image: "",
        }));

      personCache.current.set(bookingId, promise);

      return promise;
    },
    [role],
  );

  // ================= SOCKET MESSAGE LISTENER =================

  useEffect(() => {
    const onMsg = (m) => {
      if (!m) return;

      // IGNORE MY OWN MESSAGES

      if (role === "mentor") {
        if (m.senderRole === "mentor") return;
      } else {
        const senderId = bare(m.senderId);
        const myId = bare(getMyId?.());

        if (
          senderId
            ? senderId === myId
            : m.senderRole === "fresher"
        ) {
          return;
        }
      }

      // IGNORE MEETING ROOM

      if (/\/meeting(?:\/|$)/i.test(pathRef.current)) {
        return;
      }

      const ids = [
        m.requestGroupId,
        m.bookingId,
      ]
        .filter(Boolean)
        .map(String);

      const bookingId = ids[0];

      if (!bookingId) return;

      // IGNORE OPEN CHAT

      if (ids.some(isChatOpen)) return;

      // DUPLICATE PREVENTION

      const mid = String(m._id || m.id || "");

      if (mid) {
        if (seen.current.has(mid)) return;
        seen.current.add(mid);
      }

      const name =
        m.senderName ||
        m.sender?.name ||
        (m.senderRole === "mentor"
          ? "Employee"
          : "Student");

      const image = imageFromMessage(m);

      const key =
        mid || `${Date.now()}-${Math.random()}`;

      const item = {
        key,
        bookingId,
        messageId: mid,
        name,
        text: String(m.text || ""),
        image,
      };

      setItems((prev) =>
        [item, ...prev].slice(0, MAX_ALERTS),
      );

      // PROFILE PHOTO FALLBACK

      if (!image) {
        fetchPerson(bookingId).then((person) => {
          if (!person?.image) return;

          if (
            m.senderName &&
            person.name &&
            person.name !== m.senderName
          ) {
            return;
          }

          setItems((prev) =>
            prev.map((it) =>
              it.key === key
                ? { ...it, image: person.image }
                : it,
            ),
          );
        });
      }
    };

    socket.on("chat:message", onMsg);

    return () => {
      socket.off("chat:message", onMsg);
    };
  }, [role, getMyId, fetchPerson]);

  if (!items.length) return null;

  return (
    <>
      <style>
        {`
          @keyframes chatAlertIn {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes chatAlertProgress {
            from {
              transform: scaleX(1);
            }
            to {
              transform: scaleX(0);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            [role="alert"] {
              animation: none !important;
            }
          }
        `}
      </style>

      <Box
        sx={{
          position: "fixed",
          top: { xs: 12, sm: 15 },
          right: { xs: 10, sm: 18 },
          zIndex: 20000,
          width: {
            xs: "calc(100% - 20px)",
            sm: "425px",
          },
          maxWidth: "425px",
          display: "flex",
          flexDirection: "column",
          gap: 1,
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
