// src/hooks/useLive.js  (works for mentor AND fresher)
// Fetches data, then re-fetches on socket events / reconnect / optional polling.
// The server already puts every cookie-logged-in socket into its own user room
// (identified from the HttpOnly cookie), so nothing is read from localStorage.
// `userId` is optional: pass it only if you still want to emit "join-user".

import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../utils/socket";

export default function useLive({ fetcher, events = [], pollMs = 0, userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(socket.connected);

  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const load = useCallback(async () => {
    try {
      setData(await fetchRef.current());
      setError("");
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  const eventKey = events.join("|");

  useEffect(() => {
    let timer;

    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 250);
    };
    const onConnect = () => {
      setConnected(true);
      if (userId) socket.emit("join-user", userId);
      load();
    };
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    events.forEach((e) => socket.on(e, refresh));

    if (socket.connected) onConnect();
    else {
      load();
      socket.connect();
    }

    const poll = pollMs > 0 ? setInterval(load, pollMs) : null;

    return () => {
      clearTimeout(timer);
      if (poll) clearInterval(poll);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      events.forEach((e) => socket.off(e, refresh));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey, pollMs, load, userId]);

  return { data, loading, error, connected, reload: load, setData };
}