// src/hooks/useUserEvents.js
// Listen to socket events pushed to this user's room:
//   useUserEvents(userId, { "booking:updated": (payload) => ... })
import { useEffect, useRef } from "react";
import socket from "../socket";

export default function useUserEvents(userId, handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  const names = Object.keys(handlers).join("|");

  useEffect(() => {
    const wrapped = Object.keys(ref.current).map((name) => [name, (p) => ref.current[name]?.(p)]);
    const join = () => userId && socket.emit("join-user", userId);

    socket.on("connect", join);
    wrapped.forEach(([n, fn]) => socket.on(n, fn));
    if (socket.connected) join();
    else socket.connect();

    return () => {
      socket.off("connect", join);
      wrapped.forEach(([n, fn]) => socket.off(n, fn));
    };
  }, [userId, names]);
}