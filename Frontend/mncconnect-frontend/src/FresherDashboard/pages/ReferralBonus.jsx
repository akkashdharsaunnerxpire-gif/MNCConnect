// src/FresherDashboard/pages/ReferralBonus.jsx
//
// Rendered by Header.jsx. Plays when the logged-in fresher EARNS a referral
// reward (referralEarnings goes up while the app is open):
//   coin pops in the middle -> flies into the navbar wallet -> balance counts up.
//
// Events fired on window (the wallet page listens so its cards wait too):
//   "referral-bonus:start"  detail: { base, earningsBase }
//   "referral-bonus:land"
//
// Only referralEarnings increases trigger this. The welcome bonus (+25) never does.

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Users } from "lucide-react";

const COIN = 110;
const COLORS = ["#8b5cf6", "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e"];
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// ---- timings (ms). Old values were 1600 / 1000 / 1000 -> felt very late ----
const POP_MS = 800; // coin shows in the middle
const FLY_MS = 700; // coin flies to the wallet
const IMPACT_MS = 650; // spark burst at the wallet

/* 3D coin (stacked discs = thickness) */
const CoinBody = ({ amount, size = COIN }) => {
  const half = size * 0.075;
  const layers = Array.from({ length: 5 }, (_, i) => (i - 2) * (half / 2));

  const face = {
    position: "absolute",
    inset: 0,
    borderRadius: "9999px",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    background:
      "linear-gradient(135deg, rgba(255,255,255,.35) 0%, transparent 40%), radial-gradient(circle at 32% 28%, #fef3c7 0%, #fbbf24 42%, #d97706 100%)",
    border: `${size * 0.04}px solid #fde68a`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const ring = (
    <span
      style={{
        position: "absolute",
        inset: size * 0.1,
        borderRadius: "9999px",
        border: "2px dashed rgba(146,64,14,.45)",
      }}
    />
  );

  return (
    <div style={{ width: size, height: size, position: "relative", transformStyle: "preserve-3d" }}>
      {layers.map((z, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            background: i % 2 ? "#d97706" : "#b45309",
            transform: `translateZ(${z}px)`,
          }}
        />
      ))}
      <div style={{ ...face, transform: `translateZ(${half + 1}px)` }}>
        {ring}
        <span style={{ fontSize: size * 0.3, fontWeight: 900, color: "#78350f" }}>₹{amount}</span>
      </div>
      <div style={{ ...face, transform: `rotateY(180deg) translateZ(${half + 1}px)` }}>
        {ring}
        <span style={{ fontSize: size * 0.22, fontWeight: 900, letterSpacing: 1, color: "#78350f" }}>
          MNC
        </span>
      </div>
    </div>
  );
};

const ReferralBonus = ({ me, targetRef, fallbackRef, onHold, onLand }) => {
  // idle | pop | fly | impact
  const [phase, setPhase] = useState("idle");
  const [amount, setAmount] = useState(0);
  const [dest, setDest] = useState({ cx: 0, cy: 0, dx: 0, dy: 0, my: 0 });

  const phaseRef = useRef("idle");
  const prevEarnings = useRef(null); // null = first load (never animate old earnings)
  const walletRef = useRef(0);
  const queue = useRef([]);
  const cb = useRef({});

  cb.current = { onHold, onLand };
  phaseRef.current = phase;

  const CENTER_OFFSET = 30;

  const startNext = () => {
    if (phaseRef.current !== "idle") return;
    const item = queue.current.shift();
    if (!item) return;

    // balance WITHOUT this reward (and without rewards still waiting in the queue)
    const rest = queue.current.reduce((s, x) => s + x.delta, 0);
    const base = Math.max(walletRef.current - item.delta - rest, 0);
    // referral earnings WITHOUT this reward
    const earningsBase = Math.max(item.earnings - item.delta, 0);

    // set the phase ref right away so a 2nd reward arriving in the same tick can't start twice
    phaseRef.current = "pop";

    setAmount(item.delta);
    cb.current.onHold?.(base);
    window.dispatchEvent(
      new CustomEvent("referral-bonus:start", { detail: { base, earningsBase } })
    );
    setPhase("pop");
  };

  // detect a new referral reward (ONLY referralEarnings going up)
  useEffect(() => {
    if (!me) return;

    const earnings = Number(me.referralEarnings) || 0;
    walletRef.current = Number(me.walletBalance) || 0;

    if (prevEarnings.current === null) {
      prevEarnings.current = earnings;
      return;
    }

    const delta = earnings - prevEarnings.current;
    prevEarnings.current = earnings;

    if (delta > 0 && walletRef.current >= delta) {
      queue.current.push({ delta, earnings });
      startNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // never leave the navbar number frozen if we unmount mid-animation
  useEffect(
    () => () => {
      if (phaseRef.current === "pop" || phaseRef.current === "fly") {
        cb.current.onHold?.(null);
        window.dispatchEvent(new Event("referral-bonus:land"));
      }
    },
    []
  );

  // phases
  useEffect(() => {
    if (phase === "pop") {
      const t = setTimeout(() => {
        let cx = window.innerWidth - 90;
        let cy = 36;
        for (const ref of [targetRef, fallbackRef]) {
          const el = ref?.current;
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            cx = r.left + r.width / 2;
            cy = r.top + r.height / 2;
            break;
          }
        }
        const sx = window.innerWidth / 2;
        const sy = window.innerHeight / 2 - CENTER_OFFSET;
        setDest({ cx, cy, dx: cx - sx, dy: cy - sy, my: (cy - sy) * 0.5 - 120 });
        setPhase("fly");
      }, POP_MS);
      return () => clearTimeout(t);
    }

    if (phase === "fly") {
      const t = setTimeout(() => {
        if (queue.current.length === 0) cb.current.onHold?.(null); // navbar counts up now
        cb.current.onLand?.(); // navbar button bumps + glows
        window.dispatchEvent(new Event("referral-bonus:land"));
        setPhase("impact");
      }, FLY_MS);
      return () => clearTimeout(t);
    }

    if (phase === "impact") {
      const t = setTimeout(() => {
        phaseRef.current = "idle";
        setPhase("idle");
        startNext(); // another referral waiting? play it too
      }, IMPACT_MS);
      return () => clearTimeout(t);
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "idle") return null;

  const isFly = phase === "fly";
  const showCoin = phase === "pop" || phase === "fly";

  return (
    <>
      <style>{`
        @keyframes mc-rb-impact {
          0%   { transform: scale(.4); opacity: .9; }
          100% { transform: scale(3.4); opacity: 0; }
        }
        @keyframes mc-rb-spark {
          0%   { opacity: 1; transform: translate(0,0) scale(1); }
          100% { opacity: 0; transform: translate(var(--sx), var(--sy)) scale(.2); }
        }
        .mc-rb-impact { animation: mc-rb-impact .65s ease-out both; }
        .mc-rb-spark { animation: mc-rb-spark .6s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .mc-rb-impact, .mc-rb-spark { animation: none; }
        }
      `}</style>

      {showCoin && (
        <div className="pointer-events-none fixed inset-0 z-[120]" role="status" aria-live="polite">
          {/* backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 45%, rgba(88,28,135,.7) 0%, rgba(15,23,42,.85) 70%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isFly ? 0 : 1 }}
            transition={{ duration: isFly ? 0.5 : 0.25 }}
          />

          <div className="absolute left-1/2 top-1/2" style={{ width: 0, height: 0 }}>
            {/* text */}
            <motion.div
              className="absolute w-72 -translate-x-1/2 text-center text-white"
              style={{ top: COIN / 2 - CENTER_OFFSET + 14 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: isFly ? 0 : 1, y: 0 }}
              transition={{ duration: isFly ? 0.2 : 0.3, delay: isFly ? 0 : 0.1 }}
            >
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200">
                <Users size={14} /> Referral reward
              </p>
              <p className="mt-1 bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-5xl font-black tabular-nums text-transparent">
                +{inr(amount)}
              </p>
              <p className="mt-1 text-xs text-slate-300">Someone used your referral code</p>
            </motion.div>

            {/* coin */}
            <motion.div
              key={phase}
              style={{
                position: "absolute",
                left: -COIN / 2,
                top: -COIN / 2 - CENTER_OFFSET,
                width: COIN,
                height: COIN,
                perspective: 700,
                willChange: "transform",
              }}
              initial={isFly ? { x: 0, y: 0, scale: 1 } : { y: 60, scale: 0.3, opacity: 0 }}
              animate={
                isFly
                  ? { x: [0, dest.dx * 0.5, dest.dx], y: [0, dest.my, dest.dy], scale: [1, 1.1, 0.25] }
                  : { y: 0, scale: 1, opacity: 1 }
              }
              transition={
                isFly
                  ? { duration: FLY_MS / 1000, ease: "easeInOut", times: [0, 0.45, 1] }
                  : { type: "spring", stiffness: 160, damping: 14 }
              }
            >
              <motion.div
                style={{ width: "100%", height: "100%", transformStyle: "preserve-3d" }}
                initial={{ rotateY: 0 }}
                animate={isFly ? { rotateY: 720 } : { rotateY: 360 }}
                transition={
                  isFly
                    ? { duration: FLY_MS / 1000, ease: "easeOut" }
                    : { duration: 1.2, repeat: Infinity, ease: "linear" }
                }
              >
                <CoinBody amount={amount} />
              </motion.div>
            </motion.div>
          </div>
        </div>
      )}

      {/* impact on the navbar wallet */}
      {phase === "impact" && (
        <div
          className="pointer-events-none fixed z-[121]"
          style={{ left: dest.cx, top: dest.cy }}
          aria-hidden="true"
        >
          <span className="mc-rb-impact absolute -ml-7 -mt-7 h-14 w-14 rounded-full border-2 border-indigo-500" />
          <span
            className="mc-rb-impact absolute -ml-7 -mt-7 h-14 w-14 rounded-full border-2 border-amber-400"
            style={{ animationDelay: ".08s" }}
          />

          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <span
                key={i}
                className="mc-rb-spark absolute -ml-1 -mt-1 h-2 w-2 rounded-full"
                style={{
                  background: COLORS[i % COLORS.length],
                  "--sx": `${Math.cos(a) * 52}px`,
                  "--sy": `${Math.sin(a) * 52}px`,
                }}
              />
            );
          })}

          <motion.span
            className="absolute -ml-8 whitespace-nowrap rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg"
            initial={{ y: 10, opacity: 0, scale: 0.7 }}
            animate={{ y: 34, opacity: [0, 1, 1, 0], scale: 1 }}
            transition={{ duration: 0.9, times: [0, 0.2, 0.75, 1] }}
          >
            +{inr(amount)}
          </motion.span>
        </div>
      )}
    </>
  );
};

export default ReferralBonus;