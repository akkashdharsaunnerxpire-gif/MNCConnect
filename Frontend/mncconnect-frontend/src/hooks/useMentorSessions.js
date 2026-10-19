// src/hooks/useMentorSessions.js
// Builds the mentor's session list from the live wallet payments
// (Payment docs already carry mentor, session date/time, duration, status).
// Refreshes on "wallet:updated" and flips Upcoming -> Completed by itself.

import { useEffect, useMemo, useState } from "react";
import useLive from "./useLive";
import { api, ENDPOINTS, EVENTS } from "../services/mentorApi";

const avatarFor = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Fresher")}&background=eff6ff&color=2563eb`;

export const toSession = (p, now) => {
  const dur = Number(p.durationMinutes) || 30;
  const endsAt = p.sessionEndsAt ? new Date(p.sessionEndsAt).getTime() : null;
  const startsAt = endsAt ? endsAt - dur * 60000 : null;

  let status = "Upcoming";
  if (p.sessionStatus === "cancelled") status = "Cancelled";
  else if (endsAt && endsAt <= now) status = "Completed";

  return {
    id: p.requestGroupId || p._id || p.id,
    name: p.fresherName || "Fresher",
    role: "Fresher",
    avatar: avatarFor(p.fresherName),
    topic: p.topic || "",
    type: "Video Call",
    date: p.sessionDate || "",
    time: p.sessionTime || "",
    duration: `${dur} mins`,
    amount: Number(p.amount) || 0,
    earning: Number(p.mentorEarning) || 0,
    message: "",
    status,
    startsAt,
    endsAt,
  };
};

export default function useMentorSessions() {
  const [now, setNow] = useState(Date.now());

  const live = useLive({
    fetcher: () => api(ENDPOINTS.wallet),
    events: [EVENTS.walletUpdated],
    pollMs: 60000,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const sessions = useMemo(() => {
    const list = live.data?.payments || live.data?.transactions || [];
    return list
      .filter((p) => p.sessionStatus && p.sessionStatus !== "unassigned")
      .map((p) => toSession(p, now))
      .sort((a, b) =>
        a.status === "Upcoming" && b.status === "Upcoming"
          ? (a.startsAt || 0) - (b.startsAt || 0)
          : (b.startsAt || 0) - (a.startsAt || 0)
      );
  }, [live.data, now]);

  const wallet = {
    available: 0, pending: 0, lifetime: 0, week: 0, month: 0, withdrawn: 0,
    ...(live.data?.wallet || {}),
  };

  return { ...live, sessions, wallet };
}