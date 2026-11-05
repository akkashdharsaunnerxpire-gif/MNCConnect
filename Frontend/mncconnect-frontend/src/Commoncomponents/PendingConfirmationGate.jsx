// Commoncomponents/PendingConfirmationGate.jsx
import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { API_URL } from "../services/fresherApi";
import SessionConfirmModal, { confirmSessionApi } from "./SessionConfirmModal";

const PendingConfirmationGate = () => {
  const { pathname } = useLocation();
  const [list, setList] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/bookings/pending-confirmation`, { credentials: "include" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setList(d.bookings || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60 * 1000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // inside the meeting room the meeting itself handles it
  if (pathname.toLowerCase().includes("/meeting")) return null;
  const current = list[0];
  if (!current) return null;

  const done = () => setList((l) => l.filter((b) => b._id !== current._id));

  return (
    <SessionConfirmModal
      key={current._id}
      zIndex="z-[100]"
      title="Was your session successful?"
      subtitle={`Your session${current.mentor?.name ? ` with ${current.mentor.name}` : ""}${
        current.companyName ? ` (${current.companyName})` : ""
      } has finished. Please confirm.`}
      onYes={async () => {
        await confirmSessionApi(current._id, true);
        done();
      }}
      onNo={async (reason) => {
        await confirmSessionApi(current._id, false, reason);
        done();
      }}
    />
  );
};

export default PendingConfirmationGate;