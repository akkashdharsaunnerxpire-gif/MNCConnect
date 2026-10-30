// src/hooks/useChatNotificationSound.js
import { useEffect, useRef } from "react";
import { socket } from "../utils/socket";
import {
  playNotificationSound,
  unlockAudio,
  isChatActive,
} from "../utils/chatSounds";

/**
 * Plays a notification sound for every incoming chat message
 * when that chat is not open. Mount ONCE in the layout (mentor + fresher).
 */
export default function useChatNotificationSound(role) {
  const seen = useRef(new Set());

  // browsers block audio until the first click/key/touch
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

  useEffect(() => {
    if (!role) return undefined;

    const onMsg = (m) => {
      if (!m || m.senderRole === role) return; // my own message

      const id = String(m._id || "");
      if (id) {
        if (seen.current.has(id)) return;
        seen.current.add(id);
        if (seen.current.size > 500) {
          seen.current.delete(seen.current.values().next().value);
        }
      }

      // chat is open -> ChatPanel plays its own sound
      if (isChatActive(m.bookingId) || isChatActive(m.requestGroupId)) return;

      playNotificationSound();
    };

    socket.on("chat:message", onMsg);
    if (!socket.connected) socket.connect();

    return () => socket.off("chat:message", onMsg);
  }, [role]);
}