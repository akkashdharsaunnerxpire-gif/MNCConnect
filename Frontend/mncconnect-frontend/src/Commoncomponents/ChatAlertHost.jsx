
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

import { X } from "lucide-react";

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
        p: 1.8,
        pr: 5,
        borderRadius: "15px",
        border: "1px solid #e5e7eb",
        backgroundColor: "#ffffff",
        color: "#171717",
        boxShadow:
          "0 4px 18px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        animation: "chatAlertIn .3s cubic-bezier(.22,1,.36,1) both",
        pointerEvents: "auto",
        overflow: "hidden",
      }}
    >
      {/* Close button */}

      <IconButton
        size="small"
        aria-label="Close notification"
        onClick={() => onClose(item.key)}
        sx={{
          position: "absolute",
          right: 8,
          top: 8,
          width: 27,
          height: 27,
          color: "#9ca3af",
          "&:hover": {
            backgroundColor: "#f3f4f6",
            color: "#374151",
          },
        }}
      >
        <X size={15} />
      </IconButton>

      {/* Sender details */}

      <Stack direction="row" alignItems="center" spacing={1.5}>
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
            bgcolor: "#e0e7ff",
            color: "#4338ca",
            fontSize: 13,
            fontWeight: 700,
            border: "1px solid #e5e7eb",
          }}
        >
          {initialsOf(item.name)}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Name and message label */}

          <Stack
            direction="row"
            alignItems="center"
            spacing={0.7}
            sx={{ minWidth: 0 }}
          >
            <Typography
              noWrap
              sx={{
                fontSize: 13.5,
                fontWeight: 700,
                color: "#171717",
                maxWidth: "48%",
              }}
            >
              {item.name}
            </Typography>

            <Typography
              noWrap
              sx={{
                fontSize: 12.5,
                color: "#888888",
                fontWeight: 400,
              }}
            >
              sent you a message
            </Typography>
          </Stack>

          {/* Message preview */}

          <Typography
            sx={{
              mt: 0.55,
              fontSize: 13,
              color: "#777777",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
              pr: 0.5,
            }}
          >
            "{item.text}"
          </Typography>
        </Box>
      </Stack>

      {/* Actions */}

      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={1}
        sx={{ mt: 1.5 }}
      >
        <Button
          size="small"
          variant="outlined"
          onClick={() => onView(item)}
          sx={{
            minWidth: 55,
            height: 29,
            px: 1.5,
            borderRadius: "8px",
            borderColor: "#e5e7eb",
            color: "#333333",
            fontSize: 11.5,
            fontWeight: 600,
            textTransform: "none",
            "&:hover": {
              borderColor: "#9ca3af",
              backgroundColor: "#f9fafb",
            },
          }}
        >
          View
        </Button>

        <Button
          size="small"
          variant="contained"
          onClick={() => onReply(item)}
          sx={{
            minWidth: 58,
            height: 29,
            px: 1.5,
            borderRadius: "8px",
            backgroundColor: "#171717",
            color: "#ffffff",
            fontSize: 11.5,
            fontWeight: 600,
            textTransform: "none",
            boxShadow: "none",
            "&:hover": {
              backgroundColor: "#333333",
              boxShadow: "none",
            },
          }}
        >
          Reply
        </Button>
      </Stack>
    </Paper>
  );
});

// ================= CHAT ALERT HOST =================

/**
 * Shows a notification when a chat message arrives
 * and the corresponding chat is not open.
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
        (m.senderRole === "mentor"
          ? "Employee"
          : "Student");

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
              transform: translateY(-10px) scale(.97);
            }

            to {
              opacity: 1;
              transform: translateY(0) scale(1);
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
            sm: 18,
          },
          right: {
            xs: 12,
            sm: 20,
          },
          zIndex: 20000,
          width: {
            xs: "calc(100% - 24px)",
            sm: "390px",
          },
          maxWidth: "390px",
          display: "flex",
          flexDirection: "column",
          gap: 1.2,
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
