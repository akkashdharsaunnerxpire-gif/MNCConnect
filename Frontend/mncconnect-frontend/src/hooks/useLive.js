// src/hooks/useLive.js  (works for mentor AND fresher)
// Fetches data, then re-fetches on socket events / reconnect / optional polling.
// The server already puts every cookie-logged-in socket into its own user room
// (identified from the HttpOnly cookie), so nothing is read from localStorage.
// `userId` is optional: pass it only if you still want to emit "join-user".
//
// FIXES in this version
//  1. Out-of-order responses can no longer overwrite newer data
//     (a slow older request used to bring back deleted / old rows).
//  2. No state updates after the component unmounts.
//  3. Re-fetches when the tab becomes visible again (stale tab -> fresh data).
//  4. Polling is paused while the tab is hidden.
//  5. Optional `clearOnError`: wipe old data when a fetch fails instead of
//     silently showing the last good (possibly stale) list.

import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../utils/socket";

export default function useLive({
  fetcher,
  events = [],
  pollMs = 0,
  userId,
  clearOnError = false,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(socket.connected);

  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const clearRef = useRef(clearOnError);
  clearRef.current = clearOnError;

  const mounted = useRef(true);
  const requestSeq = useRef(0); // id of the newest request

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const mine = ++requestSeq.current;

    try {
      const result = await fetchRef.current();

      // a newer request was started meanwhile -> ignore this old answer
      if (!mounted.current || mine !== requestSeq.current) return;

      setData(result);
      setError("");
    } catch (e) {
      if (!mounted.current || mine !== requestSeq.current) return;

      setError(e.message || "Something went wrong");
      if (clearRef.current) setData(null);
    } finally {
      if (mounted.current && mine === requestSeq.current) setLoading(false);
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

    // coming back to this tab -> get fresh data right away
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    events.forEach((e) => socket.on(e, refresh));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    if (socket.connected) onConnect();
    else {
      load();
      socket.connect();
    }

    // do not poll while the tab is in the background
    const poll =
      pollMs > 0
        ? setInterval(() => {
            if (document.visibilityState === "visible") load();
          }, pollMs)
        : null;

    return () => {
      clearTimeout(timer);
      if (poll) clearInterval(poll);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      events.forEach((e) => socket.off(e, refresh));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey, pollMs, load, userId]);

  return { data, loading, error, connected, reload: load, setData };
}