
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
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

import { socket } from "../utils/socket";
import { isChatOpen } from "../utils/chatOpenRegistry";

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

// ================= SINGLE NOTIFICATION =================

const ChatAlertItem = memo(function ChatAlertItem({
  item,
  onClose,
  onView,
  onReply,
}) {
  const [paused, setPaused] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (paused) return undefined;

    const timer = setTimeout(() => {
      onClose(item.key);
    }, AUTO_HIDE_MS);

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
        overflow: "hidden",
        borderRadius: "20px",
        border: "1px solid rgba(148,163,184,0.22)",
        background:
          "linear-gradient(145deg, #ffffff 0%, #f8faff 65%, #f0f5ff 100%)",
        color: "#0f172a",
        boxShadow:
          "0 20px 55px rgba(15,23,42,0.13), 0 4px 14px rgba(15,23,42,0.05)",
        animation: "chatAlertIn .42s cubic-bezier(.16,1,.3,1) both",
        pointerEvents: "auto",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "3px",
          background:
            "linear-gradient(90deg, #2563eb, #6366f1, #a855f7)",
        },
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2.2, pt: 2, pb: 1.5 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1.8 }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2563eb",
                background: "#eaf1ff",
              }}
            >
              <MessageCircle size={16} />
            </Box>

            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "1.1px",
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              New message
            </Typography>

            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: "#22c55e",
                boxShadow: "0 0 0 3px rgba(34,197,94,0.12)",
              }}
            />
          </Stack>

          <IconButton
            size="small"
            aria-label="Close notification"
            onClick={() => onClose(item.key)}
            sx={{
              width: 29,
              height: 29,
              color: "#94a3b8",
              borderRadius: "9px",
              "&:hover": {
                bgcolor: "#fee2e2",
                color: "#dc2626",
              },
            }}
          >
            <X size={16} />
          </IconButton>
        </Stack>

        {/* Sender */}
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ position: "relative", flexShrink: 0 }}>
            <Avatar
              src={!imgFailed ? item.image || undefined : undefined}
              alt={item.name}
              imgProps={{
                referrerPolicy: "no-referrer",
                onError: () => setImgFailed(true),
              }}
              sx={{
                width: 48,
                height: 48,
                bgcolor: "#e0e7ff",
                color: "#4338ca",
                fontSize: 15,
                fontWeight: 800,
                border: "2px solid white",
                boxShadow: "0 0 0 2px #dbeafe",
              }}
            >
              {initialsOf(item.name)}
            </Avatar>

            <Box
              sx={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 12,
                height: 12,
                borderRadius: "50%",
                bgcolor: "#22c55e",
                border: "2px solid white",
              }}
            />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              noWrap
              sx={{
                fontSize: 14,
                fontWeight: 800,
                color: "#172033",
                letterSpacing: "-0.2px",
              }}
            >
              {item.name || "New user"}
            </Typography>

            <Typography
              sx={{
                mt: 0.35,
                fontSize: 11.5,
                color: "#64748b",
                fontWeight: 500,
              }}
            >
              Sent you a message
            </Typography>
          </Box>

          <Box
            sx={{
              px: 1,
              py: 0.5,
              borderRadius: "8px",
              bgcolor: "#eff6ff",
              color: "#2563eb",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.5px",
              whiteSpace: "nowrap",
            }}
          >
            CHAT
          </Box>
        </Stack>

        {/* Message preview */}
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: "13px",
            background: "rgba(241,245,249,0.85)",
            border: "1px solid rgba(226,232,240,0.8)",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box sx={{ color: "#64748b", mt: 0.1 }}>
              <MessageCircle size={14} />
            </Box>

            <Typography
              sx={{
                fontSize: 12.5,
                lineHeight: 1.65,
                color: "#475569",
                fontWeight: 500,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                wordBreak: "break-word",
              }}
            >
              {item.text || "You have received a new message."}
            </Typography>
          </Stack>
        </Box>

        {/* Actions */}
        <Stack direction="row" spacing={1} sx={{ mt: 1.8 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => onView(item)}
            endIcon={<ArrowUpRight size={14} />}
            sx={{
              height: 38,
              borderRadius: "11px",
              borderColor: "#dbe3ef",
              color: "#334155",
              fontSize: 11.5,
              fontWeight: 700,
              textTransform: "none",
              "&:hover": {
                borderColor: "#93c5fd",
                bgcolor: "#eff6ff",
              },
            }}
          >
            View chat
          </Button>

          <Button
            fullWidth
            variant="contained"
            onClick={() => onReply(item)}
            startIcon={<MessageCircle size={14} />}
            sx={{
              height: 38,
              borderRadius: "11px",
              bgcolor: "#2563eb",
              color: "#fff",
              fontSize: 11.5,
              fontWeight: 800,
              textTransform: "none",
              boxShadow: "0 5px 12px rgba(37,99,235,0.2)",
              "&:hover": {
                bgcolor: "#1d4ed8",
                boxShadow: "0 7px 16px rgba(37,99,235,0.25)",
              },
            }}
          >
            Reply
          </Button>
        </Stack>
      </Box>

      {/* Auto-dismiss progress */}
      <Box
        sx={{
          width: "100%",
          height: 3,
          bgcolor: "#e2e8f0",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: "100%",
            transformOrigin: "left",
            background: "linear-gradient(90deg, #2563eb, #818cf8)",
            animation: `chatAlertProgress ${AUTO_HIDE_MS}ms linear forwards`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      </Box>
    </Paper>
  );
});

// ================= CHAT ALERT HOST =================

/**
 * Displays chat notifications when a message arrives
 * and the corresponding chat is not already open.
 *
 * role: "fresher" | "mentor"
 * getMyId: function returning current fresher user ID
 */

export default function ChatAlertHost({ role, getMyId }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [items, setItems] = useState([]);

  const seen = useRef(new Set());
  const pathRef = useRef(location.pathname);

  pathRef.current = location.pathname;

  // ================= CLOSE =================

  const close = useCallback((key) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  // ================= OPEN CHAT =================

  const openChat = useCallback(
    (item) => {
      close(item.key);

      navigate(
        role === "mentor"
          ? "/mentor/sessions"
          : "/Home/my-bookings",
        {
          state: {
            openChatId: item.bookingId,
          },
        }
      );
    },
    [close, navigate, role]
  );

  // ================= VIEW =================

  const view = useCallback(
    (item) => {
      openChat(item);
    },
    [openChat]
  );

  // ================= REPLY =================

  const reply = useCallback(
    (item) => {
      openChat(item);
    },
    [openChat]
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
        const myId = bare(getMyId?.());

        if (
          senderId
            ? senderId === myId
            : m.senderRole === "fresher"
        ) {
          return;
        }
      }

      // Do not show alerts inside meeting room
      if (/\/meeting(?:\/|$)/i.test(pathRef.current)) {
        return;
      }

      // Get booking identifiers
      const ids = [
        m.requestGroupId,
        m.bookingId,
      ]
        .filter(Boolean)
        .map(String);

      const bookingId = ids[0];

      if (!bookingId) return;

      // Chat already open -> no notification
      if (ids.some(isChatOpen)) return;

      // Prevent duplicate notifications
      const mid = String(m._id || m.id || "");

      if (mid) {
        if (seen.current.has(mid)) return;
        seen.current.add(mid);
      }

      // Sender details
      const name =
        m.senderName ||
        m.sender?.name ||
        (m.senderRole === "mentor" ? "Employee" : "Student");

      const image =
        m.sender?.image ||
        m.senderImage ||
        "";

      // Add notification
      setItems((prev) => {
        const newItem = {
          key:
            mid ||
            `${Date.now()}-${Math.random()}`,
          bookingId,
          name,
          text: String(m.text || ""),
          image,
        };

        return [
          newItem,
          ...prev,
        ].slice(0, MAX_ALERTS);
      });
    };

    socket.on("chat:message", onMsg);

    return () => {
      socket.off("chat:message", onMsg);
    };
  }, [role, getMyId]);

  // ================= UI =================

  if (!items.length) return null;

  return (
    <>
      <style>
        {`
          @keyframes chatAlertIn {
            from {
              opacity: 0;
              transform: translateY(-18px) scale(.97);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
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
          top: {
            xs: 12,
            sm: 20,
          },
          right: {
            xs: 12,
            sm: 22,
          },
          zIndex: 20000,
          width: {
            xs: "calc(100% - 24px)",
            sm: "390px",
          },
          maxWidth: "390px",
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
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
