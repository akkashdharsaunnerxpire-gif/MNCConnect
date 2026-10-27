// src/FresherDashboard/pages/Welcomebonus.jsx
//
// Rendered by Header.jsx (not inside <Routes>).
// Plays ONCE per account. The ONLY source of truth is the database flag
// `welcomeBonusSeen` (read from /auth/me). No localStorage, so a different
// browser / device / account can never replay it.
//
// To replay while testing, add  ?replayBonus=1  to the URL.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { Gift, Sparkles, Wallet } from "lucide-react";
import { api } from "../../services/fresherApi"; // <- fix the path if needed

const WELCOME_BONUS = 25;
const COLORS = ["#8b5cf6", "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e"];

const SCENE_W = 300;
const SCENE_H = 340;
const COIN = 120;
const COIN_TOP = 20;
const BOX_W = 130;
const BOX_H = 100;
const BOX_TOP = 200;
const LID_W = 142;
const LID_H = 34;

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// chime + haptic (runs inside a click, so browsers allow it)
const feedback = (kind) => {
  try {
    navigator.vibrate?.(kind === "open" ? [30, 40, 60] : 25);
  } catch {
    /* ignore */
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes =
      kind === "open"
        ? [[784, 0], [1047, 0.09], [1319, 0.18], [1568, 0.28]]
        : [[1319, 0], [1760, 0.1]];
    notes.forEach(([f, d]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const t0 = ctx.currentTime + d;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.55);
    });
    setTimeout(() => ctx.close?.(), 1400);
  } catch {
    /* ignore */
  }
};

/* ------------------------------------------------------------------
   3D COIN (5 stacked discs = real thickness, light enough for phones)
------------------------------------------------------------------ */
const CoinBody = ({ size = COIN }) => {
  const half = size * 0.075;
  const layers = Array.from({ length: 5 }, (_, i) => (i - 2) * (half / 2));

  const faceBase = {
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
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
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

      <div style={{ ...faceBase, transform: `translateZ(${half + 1}px)` }}>
        {ring}
        <span style={{ fontSize: size * 0.3, fontWeight: 900, color: "#78350f" }}>
          ₹{WELCOME_BONUS}
        </span>
      </div>

      <div style={{ ...faceBase, transform: `rotateY(180deg) translateZ(${half + 1}px)` }}>
        {ring}
        <span
          style={{ fontSize: size * 0.22, fontWeight: 900, letterSpacing: 1, color: "#78350f" }}
        >
          MNC
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------
   3D GIFT BOX
------------------------------------------------------------------ */
const RIBBON_V = "linear-gradient(90deg, transparent 0 41%, #fbbf24 41% 59%, transparent 59% 100%)";
const RIBBON_H = "linear-gradient(0deg, transparent 0 41%, #fbbf24 41% 59%, transparent 59% 100%)";

const GiftBox = ({ open }) => {
  const hw = BOX_W / 2;
  const lhw = LID_W / 2;

  const bodyFaces = [
    { t: `translateZ(${hw}px)`, base: "linear-gradient(160deg,#8b5cf6,#6d28d9)" },
    { t: `rotateY(180deg) translateZ(${hw}px)`, base: "linear-gradient(160deg,#6d28d9,#4c1d95)" },
    { t: `rotateY(90deg) translateZ(${hw}px)`, base: "linear-gradient(160deg,#7c3aed,#5b21b6)" },
    { t: `rotateY(-90deg) translateZ(${hw}px)`, base: "linear-gradient(160deg,#7c3aed,#5b21b6)" },
  ];

  const lidFaces = [
    { t: `translateZ(${lhw}px)`, base: "linear-gradient(160deg,#a78bfa,#7c3aed)" },
    { t: `rotateY(180deg) translateZ(${lhw}px)`, base: "linear-gradient(160deg,#8b5cf6,#6d28d9)" },
    { t: `rotateY(90deg) translateZ(${lhw}px)`, base: "linear-gradient(160deg,#8b5cf6,#6d28d9)" },
    { t: `rotateY(-90deg) translateZ(${lhw}px)`, base: "linear-gradient(160deg,#8b5cf6,#6d28d9)" },
  ];

  return (
    <motion.div
      style={{
        position: "absolute",
        left: (SCENE_W - BOX_W) / 2,
        top: BOX_TOP,
        width: BOX_W,
        height: BOX_H,
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
      initial={false}
      animate={open ? { y: 40, scale: 0.94 } : { y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 14, delay: open ? 0.2 : 0 }}
    >
      {bodyFaces.map((f, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            transform: f.t,
            backgroundImage: `${RIBBON_V}, ${f.base}`,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -(BOX_W - BOX_H) / 2,
          width: BOX_W,
          height: BOX_W,
          transform: `rotateX(-90deg) translateZ(${BOX_H / 2}px)`,
          background: "#2e1065",
        }}
      />

      {/* lid */}
      <motion.div
        style={{
          position: "absolute",
          top: -LID_H,
          left: -(LID_W - BOX_W) / 2,
          width: LID_W,
          height: LID_H,
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
        initial={false}
        animate={
          open
            ? { y: [0, -100, -480], x: [0, 30, 190], rotateZ: [0, -8, 70], rotateX: [0, -20, -55] }
            : { y: 0, x: 0, rotateZ: 0, rotateX: 0 }
        }
        transition={{ duration: 1, times: [0, 0.35, 1], ease: "easeOut" }}
      >
        {lidFaces.map((f, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              transform: f.t,
              backgroundImage: `${RIBBON_V}, ${f.base}`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: -(LID_W - LID_H) / 2,
            width: LID_W,
            height: LID_W,
            transform: `rotateX(90deg) translateZ(${LID_H / 2}px)`,
            backgroundImage: `${RIBBON_V}, ${RIBBON_H}, linear-gradient(135deg,#c4b5fd,#7c3aed)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: -(LID_W - LID_H) / 2,
            width: LID_W,
            height: LID_W,
            transform: `rotateX(-90deg) translateZ(${LID_H / 2}px)`,
            background: "#4c1d95",
          }}
        />
        {/* bow */}
        <div
          style={{
            position: "absolute",
            left: lhw - 36,
            top: -22,
            width: 32,
            height: 24,
            borderRadius: "50%",
            border: "6px solid #fbbf24",
            transform: "rotate(-28deg) translateZ(1px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: lhw + 4,
            top: -22,
            width: 32,
            height: 24,
            borderRadius: "50%",
            border: "6px solid #f59e0b",
            transform: "rotate(28deg) translateZ(1px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: lhw - 7,
            top: -8,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#fbbf24",
            transform: "translateZ(2px)",
          }}
        />
      </motion.div>
    </motion.div>
  );
};

/* ------------------------------------------------------------------
   MAIN
------------------------------------------------------------------ */
const WelcomeBonus = ({ targetRef, fallbackRef, onHold, onLand }) => {
  // idle | gift | shake | open | fly | impact | done
  const [phase, setPhase] = useState("idle");
  const [amount, setAmount] = useState(0);
  const [burst, setBurst] = useState(false);
  const [dest, setDest] = useState({ cx: 0, cy: 0, sx: 0, sy: 0, dx: 0, dy: 0, my: 0, spin: 0 });

  // fresh copy of the user straight from the DB (never a stale prop / cache)
  const [serverUser, setServerUser] = useState(null);

  const decidedRef = useRef(false);
  const rafRef = useRef(0);
  const phaseRef = useRef("idle");
  const coinRef = useRef(null);
  const dragging = useRef(false);
  const velRef = useRef(140);
  const cb = useRef({});

  cb.current = { onHold, onLand };
  phaseRef.current = phase;

  /* ---------- pointer parallax ---------- */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [-1, 1], [26, 2]), { stiffness: 120, damping: 14 });
  const rotY = useSpring(useTransform(mx, [-1, 1], [-32, 32]), { stiffness: 120, damping: 14 });

  const onPointerMove = (e) => {
    mx.set((e.clientX / window.innerWidth) * 2 - 1);
    my.set((e.clientY / window.innerHeight) * 2 - 1);
  };
  const onPointerLeave = () => {
    mx.set(0);
    my.set(0);
  };

  /* ---------- coin spin with inertia (drag it) ---------- */
  const coinSpin = useMotionValue(0);
  const tiltTarget = useMotionValue(0);
  const coinTilt = useSpring(tiltTarget, { stiffness: 140, damping: 12 });

  useAnimationFrame((_, delta) => {
    if (phaseRef.current !== "open") return;
    if (!dragging.current) {
      velRef.current += (140 - velRef.current) * Math.min(1, delta * 0.003);
    }
    coinSpin.set(coinSpin.get() + (velRef.current * delta) / 1000);
  });

  const panProps =
    phase === "open"
      ? {
          onPanStart: () => {
            dragging.current = true;
          },
          onPan: (_, info) => {
            coinSpin.set(coinSpin.get() + info.delta.x * 0.9);
            velRef.current = clamp(info.velocity.x * 0.9, -1800, 1800);
            tiltTarget.set(clamp(info.offset.y * 0.3, -35, 35));
          },
          onPanEnd: () => {
            dragging.current = false;
            tiltTarget.set(0);
          },
        }
      : {};

  /* ---------- decorations (kept small for smoothness) ---------- */
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const angle = (i / 24) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 150 + Math.random() * 200;
        return {
          id: i,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist - 60,
          rot: Math.round(Math.random() * 720 - 360),
          delay: Math.round(Math.random() * 150),
          w: 6 + Math.round(Math.random() * 4),
          h: 10 + Math.round(Math.random() * 5),
          color: COLORS[i % COLORS.length],
        };
      }),
    []
  );

  const stars = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 3,
        delay: Math.random() * 3,
        dur: 2 + Math.random() * 2.5,
        color: COLORS[i % COLORS.length],
      })),
    []
  );

  const countUp = (to, ms) => {
    const t0 = performance.now();
    cancelAnimationFrame(rafRef.current);
    const step = (t) => {
      const p = Math.min((t - t0) / ms, 1);
      setAmount(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  // never leave the navbar number frozen if we unmount mid-animation
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      const p = phaseRef.current;
      if (p === "gift" || p === "shake" || p === "open" || p === "fly") cb.current.onHold?.(null);
    },
    []
  );

  // ---------------------------------------------------------
  // 0) read the user from the DB (/auth/me)
  // ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    api("/auth/me")
      .then((d) => {
        if (!cancelled) setServerUser(d?.user || d || null);
      })
      .catch((err) => console.error("WelcomeBonus: /auth/me failed:", err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------
  // 1) should this user see it?  DB flag only.
  // ---------------------------------------------------------
  useEffect(() => {
    if (!serverUser || decidedRef.current) return;
    decidedRef.current = true;

    const replay =
      typeof window !== "undefined" && window.location.search.includes("replayBonus");

    // only a brand-new account has welcomeBonusSeen === false
    const neverSeenOnServer = serverUser.welcomeBonusSeen === false;
    const wallet = Number(serverUser.walletBalance) || 0;

    const eligible =
      wallet >= WELCOME_BONUS &&
      serverUser.welcomeBonusClaimed !== false &&
      (replay || neverSeenOnServer);

    if (!eligible) return;

    setAmount(0);
    // navbar shows the balance WITHOUT the bonus until the coin lands
    cb.current.onHold?.(Math.max(wallet - WELCOME_BONUS, 0));
    setPhase("gift");
  }, [serverUser]);

  // ---------------------------------------------------------
  // 2) actions
  // ---------------------------------------------------------
  const openGift = () => {
    if (phaseRef.current !== "gift") return;
    feedback("open");
    setPhase("shake");
  };

  // save in the DB the moment the user claims (never plays again, on any device)
  const markSeen = () => {
    api("/auth/welcome-bonus-seen", { method: "PATCH" }).catch((err) =>
      console.error("welcome-bonus-seen failed:", err.message)
    );
  };

  const startFly = () => {
    if (phaseRef.current !== "open") return; // claim button only shows in "open"

    markSeen();

    // target: navbar wallet button
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

    // start: wherever the coin currently is
    let sx = window.innerWidth / 2;
    let sy = window.innerHeight / 2;
    const cr = coinRef.current?.getBoundingClientRect();
    if (cr && cr.width > 0) {
      sx = cr.left + cr.width / 2;
      sy = cr.top + cr.height / 2;
    }

    feedback("claim");
    setDest({
      cx,
      cy,
      sx,
      sy,
      dx: cx - sx,
      dy: cy - sy,
      my: (cy - sy) * 0.5 - 170,
      spin: coinSpin.get(),
    });
    setPhase("fly");
  };

  // ---------------------------------------------------------
  // 3) phases
  // ---------------------------------------------------------
  useEffect(() => {
    if (phase === "shake") {
      const t = setTimeout(() => {
        setPhase("open");
        setBurst(true);
      }, 650);
      return () => clearTimeout(t);
    }

    if (phase === "open") {
      countUp(WELCOME_BONUS, 1000);
      const b = setTimeout(() => setBurst(false), 2300);
      return () => clearTimeout(b);
    }

    if (phase === "fly") {
      const t = setTimeout(() => {
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

  const celebrating = phase === "gift" || phase === "shake" || phase === "open" || phase === "fly";
  const isOpen = phase === "open" || phase === "fly";
  const isFly = phase === "fly";

  return (
    <>
      <style>{`
        @keyframes mc-wb-confetti {
          0%   { opacity: 1; transform: translate(0,0) rotate(0deg) scale(.4); }
          70%  { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--tx), calc(var(--ty) + 90px)) rotate(var(--rot)) scale(1); }
        }
        @keyframes mc-wb-impact {
          0%   { transform: scale(.4); opacity: .9; }
          100% { transform: scale(3.4); opacity: 0; }
        }
        @keyframes mc-wb-spark {
          0%   { opacity: 1; transform: translate(0,0) scale(1); }
          100% { opacity: 0; transform: translate(var(--sx), var(--sy)) scale(.2); }
        }
        @keyframes mc-wb-rays { to { transform: rotate(360deg); } }
        @keyframes mc-wb-twinkle {
          0%,100% { opacity: .15; transform: scale(.6); }
          50%     { opacity: .95; transform: scale(1.3); }
        }
        @keyframes mc-wb-pulse {
          0%   { transform: scale(.85); opacity: .7; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        .mc-wb-confetti { animation: mc-wb-confetti 1.9s cubic-bezier(.15,.7,.3,1) both; will-change: transform, opacity; }
        .mc-wb-impact { animation: mc-wb-impact .85s ease-out both; }
        .mc-wb-spark { animation: mc-wb-spark .8s ease-out both; }
        .mc-wb-rays { animation: mc-wb-rays 22s linear infinite; will-change: transform; }
        .mc-wb-twinkle { animation: mc-wb-twinkle var(--dur) ease-in-out var(--delay) infinite; }
        .mc-wb-pulse { animation: mc-wb-pulse 1.6s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mc-wb-confetti, .mc-wb-impact, .mc-wb-spark, .mc-wb-rays, .mc-wb-twinkle, .mc-wb-pulse { animation: none; }
        }
      `}</style>

      {/* ---------------- interactive 3D scene ---------------- */}
      {celebrating && (
        <div
          className={`fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden ${isFly ? "pointer-events-none" : ""}`}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          role="dialog"
          aria-live="polite"
          aria-label="Welcome bonus"
        >
          {/* backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 40%, rgba(88,28,135,.85) 0%, rgba(15,23,42,.94) 70%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isFly ? 0 : 1 }}
            transition={{ duration: isFly ? 0.7 : 0.5 }}
          />

          {/* twinkling stars */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {stars.map((s) => (
              <span
                key={s.id}
                className="mc-wb-twinkle absolute rounded-full"
                style={{
                  left: `${s.left}%`,
                  top: `${s.top}%`,
                  width: s.size,
                  height: s.size,
                  background: s.color,
                  "--dur": `${s.dur}s`,
                  "--delay": `${s.delay}s`,
                }}
              />
            ))}
          </div>

          <motion.div
            className="relative flex flex-col items-center"
            animate={{ opacity: isFly ? 0 : 1 }}
            transition={{ duration: 0.25 }}
          >
            {/* ===== scene ===== */}
            <motion.div
              className="relative"
              style={{
                width: SCENE_W,
                height: SCENE_H,
                perspective: 1100,
                touchAction: "none",
                cursor: phase === "gift" ? "pointer" : phase === "open" ? "grab" : "default",
              }}
              onClick={phase === "gift" ? openGift : undefined}
              role={phase === "gift" ? "button" : undefined}
              tabIndex={phase === "gift" ? 0 : -1}
              aria-label={phase === "gift" ? "Open your gift" : undefined}
              onKeyDown={(e) => {
                if (phase === "gift" && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  openGift();
                }
              }}
              {...panProps}
            >
              {/* light rays */}
              <motion.div
                className="pointer-events-none absolute"
                style={{
                  left: SCENE_W / 2 - 260,
                  top: COIN_TOP + COIN / 2 - 260,
                  width: 520,
                  height: 520,
                  WebkitMaskImage: "radial-gradient(circle, black 15%, transparent 68%)",
                  maskImage: "radial-gradient(circle, black 15%, transparent 68%)",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.6 }}
                aria-hidden="true"
              >
                <div
                  className="mc-wb-rays absolute inset-0 rounded-full"
                  style={{
                    background:
                      "repeating-conic-gradient(from 0deg, rgba(251,191,36,.30) 0deg 10deg, transparent 10deg 30deg)",
                  }}
                />
              </motion.div>

              {/* soft golden halo behind the coin */}
              <motion.div
                className="pointer-events-none absolute rounded-full"
                style={{
                  left: SCENE_W / 2 - 130,
                  top: COIN_TOP + COIN / 2 - 130,
                  width: 260,
                  height: 260,
                  background: "radial-gradient(circle, rgba(253,224,71,.45), transparent 70%)",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.6 }}
                aria-hidden="true"
              />

              {/* tap-me pulse ring */}
              {phase === "gift" && (
                <span
                  className="mc-wb-pulse pointer-events-none absolute rounded-full border-2 border-amber-300/70"
                  style={{ left: SCENE_W / 2 - 100, top: BOX_TOP - 40, width: 200, height: 200 }}
                  aria-hidden="true"
                />
              )}

              {/* ground shadow */}
              <div
                className="pointer-events-none absolute rounded-[50%]"
                style={{
                  left: SCENE_W / 2 - 90,
                  top: SCENE_H - 26,
                  width: 180,
                  height: 22,
                  background: "radial-gradient(ellipse, rgba(0,0,0,.55), transparent 70%)",
                }}
                aria-hidden="true"
              />

              {/* floating + shaking wrapper */}
              <motion.div
                className="absolute inset-0"
                style={{ transformStyle: "preserve-3d" }}
                animate={
                  phase === "shake"
                    ? { rotateZ: [0, -7, 7, -6, 6, -3, 0], y: 0 }
                    : phase === "gift"
                      ? { y: [0, -10, 0], rotateZ: 0 }
                      : { y: 0, rotateZ: 0 }
                }
                transition={
                  phase === "shake"
                    ? { duration: 0.6, ease: "easeInOut" }
                    : phase === "gift"
                      ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.4 }
                }
              >
                {/* pointer-driven 3D tilt */}
                <motion.div
                  className="absolute inset-0"
                  style={{ transformStyle: "preserve-3d", rotateX: rotX, rotateY: rotY }}
                >
                  <GiftBox open={isOpen} />

                  {isOpen && (
                    <motion.div
                      ref={coinRef}
                      style={{
                        position: "absolute",
                        left: (SCENE_W - COIN) / 2,
                        top: COIN_TOP,
                        width: COIN,
                        height: COIN,
                        transformStyle: "preserve-3d",
                      }}
                      initial={{ y: 180, scale: 0.3 }}
                      animate={{ y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 70, damping: 11, delay: 0.1 }}
                    >
                      <motion.div
                        style={{ width: "100%", height: "100%", transformStyle: "preserve-3d" }}
                        animate={{ y: [0, -9, 0] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <motion.div
                          style={{
                            width: "100%",
                            height: "100%",
                            transformStyle: "preserve-3d",
                            rotateY: coinSpin,
                            rotateX: coinTilt,
                          }}
                        >
                          <CoinBody />
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>

              {/* confetti burst from the coin */}
              {burst && phase === "open" && (
                <div
                  className="pointer-events-none absolute"
                  style={{ left: SCENE_W / 2, top: COIN_TOP + COIN / 2 }}
                  aria-hidden="true"
                >
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
            </motion.div>

            {/* ===== text + actions ===== */}
            <div className="relative -mt-2 px-6 text-center text-white">
              {!isOpen ? (
                <motion.div
                  key="gift-text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-200">
                    <Gift size={14} /> Welcome to MNCConnect
                  </p>
                  <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">You have a gift waiting</h2>
                  <button
                    type="button"
                    onClick={openGift}
                    disabled={phase !== "gift"}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/30 transition hover:scale-105 active:scale-95 disabled:opacity-70"
                  >
                    <Sparkles size={16} /> Tap to open
                  </button>
                  <p className="mt-3 text-xs text-slate-300">Move your mouse or finger to look around it</p>
                </motion.div>
              ) : (
                <motion.div
                  key="open-text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">
                    Welcome bonus unlocked
                  </p>
                  <p className="mt-1 bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-6xl font-black tabular-nums text-transparent">
                    {inr(amount)}
                  </p>
                  <button
                    type="button"
                    onClick={startFly}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 px-7 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-emerald-500/30 transition hover:scale-105 active:scale-95"
                  >
                    <Wallet size={16} /> Add {inr(WELCOME_BONUS)} to my wallet
                  </button>
                  <p className="mt-3 text-xs text-slate-300">Drag the coin to spin it</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ---------------- 3D coin flying to the navbar wallet ---------------- */}
      {isFly && (
        <div
          className="pointer-events-none fixed z-[121]"
          style={{ left: dest.sx, top: dest.sy }}
          aria-hidden="true"
        >
          {[2, 1].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: COIN - i * 24,
                height: COIN - i * 24,
                marginLeft: -(COIN - i * 24) / 2,
                marginTop: -(COIN - i * 24) / 2,
                background: "radial-gradient(circle at 30% 30%, #fde68a, #f59e0b)",
                willChange: "transform, opacity",
              }}
              initial={{ x: 0, y: 0, scale: 1, opacity: 0 }}
              animate={{
                x: [0, dest.dx * 0.5, dest.dx],
                y: [0, dest.my, dest.dy],
                scale: [1, 1.1, 0.25],
                opacity: [0, 0.5, 0],
              }}
              transition={{ duration: 1, delay: 0.09 * i, ease: "easeInOut", times: [0, 0.45, 1] }}
            />
          ))}

          <motion.div
            style={{
              position: "absolute",
              left: -COIN / 2,
              top: -COIN / 2,
              width: COIN,
              height: COIN,
              perspective: 700,
              willChange: "transform",
            }}
            initial={{ x: 0, y: 0, scale: 1 }}
            animate={{
              x: [0, dest.dx * 0.5, dest.dx],
              y: [0, dest.my, dest.dy],
              scale: [1, 1.15, 0.3],
            }}
            transition={{ duration: 1, ease: "easeInOut", times: [0, 0.45, 1] }}
          >
            <motion.div
              style={{ width: "100%", height: "100%", transformStyle: "preserve-3d" }}
              initial={{ rotateY: dest.spin, rotateX: 0 }}
              animate={{ rotateY: dest.spin + 1080, rotateX: [0, 25, 0] }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <CoinBody />
            </motion.div>
          </motion.div>
        </div>
      )}

      {/* ---------------- impact on the navbar wallet ---------------- */}
      {phase === "impact" && (
        <div
          className="pointer-events-none fixed z-[121]"
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