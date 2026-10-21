// src/FresherDashboard/pages/Welcomebonus.jsx
//
// Rendered by Header.jsx (not inside <Routes>).
//
//   1. confetti + "₹25 free" card, number counts up
//   2. card collapses into a gold coin that flies on an ARC (with a comet
//      trail) straight to the wallet button in the navbar
//   3. impact ripple + "+₹25" pops out of the button, the nav balance
//      counts up (Header does the count, we only tell it when to start)
//
// Plays once per account (localStorage). To replay while testing, open any
// fresher page with  ?replayBonus=1  at the end of the URL.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Gift } from "lucide-react";
import { getUserId } from "../../services/fresherApi"; // <- fix the path if needed

const WELCOME_BONUS = 25;
const COLORS = ["#8b5cf6", "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const Coin = ({ dx, dy, delay = 0, size = 76, ghost = false, label }) => (
  <motion.div
    className="absolute left-0 top-0 flex items-center justify-center rounded-full"
    style={{
      width: size,
      height: size,
      marginLeft: -size / 2,
      marginTop: -size / 2,
      background: ghost
        ? "radial-gradient(circle at 30% 30%, #fde68a, #f59e0b)"
        : "radial-gradient(circle at 30% 28%, #fef3c7 0%, #fbbf24 45%, #d97706 100%)",
      boxShadow: ghost ? "none" : "0 10px 30px rgba(217,119,6,.55), inset 0 -4px 8px rgba(180,83,9,.45)",
      border: ghost ? "none" : "3px solid #fde68a",
    }}
    initial={{ x: 0, y: 0, scale: 0.6, opacity: 0 }}
    animate={{
      x: [0, dx * 0.5, dx],
      y: [0, -170, dy],
      scale: [0.6, 1.15, 0.32],
      opacity: ghost ? [0, 0.55, 0] : [0, 1, 1],
      rotate: [0, 200, 420],
    }}
    transition={{ duration: 1, delay, ease: "easeInOut", times: [0, 0.45, 1] }}
  >
    {!ghost && <span className="text-xl font-black text-amber-900">{label}</span>}
  </motion.div>
);

const WelcomeBonus = ({ user, targetRef, fallbackRef, onHold, onLand }) => {
  const userId = getUserId();
  const storageKey = `mc_welcome_bonus_seen_${userId}`;

  // idle | enter | fly | impact | done
  const [phase, setPhase] = useState("idle");
  const [coin, setCoin] = useState(0);
  const [dest, setDest] = useState({ cx: 0, cy: 0, dx: 0, dy: 0 });

  const decidedRef = useRef(false);
  const rafRef = useRef(0);
  const phaseRef = useRef("idle");
  const cb = useRef({});

  cb.current = { onHold, onLand };
  phaseRef.current = phase;

  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => {
        const angle = (i / 40) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 150 + Math.random() * 210;
        return {
          id: i,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist - 60,
          rot: Math.round(Math.random() * 720 - 360),
          delay: Math.round(Math.random() * 200),
          w: 6 + Math.round(Math.random() * 4),
          h: 10 + Math.round(Math.random() * 5),
          color: COLORS[i % COLORS.length],
        };
      }),
    []
  );

  const countUp = (to, ms) => {
    const t0 = performance.now();
    cancelAnimationFrame(rafRef.current);
    const step = (t) => {
      const p = Math.min((t - t0) / ms, 1);
      setCoin(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  // never leave the navbar number frozen if we unmount mid-animation
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      if (phaseRef.current === "enter" || phaseRef.current === "fly") cb.current.onHold?.(null);
    },
    []
  );

  // ---------------------------------------------------------
  // 1) should this user see the animation?
  // ---------------------------------------------------------
  useEffect(() => {
    if (!user || !userId || decidedRef.current) return;
    decidedRef.current = true;

    const replay =
      typeof window !== "undefined" && window.location.search.includes("replayBonus");

    let seen = true;
    try {
      seen = Boolean(localStorage.getItem(storageKey));
    } catch {
      seen = true;
    }

    const wallet = Number(user.walletBalance) || 0;
    const created = user.createdAt ? Date.now() - new Date(user.createdAt).getTime() : Infinity;
    const isNew = created < WEEK_MS;

    const eligible =
      wallet >= WELCOME_BONUS &&
      user.welcomeBonusClaimed !== false &&
      (replay || (!seen && isNew));

    if (!eligible) return;

    setCoin(0);
    // navbar shows the balance WITHOUT the bonus until the coin lands
    cb.current.onHold?.(Math.max(wallet - WELCOME_BONUS, 0));
    setPhase("enter");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userId]);

  // ---------------------------------------------------------
  // 2) phases
  // ---------------------------------------------------------
  const startFly = () => {
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

    setDest({
      cx,
      cy,
      dx: cx - window.innerWidth / 2,
      dy: cy - window.innerHeight / 2,
    });
    setPhase("fly");
  };

  useEffect(() => {
    if (phase === "enter") {
      countUp(WELCOME_BONUS, 1100);
      const t = setTimeout(startFly, 3000);
      return () => clearTimeout(t);
    }

    if (phase === "fly") {
      const t = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, "1");
        } catch {
          /* ignore */
        }
        cb.current.onHold?.(null); // navbar starts counting up now
        cb.current.onLand?.(); // navbar button bumps + glows
        setPhase("impact");
      }, 1050);
      return () => clearTimeout(t);
    }

    if (phase === "impact") {
      const t = setTimeout(() => setPhase("done"), 1100);
      return () => clearTimeout(t);
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "idle" || phase === "done") return null;

  const celebrating = phase === "enter" || phase === "fly";

  return (
    <>
      <style>{`
        @keyframes mc-wb-confetti {
          0%   { opacity: 1; transform: translate(0,0) rotate(0deg) scale(.4); }
          70%  { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--tx), calc(var(--ty) + 90px)) rotate(var(--rot)) scale(1); }
        }
        @keyframes mc-wb-ring {
          0%   { transform: scale(.7); opacity: .75; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes mc-wb-impact {
          0%   { transform: scale(.4); opacity: .9; }
          100% { transform: scale(3.4); opacity: 0; }
        }
        @keyframes mc-wb-float {
          0%,100% { transform: translateY(0) rotate(-4deg); }
          50%     { transform: translateY(-6px) rotate(4deg); }
        }
        @keyframes mc-wb-spark {
          0%   { opacity: 1; transform: translate(0,0) scale(1); }
          100% { opacity: 0; transform: translate(var(--sx), var(--sy)) scale(.2); }
        }
        .mc-wb-confetti { animation: mc-wb-confetti 1.9s cubic-bezier(.15,.7,.3,1) both; }
        .mc-wb-ring { animation: mc-wb-ring 1.6s ease-out infinite; }
        .mc-wb-impact { animation: mc-wb-impact .85s ease-out both; }
        .mc-wb-float { animation: mc-wb-float 2.2s ease-in-out infinite; }
        .mc-wb-spark { animation: mc-wb-spark .8s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .mc-wb-confetti, .mc-wb-ring, .mc-wb-impact, .mc-wb-float, .mc-wb-spark { animation: none; }
        }
      `}</style>

      {/* ---------------- celebration + flying coin ---------------- */}
      {celebrating && (
        <div className="pointer-events-none fixed inset-0 z-[120]" role="status" aria-live="polite">
          <motion.div
            className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "fly" ? 0 : 1 }}
            transition={{ duration: phase === "fly" ? 0.7 : 0.4 }}
          />

          <div className="absolute left-1/2 top-1/2">
            {phase === "enter" && (
              <div className="absolute left-0 top-0" aria-hidden="true">
                {pieces.map((p) => (
                  <span
                    key={p.id}
                    className="mc-wb-confetti absolute rounded-[2px]"
                    style={{
                      width: p.w,
                      height: p.h,
                      background: p.color,
                      animationDelay: `${p.delay}ms`,
                      "--tx": `${p.tx}px`,
                      "--ty": `${p.ty}px`,
                      "--rot": `${p.rot}deg`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* welcome card */}
            <motion.div
              className="absolute left-0 top-0 w-[min(88vw,380px)] overflow-hidden rounded-3xl bg-white text-center shadow-2xl"
              style={{ x: "-50%", y: "-50%" }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={
                phase === "fly"
                  ? { opacity: 0, scale: 0.12 }
                  : { opacity: 1, scale: 1 }
              }
              transition={
                phase === "fly"
                  ? { duration: 0.35, ease: "easeIn" }
                  : { type: "spring", stiffness: 220, damping: 18 }
              }
            >
              <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 px-6 pb-7 pt-8 text-white">
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                  <span className="mc-wb-ring absolute inset-0 rounded-full bg-white/40" />
                  <span
                    className="mc-wb-ring absolute inset-0 rounded-full bg-white/30"
                    style={{ animationDelay: ".7s" }}
                  />
                  <span className="mc-wb-float relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg ring-4 ring-white/40">
                    <Gift size={36} className="text-white" />
                  </span>
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-100">
                  Welcome to MNCConnect
                </p>
                <p className="mt-2 text-6xl font-black tabular-nums tracking-tight">{inr(coin)}</p>
                <p className="mt-1 text-sm font-medium text-indigo-100">free bonus, just for joining</p>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-slate-600">
                  Adding it to your wallet now. Use it to book your first mentor session.
                </p>
              </div>
            </motion.div>

            {/* gold coin + comet trail, flies on an arc to the navbar wallet */}
            {phase === "fly" && (
              <>
                {[4, 3, 2, 1].map((i) => (
                  <Coin
                    key={i}
                    ghost
                    dx={dest.dx}
                    dy={dest.dy}
                    delay={0.07 * i}
                    size={76 - i * 9}
                  />
                ))}
                <Coin dx={dest.dx} dy={dest.dy} label={`₹${WELCOME_BONUS}`} />
              </>
            )}
          </div>

          {phase === "enter" && (
            <div className="absolute inset-x-0 bottom-8 flex justify-center">
              <button
                type="button"
                onClick={startFly}
                className="pointer-events-auto rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25"
              >
                Skip
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------------- impact on the navbar wallet ---------------- */}
      {phase === "impact" && (
        <div
          className="pointer-events-none fixed z-[120]"
          style={{ left: dest.cx, top: dest.cy }}
          aria-hidden="true"
        >
          <span className="mc-wb-impact absolute -ml-7 -mt-7 h-14 w-14 rounded-full border-2 border-indigo-500" />
          <span
            className="mc-wb-impact absolute -ml-7 -mt-7 h-14 w-14 rounded-full border-2 border-amber-400"
            style={{ animationDelay: ".12s" }}
          />

          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <span
                key={i}
                className="mc-wb-spark absolute -ml-1 -mt-1 h-2 w-2 rounded-full"
                style={{
                  background: COLORS[i % COLORS.length],
                  "--sx": `${Math.cos(a) * 46}px`,
                  "--sy": `${Math.sin(a) * 46}px`,
                }}
              />
            );
          })}

          <motion.span
            className="absolute -ml-8 whitespace-nowrap rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg"
            initial={{ y: 10, opacity: 0, scale: 0.7 }}
            animate={{ y: 34, opacity: [0, 1, 1, 0], scale: 1 }}
            transition={{ duration: 1.1, times: [0, 0.2, 0.75, 1] }}
          >
            +{inr(WELCOME_BONUS)}
          </motion.span>
        </div>
      )}
    </>
  );
};

export default WelcomeBonus;