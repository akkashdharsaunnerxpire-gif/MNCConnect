
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

  useEffect(() => {
    setImgFailed(false);
  }, [item.image]);

  useEffect(() => {
    if (paused) return undefined;

    const timer = setTimeout(
      () => onClose(item.key),
      AUTO_HIDE_MS,
    );

    return () => clearTimeout(timer);
  }, [paused, item.key, onClose]);

  const openMessage = () => onView(item);

  return (
    <Paper
      elevation={0}
      role="alert"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      sx={{
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
        p: "13px",
        borderRadius: "15px",
        border: "1px solid #e5e7eb",
        backgroundColor: "#fff",
        boxShadow: "0 8px 28px rgba(15,23,42,0.13)",
        overflow: "hidden",
        pointerEvents: "auto",
        animation: "chatAlertIn .25s ease-out both",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ minWidth: 0 }}
      >
        <Avatar
          src={!imgFailed ? item.image || undefined : undefined}
          alt={item.name}
          imgProps={{
            referrerPolicy: "no-referrer",
            onError: () => setImgFailed(true),
          }}
          sx={{
            width: 36,
            height: 36,
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

          <Typography
            noWrap
            sx={{ fontSize: 11, color: "#888" }}
          >
            sent you a message
          </Typography>
        </Box>

        <IconButton
          size="small"
          aria-label="Close notification"
          onClick={() => onClose(item.key)}
          sx={{
            width: 25,
            height: 25,
            color: "#9ca3af",
            "&:hover": {
              bgcolor: "#fee2e2",
              color: "#dc2626",
            },
          }}
        >
          <X size={15} />
        </IconButton>
      </Stack>

      {/* CLICK MESSAGE -> OPEN CHAT PANEL */}
      <Button
        fullWidth
        onClick={openMessage}
        aria-label={`Open message from ${item.name}`}
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
          color: "#64748b",
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
            color: "#475569",
            textAlign: "left",
            overflowWrap: "anywhere",
            whiteSpace: "normal",
          }}
        >
          {item.text || "You have received a new message."}
        </Typography>
      </Button>

      {/* ACTION BUTTONS */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 1.3 }}
      >
        <Button
          fullWidth
          size="small"
          onClick={() => onReply(item)}
          startIcon={<Reply size={14} />}
          sx={{
            height: 32,
            borderRadius: "8px",
            bgcolor: "#171717",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "none",
            "&:hover": {
              bgcolor: "#333",
            },
          }}
        >
          Reply
        </Button>

        <Button
          fullWidth
          size="small"
          onClick={() => onMarkRead(item)}
          startIcon={<CheckCheck size={14} />}
          sx={{
            height: 32,
            borderRadius: "8px",
            border: "1px solid #dbe3ef",
            color: "#475569",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "none",
            "&:hover": {
              bgcolor: "#eff6ff",
            },
          }}
        >
          Mark as read
        </Button>

        <Button
          size="small"
          onClick={() => onView(item)}
          startIcon={<Eye size={14} />}
          sx={{
            height: 32,
            minWidth: 65,
            borderRadius: "8px",
            color: "#475569",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "none",
            "&:hover": {
              bgcolor: "#f1f5f9",
            },
          }}
        >
          View
        </Button>
      </Stack>

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
            animationPlayState: paused ? "paused" : "running",
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

  // OPEN CORRECT CHAT PANEL
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

  // REPLY -> OPEN CHAT PANEL
  const reply = useCallback(
    (item) => openChat(item),
    [openChat],
  );

  // VIEW -> OPEN CHAT PANEL
  const view = useCallback(
    (item) => openChat(item),
    [openChat],
  );

  // MARK READ -> OPEN CHAT PANEL
  // ChatPanel sends the actual chat:read socket event.
  const markRead = useCallback(
    (item) => openChat(item),
    [openChat],
  );

  // GET COUNTERPART PROFILE
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

  // LISTEN FOR INCOMING MESSAGES
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

      // IGNORE MEETING ROOM MESSAGES
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

      // IGNORE ALREADY OPEN CHAT
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
            onView={view}
            onReply={reply}
            onMarkRead={markRead}
          />
        ))}
      </Box>
    </>
  );
}
