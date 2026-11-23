import React, { useEffect, useState } from "react";
import { fmtClock } from "../services/fresherApi";

const listeners = new Set();
let timer = null;

const subscribe = (fn) => {
  listeners.add(fn);
  if (!timer) timer = setInterval(() => listeners.forEach((f) => f()), 1000);
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
};

const LiveClock = ({ target }) => {
  const [, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((n) => n + 1)), []);
  return <>{fmtClock(Math.max(0, target - Date.now()))}</>;
};

export default LiveClock;