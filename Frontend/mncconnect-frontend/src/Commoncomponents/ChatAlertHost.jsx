import React, { memo, useCallback, useEffect, useRef, useState } from "react";
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
import { X, MessageCircle } from "lucide-react";

import { socket } from "../utils/socket";
import { isChatOpen } from "../utils/chatOpenRegistry";
import { api as fresherApi, ENDPOINTS as FRESHER_ENDPOINTS } from "../services/fresherApi";
import { api as mentorApi, ENDPOINTS as MENTOR_ENDPOINTS } from "../services/mentorApi";

// ================= CONFIG =================

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

// every possible place the backend may put the photo (profilePic included)
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
}) {
  const [paused, setPaused] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // new image arrived (fallback fetch) -> try again
  useEffect(() => {
    setImgFailed(false);
  }, [item.image]);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => onClose(item.key), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [paused, item.key, onClose]);

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
        p: "12px 13px 10px",
        borderRadius: "13px",
        border: "1px solid #e5e7eb",
        backgroundColor: "#ffffff",
        boxShadow: "0 5px 22px rgba(15,23,42,0.12)",
        overflow: "hidden",
        pointerEvents: "auto",
        animation: "chatAlertIn .25s ease-out both",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
        <Avatar
          src={!imgFailed ? item.image || undefined : undefined}
          alt={item.name}
          imgProps={{
            referrerPolicy: "no-referrer",
            onError: () => setImgFailed(true),
          }}
          sx={{
            width: 32,
            height: 32,
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
          <Stack direction="row" alignItems="center" spacing={0.7} sx={{ minWidth: 0 }}>
            <Typography
              noWrap
              sx={{ fontSize: 12.5, fontWeight: 700, color: "#171717", maxWidth: "55%" }}
            >
              {item.name || "New user"}
            </Typography>
            <Typography noWrap sx={{ fontSize: 11.5, color: "#888" }}>
              sent you a message
            </Typography>
          </Stack>
        </Box>

        <Button
          size="small"
          onClick={() => onView(item)}
          sx={{
            minWidth: 43,
            height: 27,
            px: 1,
            borderRadius: "7px",
            border: "1px solid #e5e7eb",
            color: "#333",
            fontSize: 10.5,
            fontWeight: 600,
            textTransform: "none",
            "&:hover": { bgcolor: "#f3f4f6" },
          }}
        >
          View
        </Button>

        <Button
          size="small"
          variant="contained"
          onClick={() => onReply(item)}
          sx={{
            minWidth: 47,
            height: 27,
            px: 1,
            borderRadius: "7px",
            bgcolor: "#171717",
            color: "#fff",
            fontSize: 10.5,
            fontWeight: 600,
            textTransform: "none",
            boxShadow: "none",
            "&:hover": { bgcolor: "#333", boxShadow: "none" },
          }}
        >
          Reply
        </Button>

        <IconButton
          size="small"
          aria-label="Close notification"
          onClick={() => onClose(item.key)}
          sx={{
            width: 23,
            height: 23,
            ml: "2px !important",
            color: "#9ca3af",
            "&:hover": { bgcolor: "#fee2e2", color: "#dc2626" },
          }}
        >
          <X size={14} />
        </IconButton>
      </Stack>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.8,
          mt: 1,
          pl: "40px",
          pr: 0.5,
          minWidth: 0,
        }}
      >
        <MessageCircle size={12} color="#94a3b8" style={{ flexShrink: 0 }} />
        <Typography
          noWrap
          sx={{ fontSize: 11.5, color: "#777", lineHeight: 1.5, minWidth: 0 }}
        >
          {item.text || "You have received a new message."}
        </Typography>
      </Box>

      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: "2px",
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

  // bookingId -> { name, image }  (so we call the API only once per chat)
  const personCache = useRef(new Map());

  const close = useCallback((key) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const openChat = useCallback(
    (item) => {
      close(item.key);
      navigate(role === "mentor" ? "/mentor/sessions" : "/Home/my-bookings", {
        state: { openChatId: item.bookingId },
      });
    },
    [close, navigate, role],
  );

  const view = useCallback((item) => openChat(item), [openChat]);
  const reply = useCallback((item) => openChat(item), [openChat]);

  // message has no photo -> get it from the booking's counterpart (profilePic)
  const fetchPerson = useCallback(
    async (bookingId) => {
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
        .catch(() => ({ name: "", image: "" }));

      personCache.current.set(bookingId, promise);
      return promise;
    },
    [role],
  );

  useEffect(() => {
    const onMsg = (m) => {
      if (!m) return;

      // Ignore my own messages
      if (role === "mentor") {
        if (m.senderRole === "mentor") return;
      } else {
        const senderId = bare(m.senderId);
        const myId = bare(getMyId?.());
        if (senderId ? senderId === myId : m.senderRole === "fresher") return;
      }

      // Ignore messages inside the meeting room
      if (/\/meeting(?:\/|$)/i.test(pathRef.current)) return;

      const ids = [m.requestGroupId, m.bookingId].filter(Boolean).map(String);
      const bookingId = ids[0];
      if (!bookingId) return;

      // Ignore already open chat
      if (ids.some(isChatOpen)) return;

      // Duplicate prevention
      const mid = String(m._id || m.id || "");
      if (mid) {
        if (seen.current.has(mid)) return;
        seen.current.add(mid);
      }

      const name =
        m.senderName ||
        m.sender?.name ||
        (m.senderRole === "mentor" ? "Employee" : "Student");

      const image = imageFromMessage(m);
      const key = mid || `${Date.now()}-${Math.random()}`;

      setItems((prev) =>
        [{ key, bookingId, name, text: String(m.text || ""), image }, ...prev].slice(
          0,
          MAX_ALERTS,
        ),
      );

      // photo missing in the socket payload -> fallback fetch
      if (!image) {
        fetchPerson(bookingId).then((person) => {
          if (!person?.image) return;
          // only use it when it is the same person (group chats have many senders)
          if (m.senderName && person.name && person.name !== m.senderName) return;
          setItems((prev) =>
            prev.map((it) =>
              it.key === key ? { ...it, image: person.image } : it,
            ),
          );
        });
      }
    };

    socket.on("chat:message", onMsg);
    return () => socket.off("chat:message", onMsg);
  }, [role, getMyId, fetchPerson]);

  if (!items.length) return null;

  return (
    <>
      <style>
        {`
          @keyframes chatAlertIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes chatAlertProgress {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            [role="alert"] { animation: none !important; }
          }
        `}
      </style>

      <Box
        sx={{
          position: "fixed",
          top: { xs: 12, sm: 15 },
          right: { xs: 10, sm: 18 },
          zIndex: 20000,
          width: { xs: "calc(100% - 20px)", sm: "425px" },
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
          />
        ))}
      </Box>
    </>
  );
}