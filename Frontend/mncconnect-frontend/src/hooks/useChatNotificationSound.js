// src/hooks/useChatNotificationSound.js
import { useEffect, useRef } from "react";
import { socket } from "../utils/socket";
import {
  playNotificationSound,
  unlockAudio,
  isChatActive,
} from "../utils/chatSounds";

// Messages that arrive in the same chat within this time make ONE sound.
const SOUND_GAP_MS = 4000;

/**
 * Plays a notification sound for incoming chat messages
 * when that chat is not open. Mount ONCE in the layout (mentor + fresher).
 *
 * Same chat + many messages in a short time -> only ONE sound.
 */
export default function useChatNotificationSound(role) {
  const seen = useRef(new Set());
  const lastSound = useRef({}); // chatId -> time of the last sound

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

      // same chat, message burst -> play the sound only once
      const chatKey = String(m.requestGroupId || m.bookingId || "");
      const nowTs = Date.now();
      if (chatKey) {
        if (nowTs - (lastSound.current[chatKey] || 0) < SOUND_GAP_MS) return;
        lastSound.current[chatKey] = nowTs;
      } 

      playNotificationSound();
    };

    socket.on("chat:message", onMsg);
    if (!socket.connected) socket.connect();

    return () => socket.off("chat:message", onMsg);
  }, [role]);
}