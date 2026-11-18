import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";

/**
 * VoiceTour
 *  stage "hint" -> page blurs, only the speaker button is clear, a hand points at it
 *  stage "talk" -> presenter speaks, words appear in the cloud AS they are spoken,
 *                  spotlight moves section by section (page sections + sidebar items).
 *
 * steps = [{ text, speak?, target? }]   target = CSS selector, e.g. '[data-tour="requests"]'
 *   text  -> what the cloud shows
 *   speak -> (optional) what the voice says (use it for "MNC" -> "M N C", "₹500" -> "500 rupees")
 *
 * Speech is queued up-front with the browser's own speechSynthesis queue, so
 * there is NO gap between sentences. Words in the cloud follow the voice.
 *
 * Sidebar: when a step targets a [data-tour="nav-..."] item on a small screen,
 * the mobile drawer is opened automatically (MentorSidebar listens for
 * "sidebar:open" / "sidebar:close") and closed again afterwards.
 */

const HINT_TARGET = '[data-tour="speaker"]';
const SIDEBAR_OPEN_EVENT = "sidebar:open";
const SIDEBAR_CLOSE_EVENT = "sidebar:close";

const isNavTarget = (sel) =>
  typeof sel === "string" && sel.includes('data-tour="nav-');
const isSmallScreen = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 1023px)").matches;

const css = `
@keyframes tour-poke { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
@keyframes tour-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(96,165,250,.6) } 50% { box-shadow: 0 0 0 12px rgba(96,165,250,0) } }
@keyframes tour-mouth { 0% { transform: scaleY(.35) } 18% { transform: scaleY(1.15) } 34% { transform: scaleY(.55) } 52% { transform: scaleY(1.3) } 68% { transform: scaleY(.45) } 84% { transform: scaleY(1) } 100% { transform: scaleY(.35) } }
@keyframes tour-nod { 0%,100% { transform: rotate(0deg) translateY(0) } 30% { transform: rotate(1.4deg) translateY(1px) } 65% { transform: rotate(-1.2deg) translateY(0) } }
@keyframes tour-breathe { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
@keyframes tour-wave { 0% { opacity: .85; transform: scale(.5) } 100% { opacity: 0; transform: scale(2.8) } }
@keyframes tour-blink { 0%,92%,100% { transform: scaleY(1) } 96% { transform: scaleY(.08) } }
@keyframes tour-pop { from { opacity: 0; transform: translateY(28px) scale(.96) } to { opacity: 1; transform: none } }
@keyframes tour-fade { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
.tour-poke { animation: tour-poke 1s ease-in-out infinite }
.tour-glow { animation: tour-glow 1.6s ease-out infinite }
.tour-pop { animation: tour-pop .45s cubic-bezier(.2,.7,.2,1) both }
.tour-fade { animation: tour-fade .35s ease both }
.tour-svg { transform-box: fill-box; transform-origin: center }
.tour-mouth { animation: tour-mouth .6s linear infinite }
.tour-nod { animation: tour-nod 1.6s ease-in-out infinite; transform-origin: 50% 85%; transform-box: fill-box }
.tour-breathe { animation: tour-breathe 3.2s ease-in-out infinite }
.tour-wave { animation: tour-wave 1.1s ease-out infinite }
.tour-blink { animation: tour-blink 4.2s infinite }
@media (prefers-reduced-motion: reduce) {
  .tour-poke, .tour-glow, .tour-pop, .tour-fade, .tour-nod, .tour-wave, .tour-breathe { animation: none }
}
`;

/* ---------------- speech helpers (browser speechSynthesis) ---------------- */

const hasSpeech = () =>
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof window.SpeechSynthesisUtterance !== "undefined";

let cachedVoice = null;

// Prefer a LOCAL English male voice: local voices start instantly (no network
// gap between sentences) and fire word-boundary events reliably.
const pickVoice = () => {
  if (!hasSpeech()) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  if (cachedVoice && voices.includes(cachedVoice)) return cachedVoice;

  const score = (v) => {
    if (!/^en/i.test(v.lang)) return -100;
    let s = 0;
    if (v.localService) s += 6;
    if (/natural|neural/i.test(v.name)) s += 4;
    if (/david|mark|guy|ryan|prabhat|ravi|daniel|alex|male/i.test(v.name)) s += 3;
    if (/en-IN/i.test(v.lang)) s += 1;
    if (/google/i.test(v.name)) s -= 2; // Google voices are online + no word events
    return s;
  };

  cachedVoice = [...voices].sort((a, b) => score(b) - score(a))[0] || null;
  return cachedVoice;
};

if (hasSpeech()) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
  };
}

/* ---------------- presenter: real video / photo / shaded SVG man ---------------- */

const VideoAvatar = ({ src, talking }) => {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (talking) v.play().catch(() => {});
    else v.pause();
  }, [talking]);
  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="auto"
      className="aspect-[3/4] w-full rounded-2xl border-4 border-white bg-slate-200 object-cover shadow-2xl"
    />
  );
};

const Presenter = ({ talking, avatarSrc, avatarVideo }) => {
  if (avatarVideo) return <VideoAvatar src={avatarVideo} talking={talking} />;

  if (avatarSrc) {
    return (
      <img
        src={avatarSrc}
        alt=""
        className={`h-auto w-full select-none ${talking ? "tour-nod" : "tour-breathe"}`}
        draggable={false}
      />
    );
  }

  return (
    <svg viewBox="0 0 200 260" className="h-auto w-full" aria-hidden="true">
      <defs>
        <linearGradient id="tg-suit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b4a63" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="tg-shirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9e0ea" />
        </linearGradient>
        <linearGradient id="tg-tie" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e40af" />
        </linearGradient>
        <radialGradient id="tg-skin" cx="0.42" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#f9d2ae" />
          <stop offset="0.55" stopColor="#ebb28a" />
          <stop offset="1" stopColor="#c98860" />
        </radialGradient>
        <linearGradient id="tg-neck" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b97a52" />
          <stop offset="0.5" stopColor="#d69a70" />
          <stop offset="1" stopColor="#c98860" />
        </linearGradient>
        <linearGradient id="tg-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a403a" />
          <stop offset="1" stopColor="#0f0d0c" />
        </linearGradient>
      </defs>

      <g className={talking ? "" : "tour-svg tour-breathe"}>
        {/* torso */}
        <path
          d="M0 260 C0 205 28 178 70 170 L130 170 C172 178 200 205 200 260 Z"
          fill="url(#tg-suit)"
        />
        {/* shirt + collar */}
        <path d="M82 166 L100 200 L118 166 Z" fill="url(#tg-shirt)" />
        <path d="M80 163 L100 192 L92 201 L72 176 Z" fill="#f1f5f9" />
        <path d="M120 163 L100 192 L108 201 L128 176 Z" fill="#e2e8f0" />
        {/* lapels */}
        <path d="M70 172 L84 210 L97 236 L74 240 L56 200 Z" fill="#1b2538" />
        <path d="M130 172 L116 210 L103 236 L126 240 L144 200 Z" fill="#1b2538" />
        <path d="M70 172 L84 210" stroke="#475569" strokeWidth="1.2" />
        <path d="M130 172 L116 210" stroke="#475569" strokeWidth="1.2" />
        {/* tie */}
        <path d="M94 195 L106 195 L103 206 L97 206 Z" fill="#2563eb" />
        <path d="M97 206 L103 206 L109 248 L100 260 L91 248 Z" fill="url(#tg-tie)" />

        {/* neck + chin shadow */}
        <path
          d="M85 136 L85 168 C92 177 108 177 115 168 L115 136 Z"
          fill="url(#tg-neck)"
        />
        <ellipse cx="100" cy="152" rx="20" ry="7" fill="rgba(80,40,20,.28)" />

        {/* head group nods while talking */}
        <g className={talking ? "tour-nod" : ""}>
          {/* ears */}
          <ellipse cx="62" cy="100" rx="5.5" ry="10" fill="#d69a70" />
          <ellipse cx="138" cy="100" rx="5.5" ry="10" fill="#d69a70" />
          {/* face */}
          <path
            d="M62 92 C62 60 78 46 100 46 C122 46 138 60 138 92 C138 112 132 132 118 144 C110 151 90 151 82 144 C68 132 62 112 62 92 Z"
            fill="url(#tg-skin)"
          />
          {/* jaw shadow / light stubble */}
          <path
            d="M70 114 C74 134 88 146 100 147 C112 146 126 134 130 114 C124 132 112 140 100 140 C88 140 76 132 70 114 Z"
            fill="rgba(60,30,20,.10)"
          />
          {/* cheeks */}
          <ellipse cx="78" cy="112" rx="9" ry="6" fill="rgba(220,120,100,.12)" />
          <ellipse cx="122" cy="112" rx="9" ry="6" fill="rgba(220,120,100,.12)" />

          {/* hair */}
          <path
            d="M60 90 C54 52 76 34 102 36 C130 36 148 54 140 90 C139 74 132 64 120 59 C108 55 90 57 80 63 C68 69 62 78 60 90 Z"
            fill="url(#tg-hair)"
          />
          <path
            d="M82 50 C96 44 114 46 126 56"
            stroke="rgba(255,255,255,.14)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          {/* sideburns */}
          <path d="M62 90 L66 108 L68 92 Z" fill="#1a1613" />
          <path d="M138 90 L134 108 L132 92 Z" fill="#1a1613" />

          {/* brows */}
          <path d="M73 82 C79 76 90 76 95 81" stroke="#2a211c" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M105 81 C110 76 121 76 127 82" stroke="#2a211c" strokeWidth="3.2" fill="none" strokeLinecap="round" />

          {/* eyes */}
          <g className="tour-svg tour-blink">
            <ellipse cx="84" cy="92" rx="6.6" ry="3.7" fill="#ffffff" />
            <ellipse cx="116" cy="92" rx="6.6" ry="3.7" fill="#ffffff" />
            <circle cx="85" cy="92" r="3.2" fill="#3b2a1e" />
            <circle cx="117" cy="92" r="3.2" fill="#3b2a1e" />
            <circle cx="85" cy="92" r="1.5" fill="#0b0b0b" />
            <circle cx="117" cy="92" r="1.5" fill="#0b0b0b" />
            <circle cx="86" cy="90.8" r="0.9" fill="#ffffff" />
            <circle cx="118" cy="90.8" r="0.9" fill="#ffffff" />
          </g>
          <path d="M77 89 C81 85.5 88 85.5 91 89" stroke="#7a4a30" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M109 89 C112 85.5 119 85.5 123 89" stroke="#7a4a30" strokeWidth="1.4" fill="none" strokeLinecap="round" />

          {/* nose */}
          <path d="M100 94 C98 106 94 110 94 114 C98 117 102 117 106 114 C106 110 102 106 100 94" fill="none" stroke="rgba(120,70,40,.45)" strokeWidth="1.3" strokeLinecap="round" />
          <ellipse cx="96.5" cy="115" rx="1.6" ry="1" fill="rgba(80,40,25,.5)" />
          <ellipse cx="103.5" cy="115" rx="1.6" ry="1" fill="rgba(80,40,25,.5)" />

          {/* mouth */}
          {talking ? (
            <g className="tour-svg tour-mouth">
              <path d="M88 127 C94 123.5 106 123.5 112 127 C109 137 91 137 88 127 Z" fill="#5a1f1f" />
              <path d="M92 127.6 C97 126.2 103 126.2 108 127.6 L107 130.2 L93 130.2 Z" fill="#ffffff" />
              <path d="M91 133 C96 135.5 104 135.5 109 133 C106 136 94 136 91 133 Z" fill="#c4564f" />
              <path d="M88 127 C94 123.5 106 123.5 112 127" stroke="#a3524a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <path d="M88 128 C94 125 106 125 112 128 C106 132.5 94 132.5 88 128 Z" fill="#b5655a" />
              <path d="M88 128 C95 129.4 105 129.4 112 128" stroke="#7a3a34" strokeWidth="1.2" fill="none" />
            </g>
          )}

          {/* headset */}
          <path d="M62 84 C58 36 142 36 138 84" stroke="#0f172a" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <rect x="51" y="88" width="13" height="25" rx="6" fill="#111827" />
          <rect x="136" y="88" width="13" height="25" rx="6" fill="#111827" />
          <rect x="54" y="92" width="4" height="16" rx="2" fill="#374151" />
          <path d="M56 112 C56 142 76 146 90 137" stroke="#111827" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="92" cy="136.5" rx="6.5" ry="4.2" fill="#111827" />
          <ellipse cx="91" cy="135.4" rx="3" ry="1.6" fill="#4b5563" />

          {talking &&
            [0, 0.55].map((d) => (
              <circle
                key={d}
                cx="92"
                cy="136.5"
                r="6"
                fill="none"
                stroke="#60a5fa"
                strokeWidth="1.6"
                className="tour-svg tour-wave"
                style={{ animationDelay: `${d}s` }}
              />
            ))}
        </g>
      </g>
    </svg>
  );
};

/* ---------------- cloud bubble ---------------- */

// organic scalloped edge: [left %, top %, size px] (centres sit ON the edge,
// so half of every puff sticks out and the outline looks like a real cloud)
const PUFFS = [
  // top edge
  [10, 0, 42], [27, -1, 56], [47, 1, 46], [66, -2, 60], [86, 0, 46],
  // right edge
  [100, 24, 48], [101, 52, 60], [100, 80, 46],
  // bottom edge
  [90, 100, 44], [70, 101, 56], [49, 99, 48], [28, 102, 58], [10, 100, 42],
  // left edge
  [0, 78, 46], [-1, 50, 60], [0, 24, 48],
];

const Cloud = ({ side, text, shown, index, total, onNext, onStop }) => {
  const isLast = index >= total - 1;
  // tail = 3 shrinking thought-puffs leading down to the presenter
  const tail = [
    { size: 17, bottom: -30, off: 58 },
    { size: 12, bottom: -44, off: 48 },
    { size: 8, bottom: -55, off: 42 },
  ];

  return (
    <div
      className="relative mx-7 mb-14 mt-6"
      style={{
        width: "calc(100% - 3.5rem)",
        filter:
          "drop-shadow(0 14px 22px rgba(15,23,42,.30)) drop-shadow(0 2px 3px rgba(15,23,42,.18))",
      }}
    >
      {/* cloud puffs */}
      {PUFFS.map(([l, t, sz], i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute rounded-full bg-white"
          style={{
            left: `${l}%`,
            top: `${t}%`,
            width: sz,
            height: sz,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {/* cloud body */}
      <div className="relative rounded-[2rem] bg-white px-5 py-5">
        {/* key = step index -> each new sentence fades in smoothly */}
        <div key={index} className="tour-fade relative">
          {/* invisible full text keeps the cloud from resizing while words appear */}
          <p className="invisible text-sm leading-6">{text}</p>
          <p className="absolute inset-0 text-sm font-medium leading-6 text-slate-800">
            {shown}
          </p>
        </div>

        <div className="relative z-10 mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onNext}
            className="inline-flex touch-manipulation items-center gap-1 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
          >
            {isLast ? "Finish" : "Next"}
            {isLast ? <Check size={13} /> : <ChevronRight size={13} />}
          </button>
          <button
            type="button"
            onClick={onStop}
            className="inline-flex touch-manipulation items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 active:scale-95"
          >
            <X size={12} /> Stop
          </button>
        </div>
      </div>

      {/* thought tail pointing to the presenter */}
      {tail.map((t, i) => (
        <span
          key={`tail-${i}`}
          aria-hidden="true"
          className="absolute rounded-full bg-white"
          style={{
            width: t.size,
            height: t.size,
            bottom: t.bottom,
            [side === "right" ? "right" : "left"]: t.off,
          }}
        />
      ))}
    </div>
  );
};

/* ---------------- main ---------------- */

const VoiceTour = ({
  stage, // null | "hint" | "talk"
  steps = [],
  stepsComplete = true, // set false while sentences are still arriving; true when generation finishes
  avatarSrc,
  avatarVideo,
  onDone, // tour finished (last line done, or Finish pressed)
  onStop, // user pressed Stop
  onHintSkip, // user pressed "Maybe later" on the hint
  onTalkingChange,
}) => {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState(0);
  const [talking, setTalking] = useState(false);
  const [rect, setRect] = useState(null);

  const cb = useRef({});
  cb.current = { onDone, onTalkingChange, onStop };
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const completeRef = useRef(stepsComplete);
  completeRef.current = stepsComplete;
  const ctrl = useRef({});

  const current = steps[idx];

  /* ------------------------------------------------------------------
     Narration engine
     - every step is queued on the browser speech queue up-front, so the
       next sentence starts the instant the previous one ends (no gap)
     - cloud words are revealed from the voice's word-boundary events
     - "Next" cancels the queue and re-queues from the next step
  ------------------------------------------------------------------ */
  useEffect(() => {
    if (stage !== "talk") return undefined;

    const synth = hasSpeech() ? window.speechSynthesis : null;

    let alive = true;
    let gen = 0; // bumps on every restart; stale callbacks check it
    let queued = 0; // next step index to queue
    let pending = 0; // utterances queued but not finished
    let cur = 0; // step currently being spoken
    let ready = false;
    let finished = false;
    let fbBusy = false;

    const timers = new Set();
    const keep = []; // hold utterance refs (prevents Chrome GC dropping events)

    const later = (fn, ms) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const clearTimers = () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };

    const setTalk = (v) => {
      if (!alive) return;
      setTalking(v);
      cb.current.onTalkingChange?.(v);
    };

    const finish = () => {
      if (!alive || finished) return;
      finished = true;
      setTalk(false);
      cb.current.onDone?.();
    };

    const maybeFinish = () => {
      if (!alive || finished) return;
      if (
        pending === 0 &&
        queued >= stepsRef.current.length &&
        completeRef.current
      ) {
        finish();
      }
    };

    /* ----- browser speech: queue one step ----- */
    const queueStep = (i, myGen) => {
      const step = stepsRef.current[i] || {};
      const display = String(step.text || step.speak || "");
      const line = String(step.speak || step.text || "").trim();
      if (!line) return;

      const dWords = display.match(/\S+\s*/g) || [];
      const sCount = (line.match(/\S+/g) || []).length || 1;

      let boundarySeen = false;
      let shownMax = 0;
      let fbStart = null;
      let fbInt = null;

      const stale = () => !alive || myGen !== gen;
      const clearFb = () => {
        if (fbStart !== null) clearTimeout(fbStart);
        if (fbInt !== null) clearInterval(fbInt);
        fbStart = null;
        fbInt = null;
      };
      const reveal = (n) => {
        const c = Math.min(dWords.length, Math.max(shownMax, n));
        if (c === shownMax) return;
        shownMax = c;
        setTyped(dWords.slice(0, c).join("").length);
      };
      const complete = () => {
        clearFb();
        if (stale()) return;
        reveal(dWords.length);
        pending = Math.max(0, pending - 1);
        if (pending === 0) {
          if (queued >= stepsRef.current.length) setTalk(false);
          maybeFinish();
        }
      };

      const u = new window.SpeechSynthesisUtterance(line);
      const v = pickVoice();
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else {
        u.lang = "en-US";
      }
      u.rate = 1;
      u.pitch = 1;
      u.volume = 1;

      u.onstart = () => {
        if (stale()) return;
        cur = i;
        shownMax = 0;
        setIdx(i);
        setTyped(0);
        setTalk(true);

        // some voices (online / mobile) never fire word boundaries:
        // if none arrive shortly, reveal words on an estimated timeline
        fbStart = setTimeout(() => {
          fbStart = null;
          if (boundarySeen || stale()) return;
          const dur = Math.max(1200, line.length * 62);
          const gap = Math.max(60, dur / Math.max(1, dWords.length));
          fbInt = setInterval(() => {
            if (stale()) {
              clearFb();
              return;
            }
            reveal(shownMax + 1);
            if (shownMax >= dWords.length) {
              clearInterval(fbInt);
              fbInt = null;
            }
          }, gap);
        }, 350);
      };

      u.onboundary = (e) => {
        if (stale()) return;
        if (e.name && e.name !== "word") return;
        boundarySeen = true;
        clearFb();
        const before = (line.slice(0, e.charIndex || 0).match(/\S+/g) || [])
          .length;
        // maps spoken-word position onto displayed words even when the
        // "speak" text differs from the "text" shown in the cloud
        reveal(Math.ceil(((before + 1) / sCount) * dWords.length));
      };

      u.onend = complete;
      u.onerror = (e) => {
        if (e && (e.error === "canceled" || e.error === "interrupted")) {
          clearFb();
          return;
        }
        complete();
      };

      pending += 1;
      keep.push(u);
      synth.speak(u);
    };

    /* ----- fallback when speech is not supported: timed reveal ----- */
    const fallbackPump = (myGen) => {
      if (!alive || myGen !== gen || finished) return;
      const list = stepsRef.current;

      if (queued >= list.length) {
        fbBusy = false;
        setTalk(false);
        maybeFinish();
        return;
      }

      fbBusy = true;
      const i = queued++;
      const step = list[i] || {};
      const display = String(step.text || step.speak || "");
      const line = String(step.speak || step.text || "").trim();
      if (!line) {
        fallbackPump(myGen);
        return;
      }

      cur = i;
      setIdx(i);
      setTyped(0);
      setTalk(true);

      const dWords = display.match(/\S+\s*/g) || [];
      const dur = Math.max(1800, line.length * 55);
      const startedAt = Date.now();
      const iv = setInterval(() => {
        if (!alive || myGen !== gen) {
          clearInterval(iv);
          return;
        }
        const p = Math.min(1, (Date.now() - startedAt) / dur);
        const c = Math.ceil(dWords.length * p);
        setTyped(dWords.slice(0, c).join("").length);
        if (p >= 1) clearInterval(iv);
      }, 40);

      later(() => {
        clearInterval(iv);
        fallbackPump(myGen);
      }, dur + 300);
    };

    /* ----- controller ----- */
    const wake = () => {
      if (!alive || finished || !ready) return;
      if (synth) {
        try {
          synth.resume();
        } catch {
          /* ignore */
        }
        while (queued < stepsRef.current.length) {
          queueStep(queued, gen);
          queued += 1;
        }
        maybeFinish();
      } else if (!fbBusy) {
        fallbackPump(gen);
      }
    };

    const arm = (ms) => {
      ready = false;
      later(() => {
        ready = true;
        wake();
      }, ms);
    };

    const restartFrom = (i) => {
      gen += 1;
      clearTimers();
      pending = 0;
      fbBusy = false;
      queued = i;
      cur = i;
      if (synth) synth.cancel();
      setIdx(i);
      setTyped(0);
      setTalk(true);
      arm(synth ? 60 : 0);
    };

    const next = () => {
      if (!alive || finished) return;
      const n = cur + 1;
      if (n >= stepsRef.current.length) {
        if (completeRef.current) {
          gen += 1;
          clearTimers();
          if (synth) synth.cancel();
          finish();
        }
        return;
      }
      restartFrom(n);
    };

    ctrl.current = { wake, next };

    setIdx(0);
    setTyped(0);
    arm(synth ? 60 : 0);

    return () => {
      alive = false;
      gen += 1;
      clearTimers();
      if (synth) synth.cancel();
      ctrl.current = {};
      setTalking(false);
      cb.current.onTalkingChange?.(false);
      window.dispatchEvent(new Event(SIDEBAR_CLOSE_EVENT));
    };
  }, [stage]);

  // newly appended steps (streaming) are queued without restarting speech
  useEffect(() => {
    if (stage === "talk") ctrl.current.wake?.();
  }, [stage, steps.length, stepsComplete]);

  // Esc stops the tour
  useEffect(() => {
    if (stage !== "talk") return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") cb.current.onStop?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage]);

  // open the mobile drawer for sidebar steps, close it for the others
  useEffect(() => {
    if (stage !== "talk" || !isSmallScreen()) return;
    window.dispatchEvent(
      new Event(
        isNavTarget(current?.target) ? SIDEBAR_OPEN_EVENT : SIDEBAR_CLOSE_EVENT,
      ),
    );
  }, [stage, current?.target]);

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
      document.querySelector(selector)?.scrollIntoView({
        behavior: "smooth",
        block: isNavTarget(selector) ? "nearest" : "center",
      });
    }

    measure();
    const t = setInterval(measure, 100);
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

  // With no target the "hole" collapses to a point in the centre, so the
  // clip-path always has the same shape and animates smoothly in and out.
  const h = validHole || {
    x1: vw / 2,
    y1: vh / 2,
    x2: vw / 2,
    y2: vh / 2,
  };
  const clip = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${h.x1}px ${h.y1}px, ${h.x1}px ${h.y2}px, ${h.x2}px ${h.y2}px, ${h.x2}px ${h.y1}px, ${h.x1}px ${h.y1}px)`;

  /* presenter placement: left/right by target, top/bottom so it never covers it */
  const panelW = Math.min(380, vw * 0.96);
  const panelH = 450;
  const hits = (sd, vt) => {
    if (!validHole) return false;
    const bx1 = sd === "right" ? vw - panelW : 0;
    const bx2 = sd === "right" ? vw : panelW;
    const by1 = vt === "top" ? 0 : vh - panelH;
    const by2 = vt === "top" ? panelH : vh;
    return (
      validHole.x2 > bx1 &&
      validHole.x1 < bx2 &&
      validHole.y2 > by1 &&
      validHole.y1 < by2
    );
  };

  let side =
    validHole && (validHole.x1 + validHole.x2) / 2 > vw / 2 ? "left" : "right";
  let vertical = "bottom";
  const other = side === "right" ? "left" : "right";
  if (hits(side, "bottom")) {
    if (!hits(side, "top")) vertical = "top";
    else if (!hits(other, "bottom")) side = other;
    else if (!hits(other, "top")) {
      side = other;
      vertical = "top";
    }
  }

  const full = String(current?.text || current?.speak || "");

  return (
    <>
      <style>{css}</style>

      {/* blur + dim layer (the hole stays clear) */}
      <div
        className="fixed inset-0 z-[100] bg-slate-900/45 backdrop-blur-md"
        style={{
          clipPath: clip,
          WebkitClipPath: clip,
          transition: "clip-path .5s cubic-bezier(.4,0,.2,1)",
        }}
      />

      {/* during the tour nothing underneath can be clicked by accident */}
      {stage === "talk" && <div className="fixed inset-0 z-[100]" />}

      {/* glowing frame around the highlighted element */}
      {validHole && (
        <div
          className="tour-glow pointer-events-none fixed z-[101] rounded-2xl ring-2 ring-blue-400"
          style={{
            left: validHole.x1,
            top: validHole.y1,
            width: validHole.x2 - validHole.x1,
            height: validHole.y2 - validHole.y1,
            transition: "all .5s cubic-bezier(.4,0,.2,1)",
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
          className={`tour-pop fixed z-[110] flex w-[min(380px,96vw)] flex-col p-3 ${
            vertical === "top" ? "top-0" : "bottom-0"
          } ${side === "right" ? "right-0 items-end" : "left-0 items-start"}`}
        >
          <Cloud
            side={side}
            text={full}
            shown={full.slice(0, typed)}
            index={idx}
            total={steps.length}
            onNext={() => ctrl.current.next?.()}
            onStop={onStop}
          />
          <div className={avatarVideo ? "w-40 sm:w-48" : "w-36 sm:w-44"}>
            <Presenter
              talking={talking}
              avatarSrc={avatarSrc}
              avatarVideo={avatarVideo}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceTour;