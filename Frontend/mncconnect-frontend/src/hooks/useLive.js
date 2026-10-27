// src/hooks/useLive.js  (replaces the earlier version; works for mentor AND fresher)
// Fetches data, then re-fetches on socket events / reconnect / optional polling.
// Joins the "user:<id>" room so backend emitToUser() / notify() reach this tab.

import { useCallback, useEffect, useRef, useState } from "react";
import {socket} from "../utils/socket";

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
    const id = userId ?? localStorage.getItem("mentorId");
    let timer;

    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 250);
    };
    const onConnect = () => {
      setConnected(true);
      if (id) socket.emit("join-user", id);
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