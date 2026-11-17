import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { speakSequence, stopSpeaking, isSpeechSupported } from "../../utils/speak";

/**
 * VoiceTour
 *  stage "hint" -> page blurs, only the speaker button is clear, a hand points at it
 *  stage "talk" -> presenter (man with mic) speaks, words appear in a cloud bubble,
 *                  and the spotlight moves section by section (live requests, earnings...)
 *
 * steps = [{ text, speak?, target? }]   target = CSS selector, e.g. '[data-tour="requests"]'
 * avatarSrc (optional) = transparent PNG/WebP of a real person; replaces the SVG man
 */

const HINT_TARGET = '[data-tour="speaker"]';

const css = `
@keyframes tour-poke { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
@keyframes tour-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(96,165,250,.6) } 50% { box-shadow: 0 0 0 12px rgba(96,165,250,0) } }
@keyframes tour-mouth { 0%,100% { transform: scaleY(.35) } 50% { transform: scaleY(2.8) } }
@keyframes tour-nod { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(2deg) } }
@keyframes tour-wave { 0% { opacity: .8; transform: scale(.5) } 100% { opacity: 0; transform: scale(2.6) } }
@keyframes tour-blink { 0%,92%,100% { transform: scaleY(1) } 96% { transform: scaleY(.1) } }
@keyframes tour-pop { from { opacity: 0; transform: translateY(28px) scale(.96) } to { opacity: 1; transform: none } }
.tour-poke { animation: tour-poke 1s ease-in-out infinite }
.tour-glow { animation: tour-glow 1.6s ease-out infinite }
.tour-pop { animation: tour-pop .45s cubic-bezier(.2,.7,.2,1) both }
.tour-svg { transform-box: fill-box; transform-origin: center }
.tour-mouth { animation: tour-mouth .26s ease-in-out infinite }
.tour-nod { animation: tour-nod 1.1s ease-in-out infinite; transform-origin: 50% 90% }
.tour-wave { animation: tour-wave 1.1s ease-out infinite }
.tour-blink { animation: tour-blink 4s infinite }
@media (prefers-reduced-motion: reduce) {
  .tour-poke, .tour-glow, .tour-pop, .tour-nod, .tour-wave { animation: none }
}
`;

/* ---------------- presenter: man with headset mic ---------------- */

const Presenter = ({ talking, avatarSrc }) => {
  if (avatarSrc) {
    return (
      <img
        src={avatarSrc}
        alt=""
        className={`h-auto w-full select-none ${talking ? "tour-nod" : ""}`}
        draggable={false}
      />
    );
  }

  return (
    <svg viewBox="0 0 160 230" className="h-auto w-full" aria-hidden="true">
      <ellipse cx="80" cy="227" rx="64" ry="4" fill="rgba(15,23,42,.18)" />

      {/* suit, shirt, tie */}
      <path d="M8 230 C8 178 38 154 80 154 C122 154 152 178 152 230 Z" fill="#1e293b" />
      <path d="M62 152 L80 190 L98 152 Z" fill="#ffffff" />
      <path d="M62 152 L48 162 L70 216 L80 190 Z" fill="#0f172a" />
      <path d="M98 152 L112 162 L90 216 L80 190 Z" fill="#0f172a" />
      <path d="M74 166 H86 L90 204 L80 214 L70 204 Z" fill="#2563eb" />
      <rect x="68" y="124" width="24" height="32" rx="9" fill="#d99a70" />

      <g className={`tour-svg ${talking ? "tour-nod" : ""}`}>
        {/* ears */}
        <circle cx="48" cy="98" r="6" fill="#e3a77c" />
        <circle cx="112" cy="98" r="6" fill="#e3a77c" />
        {/* head */}
        <ellipse cx="80" cy="96" rx="32" ry="38" fill="#f0b48a" />
        {/* hair */}
        <path
          d="M47 92 C42 52 72 44 84 46 C112 46 122 68 113 92 C108 76 98 68 80 68 C62 68 52 76 47 92 Z"
          fill="#1f2937"
        />
        {/* brows */}
        <path d="M60 84 q7 -4 13 -1" stroke="#1f2937" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M87 83 q7 -3 13 1" stroke="#1f2937" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {/* eyes */}
        <circle cx="67" cy="94" r="2.8" fill="#0f172a" className="tour-svg tour-blink" />
        <circle cx="93" cy="94" r="2.8" fill="#0f172a" className="tour-svg tour-blink" />
        {/* nose */}
        <path d="M80 98 q-4 8 1 10" stroke="#c4825a" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* mouth */}
        {talking ? (
          <ellipse cx="80" cy="119" rx="8" ry="3" fill="#7f1d1d" className="tour-svg tour-mouth" />
        ) : (
          <path d="M71 118 q9 7 18 0" stroke="#7f1d1d" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        )}

        {/* headset */}
        <path d="M46 92 C44 54 116 54 114 92" stroke="#0f172a" strokeWidth="4" fill="none" strokeLinecap="round" />
        <rect x="39" y="90" width="10" height="22" rx="5" fill="#0f172a" />
        <rect x="111" y="90" width="10" height="22" rx="5" fill="#0f172a" />
        <path d="M44 108 C44 132 58 132 68 122" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="69" cy="122" r="4.5" fill="#0f172a" />
        <circle cx="68" cy="121" r="1.4" fill="#475569" />

        {/* sound waves from the mic */}
        {talking &&
          [0, 0.5].map((d) => (
            <circle
              key={d}
              cx="69"
              cy="122"
              r="6"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="1.6"
              className="tour-svg tour-wave"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
      </g>
    </svg>
  );
};

/* ---------------- cloud bubble ---------------- */

const Cloud = ({ side, text, shown, index, total, onStop }) => (
  <div
    className="relative mb-10 w-full"
    style={{ filter: "drop-shadow(0 10px 18px rgba(15,23,42,.30))" }}
  >
    {/* cloud bumps */}
    <span className="absolute -top-3 left-8 h-9 w-9 rounded-full bg-white" />
    <span className="absolute -top-5 left-1/2 h-11 w-11 -translate-x-1/2 rounded-full bg-white" />
    <span className="absolute -top-3 right-8 h-9 w-9 rounded-full bg-white" />
    <span className="absolute -left-3 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-white" />
    <span className="absolute -right-3 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-white" />
    <span className="absolute -bottom-3 left-10 h-8 w-8 rounded-full bg-white" />
    <span className="absolute -bottom-3 right-12 h-9 w-9 rounded-full bg-white" />

    <div className="relative rounded-[1.75rem] bg-white px-5 py-4">
      <div className="relative">
        {/* invisible full text keeps the cloud from resizing while typing */}
        <p className="invisible text-sm leading-6">{text}</p>
        <p className="absolute inset-0 text-sm font-medium leading-6 text-slate-800">
          {shown}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-blue-600" : i < index ? "w-1.5 bg-blue-300" : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onStop}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 active:scale-95"
        >
          <X size={12} /> Stop
        </button>
      </div>
    </div>

    {/* tail dots pointing to the presenter */}
    <span
      className={`absolute -bottom-6 h-3.5 w-3.5 rounded-full bg-white ${side === "right" ? "right-12" : "left-12"}`}
    />
    <span
      className={`absolute -bottom-9 h-2.5 w-2.5 rounded-full bg-white ${side === "right" ? "right-16" : "left-16"}`}
    />
  </div>
);

/* ---------------- main ---------------- */

const VoiceTour = ({
  stage, // null | "hint" | "talk"
  steps = [],
  avatarSrc,
  onDone, // tour finished by itself
  onStop, // user pressed Stop
  onHintSkip, // user pressed "Maybe later" on the hint
  onTalkingChange,
}) => {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState(0);
  const [talking, setTalking] = useState(false);
  const [rect, setRect] = useState(null);

  const cb = useRef({});
  cb.current = { onDone, onTalkingChange };

  const current = steps[idx];

  /* narration: one line at a time, so the caption and spotlight stay in sync */
  useEffect(() => {
    if (stage !== "talk" || !steps.length) return undefined;
    let cancelled = false;
    let timer;

    const setTalk = (v) => {
      setTalking(v);
      cb.current.onTalkingChange?.(v);
    };

    const next = (i) => {
      if (cancelled) return;
      timer = setTimeout(() => run(i + 1), 450);
    };

    const run = (i) => {
      if (cancelled) return;
      if (i >= steps.length) {
        setTalk(false);
        cb.current.onDone?.();
        return;
      }
      setIdx(i);
      const line = steps[i].speak || steps[i].text;

      if (!isSpeechSupported()) {
        // no voice in this browser: captions only
        setTalk(true);
        timer = setTimeout(() => {
          setTalk(false);
          next(i);
        }, Math.max(2500, steps[i].text.length * 55));
        return;
      }

      speakSequence([line], {
        onStart: () => setTalk(true),
        onEnd: () => {
          if (cancelled) return;
          setTalk(false);
          next(i);
        },
      });
    };

    run(0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopSpeaking();
      setTalking(false);
      cb.current.onTalkingChange?.(false);
    };
  }, [stage, steps]);

  /* typewriter caption */
  useEffect(() => {
    if (stage !== "talk") return undefined;
    const len = (steps[idx]?.text || "").length;
    setTyped(0);
    const t = setInterval(() => {
      setTyped((c) => {
        if (c >= len) {
          clearInterval(t);
          return c;
        }
        return c + 1;
      });
    }, 28);
    return () => clearInterval(t);
  }, [stage, idx, steps]);

  /* find + follow the spotlight target */
  useEffect(() => {
    if (!stage) return undefined;
    const selector = stage === "hint" ? HINT_TARGET : current?.target;

    const measure = () => {
      const el = selector ? document.querySelector(selector) : null;
      if (!el) {
        setRect((p) => (p === null ? p : null));
        return;
      }
      const r = el.getBoundingClientRect();
      const n = { x: r.left, y: r.top, w: r.width, h: r.height };
      setRect((p) =>
        p && p.x === n.x && p.y === n.y && p.w === n.w && p.h === n.h ? p : n,
      );
    };

    if (stage === "talk" && selector) {
      document
        .querySelector(selector)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    measure();
    const t = setInterval(measure, 120);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", measure);
    };
  }, [stage, current?.target]);

  if (!stage) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const hole = rect
    ? {
        x1: Math.max(6, rect.x - 10),
        y1: Math.max(6, rect.y - 10),
        x2: Math.min(vw - 6, rect.x + rect.w + 10),
        y2: Math.min(vh - 6, rect.y + rect.h + 10),
      }
    : null;
  const validHole = hole && hole.x2 > hole.x1 && hole.y2 > hole.y1 ? hole : null;

  // polygon with a rectangular hole: the blur covers everything except the target
  const clip = validHole
    ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${validHole.x1}px ${validHole.y1}px, ${validHole.x1}px ${validHole.y2}px, ${validHole.x2}px ${validHole.y2}px, ${validHole.x2}px ${validHole.y1}px, ${validHole.x1}px ${validHole.y1}px)`
    : undefined;

  const side =
    validHole && (validHole.x1 + validHole.x2) / 2 > vw / 2 ? "left" : "right";

  const full = current?.text || "";

  return (
    <>
      <style>{css}</style>

      {/* blur + dim layer (the hole stays clear and clickable) */}
      <div
        className="fixed inset-0 z-[100] bg-slate-900/45 backdrop-blur-md"
        style={{ clipPath: clip, WebkitClipPath: clip, transition: "clip-path .45s ease" }}
      />

      {/* glowing frame around the highlighted element */}
      {validHole && (
        <div
          className="tour-glow pointer-events-none fixed z-[101] rounded-2xl ring-2 ring-blue-400"
          style={{
            left: validHole.x1,
            top: validHole.y1,
            width: validHole.x2 - validHole.x1,
            height: validHole.y2 - validHole.y1,
            transition: "all .45s ease",
          }}
        />
      )}

      {/* ---------- stage 1: pointing hand at the speaker ---------- */}
      {stage === "hint" && rect && (
        <>
          <div
            className="tour-poke pointer-events-none fixed z-[102] select-none text-5xl leading-none"
            style={{
              left: rect.x + rect.w / 2,
              top: rect.y + rect.h + 14,
              transform: "translateX(-50%)",
              filter: "drop-shadow(0 6px 8px rgba(0,0,0,.35))",
            }}
            aria-hidden="true"
          >
            👆
          </div>
          <div
            role="status"
            className="pointer-events-none fixed z-[102] w-56 rounded-xl bg-white px-3 py-2 text-center text-sm font-semibold text-slate-900 shadow-xl"
            style={{
              left: Math.min(Math.max(rect.x + rect.w / 2, 120), vw - 120),
              top: rect.y + rect.h + 78,
              transform: "translateX(-50%)",
            }}
          >
            Tap the speaker to meet your guide
          </div>
          <button
            type="button"
            onClick={onHintSkip}
            className="fixed bottom-6 left-1/2 z-[102] -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg transition hover:bg-white active:scale-95"
          >
            Maybe later
          </button>
        </>
      )}

      {/* ---------- stage 2: presenter + cloud caption ---------- */}
      {stage === "talk" && current && (
        <div
          className={`tour-pop fixed bottom-0 z-[110] flex w-[min(330px,90vw)] flex-col p-3 ${
            side === "right" ? "right-0 items-end" : "left-0 items-start"
          }`}
        >
          <Cloud
            side={side}
            text={full}
            shown={full.slice(0, typed)}
            index={idx}
            total={steps.length}
            onStop={onStop}
          />
          <div className="w-32 sm:w-40">
            <Presenter talking={talking} avatarSrc={avatarSrc} />
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceTour;