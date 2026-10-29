import React, { useEffect, useRef, useState } from "react";

/* ==========================================================
   LITE MODE
   Starts from device hints, then measures real FPS for ~1.6s
   after load. If the device can't hold ~38fps, heavy effects
   (parallax, particles, blur, tilt, hero video) switch off.
   ========================================================== */
function detectLite() {
  if (typeof window === "undefined") return false;
  const n = navigator;
  const mq = (q) => (window.matchMedia ? window.matchMedia(q).matches : false);

  const small = mq("(max-width: 768px)");
  const reduce = mq("(prefers-reduced-motion: reduce)");
  const lowCpu = n.hardwareConcurrency && n.hardwareConcurrency <= 2;
  const lowMem = n.deviceMemory && n.deviceMemory <= 2;
  const saveData = n.connection && n.connection.saveData;

  return Boolean(small || reduce || lowCpu || lowMem || saveData);
}

export function useAutoLite() {
  const [lite, setLite] = useState(detectLite);

  useEffect(() => {
    if (lite) return;

    let raf = 0;
    let timer = 0;
    let frames = 0;
    let start = 0;

    const loop = (t) => {
      if (document.hidden) return; // background tab = unreliable, skip
      if (!start) start = t;
      frames += 1;

      if (t - start < 1600) {
        raf = requestAnimationFrame(loop);
      } else {
        const fps = frames / ((t - start) / 1000);
        if (fps < 38) setLite(true);
      }
    };

    timer = window.setTimeout(() => {
      raf = requestAnimationFrame(loop);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return lite;
}

/* ==========================================================
   NAV AVATAR  (desktop only - Landing mounts it at >= 1024px)
   A small 3D-styled person sitting on the navbar edge, legs
   swinging, head turned toward the Log in button, waving.

   CLICK REACTION:
   When the avatar is clicked, Landing sets `pointing` = true for
   a couple of seconds. The waving arm is replaced by an arm that
   stretches out to the right and pokes at the "Log in" button
   ("click Log in!").

   Props:
     excited       -> Log in hovered (waves faster, looks at it)
     pointing      -> avatar was clicked (points at Log in)
     lite          -> weak device: idle loops off, click reaction stays
     reduceMotion  -> everything static
     onClick       -> called when the avatar is clicked
   ========================================================== */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function NavAvatar({
  excited = false,
  pointing = false,
  lite = false,
  reduceMotion = false,
  onClick,
}) {
  const ref = useRef(null);

  /* head/eyes follow the mouse a little (mouse only, rAF throttled) */
  useEffect(() => {
    if (lite || reduceMotion) return;
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let lastX = 0;
    let lastY = 0;
    let isMouse = false;

    const apply = () => {
      raf = 0;
      if (!isMouse) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      el.style.setProperty("--ax", clamp((lastX - cx) / 420, -1, 1).toFixed(2));
      el.style.setProperty("--ay", clamp((lastY - cy) / 320, -1, 1).toFixed(2));
    };

    const onMove = (e) => {
      isMouse = e.pointerType === "mouse";
      lastX = e.clientX;
      lastY = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [lite, reduceMotion]);

  return (
    <button
      ref={ref}
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={onClick}
      className="nav-avatar"
      data-excited={excited ? "1" : "0"}
      data-pointing={pointing ? "1" : "0"}
      data-lite={lite ? "1" : "0"}
      data-still={reduceMotion ? "1" : "0"}
    >
      <span className="na-tilt">
        <svg
          viewBox="0 0 80 100"
          width="100%"
          height="100%"
          focusable="false"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="na-shirt" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#818cf8" />
              <stop offset="1" stopColor="#4338ca" />
            </linearGradient>
            <linearGradient id="na-jeans" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#52607a" />
              <stop offset="1" stopColor="#1e293b" />
            </linearGradient>
            <radialGradient id="na-skin" cx=".35" cy=".3" r=".85">
              <stop offset="0" stopColor="#ffe3c8" />
              <stop offset="1" stopColor="#e6a478" />
            </radialGradient>
          </defs>

          {/* seat shadow on the nav edge */}
          <ellipse cx="42" cy="77.5" rx="25" ry="2.6" fill="#0f172a" opacity=".16" />

          {/* far leg (darker, behind) */}
          <g className="na-leg na-leg-far" style={{ transformOrigin: "60px 72px" }}>
            <rect x="55" y="68" width="10" height="26" rx="5" fill="#27344a" />
            <rect x="54" y="90.5" width="16" height="7.5" rx="3.7" fill="#cbd5e1" />
          </g>

          {/* near leg */}
          <g className="na-leg" style={{ transformOrigin: "56px 72px" }}>
            <rect x="50.5" y="68" width="11" height="27" rx="5.5" fill="url(#na-jeans)" />
            <rect x="49.5" y="91" width="17" height="7.8" rx="3.9" fill="#f8fafc" />
            <rect x="49.5" y="96" width="17" height="2.8" rx="1.4" fill="#cbd5e1" />
          </g>

          {/* thigh */}
          <rect x="26" y="66" width="36" height="11.5" rx="5.75" fill="url(#na-jeans)" />

          {/* upper body (breathing) */}
          <g className="na-body">
            {/* torso */}
            <path
              d="M26 47 Q26 41 32 41 L43 41 Q49 41 49 47 L50 70 Q50 76 44 76 L31 76 Q25 76 25.5 70 Z"
              fill="url(#na-shirt)"
            />
            <path
              d="M28 44 Q28 42 32 42 L36 42 L35 74 L30 74 Q27 74 27.5 70 Z"
              fill="#fff"
              opacity=".14"
            />

            {/* neck */}
            <rect x="34.5" y="35" width="7" height="9" rx="3" fill="#e0a174" />

            {/* resting arm on lap */}
            <path
              d="M29 50 Q24 62 38 69"
              stroke="#3730a3"
              strokeWidth="6.6"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="39.5" cy="69.5" r="3.5" fill="url(#na-skin)" />

            {/* waving arm (idle) */}
            <g className="na-armwave">
              <path
                d="M45 49 L58 58"
                stroke="#5457e6"
                strokeWidth="7.6"
                fill="none"
                strokeLinecap="round"
              />
              <g className="na-wave" style={{ transformOrigin: "58px 58px" }}>
                <line x1="58" y1="58" x2="59.2" y2="51" stroke="#5457e6" strokeWidth="7.4" strokeLinecap="round" />
                <line x1="58.6" y1="55" x2="61.3" y2="40" stroke="#e6a478" strokeWidth="5.6" strokeLinecap="round" />
                <circle cx="61.8" cy="35.6" r="4.5" fill="url(#na-skin)" />
                <path
                  d="M58.7 33.6 L57.7 28.8 M60.7 32.3 L60.5 27.2 M62.9 32.4 L63.6 27.6 M64.8 34.1 L66.3 29.9 M57.8 37.6 L54.7 36"
                  stroke="#e6a478"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            </g>

            {/* pointing arm (click reaction): stretches to the right,
                finger pokes at the Log in button */}
            <g className="na-armpoint" style={{ transformOrigin: "45px 49px" }}>
              {/* sleeve */}
              <line x1="45" y1="49" x2="66" y2="49" stroke="#5457e6" strokeWidth="7.6" strokeLinecap="round" />
              {/* forearm */}
              <line x1="64" y1="49" x2="84" y2="49" stroke="#e6a478" strokeWidth="5.6" strokeLinecap="round" />
              {/* fist */}
              <circle cx="86" cy="49" r="4.6" fill="url(#na-skin)" />
              {/* thumb */}
              <line x1="84.5" y1="45.2" x2="89" y2="45.2" stroke="#e6a478" strokeWidth="2.6" strokeLinecap="round" />
              {/* index finger */}
              <line x1="88" y1="48.6" x2="103" y2="48.6" stroke="#e6a478" strokeWidth="3.4" strokeLinecap="round" />
              <path d="M91 50.6 h8" stroke="#c98a60" strokeWidth=".7" strokeLinecap="round" opacity=".6" />
            </g>

            {/* head */}
            <g className="na-look" style={{ transformOrigin: "39px 38px" }}>
              <g className="na-nod" style={{ transformOrigin: "39px 38px" }}>
                <ellipse cx="27" cy="28" rx="2.3" ry="3.1" fill="#e0a174" />
                <circle cx="40" cy="26" r="13.5" fill="url(#na-skin)" />
                <circle cx="53.6" cy="29" r="1.9" fill="#e6a478" />

                {/* eyes: blink + look toward Log in */}
                <g className="na-blink">
                  <ellipse cx="43" cy="26" rx="3" ry="3.4" fill="#fff" />
                  <ellipse cx="50.4" cy="26" rx="2.5" ry="3.2" fill="#fff" />
                  <g className="na-pupil">
                    <circle cx="44.5" cy="26.4" r="1.75" fill="#0f172a" />
                    <circle cx="51.6" cy="26.4" r="1.5" fill="#0f172a" />
                    <circle cx="45" cy="25.7" r=".5" fill="#fff" />
                    <circle cx="52" cy="25.8" r=".45" fill="#fff" />
                  </g>
                </g>

                <path d="M40.5 21.6 Q43 20 45.6 21.3" stroke="#111827" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <path d="M48.4 21.3 Q51 20 53 21.6" stroke="#111827" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                {pointing ? (
                  /* open happy mouth while pointing */
                  <path d="M45 32.4 Q49.4 38.6 53.4 32.2 Z" fill="#9a3412" />
                ) : (
                  <path d="M45 33 Q49.6 37.6 53 32.6" stroke="#9a3412" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                )}
                <circle cx="41" cy="31" r="2.4" fill="#fb7185" opacity=".3" />

                {/* hair */}
                <path
                  d="M26.6 26 C24.5 9 42 6.5 51 13 C55 16 55.5 22 53.5 25 C51 19.5 46 17.5 40 18.5 C34 19.5 29.5 22 26.6 26Z"
                  fill="#111827"
                />
                <path d="M33 12.6 Q40 9.6 47 12.4" stroke="#fff" strokeWidth="1.2" opacity=".18" fill="none" strokeLinecap="round" />
              </g>
            </g>
          </g>
        </svg>
      </span>
    </button>
  );
}

/* ==========================================================
   CSS  ->  append to the page <style>:
   <style>{LANDING_CSS + NAV_AVATAR_CSS}</style>
   ========================================================== */
export const NAV_AVATAR_CSS = `
/* ---------- nav avatar ---------- */
.nav-avatar {
  position: absolute; right: 0; bottom: -20px; z-index: 5;
  width: 64px; height: 80px; padding: 0; border: 0; background: none;
  cursor: pointer; outline: none; overflow: visible;
  -webkit-tap-highlight-color: transparent;
}
.na-tilt {
  display: block; width: 100%; height: 100%; transform-origin: 50% 100%;
  transform: perspective(420px) rotateY(calc(var(--ax, 0) * 14deg));
  transition: transform .25s ease-out;
}
.nav-avatar svg { display: block; overflow: visible; }

/* desktop only: never show on small screens */
@media (max-width: 1023px) {
  .nav-avatar { display: none !important; }
}

.na-wave  { transform-box: view-box; animation: naWave .9s ease-in-out infinite alternate; }
.na-nod   { transform-box: view-box; animation: naNod 3.2s ease-in-out infinite; }
.na-body  { animation: naBreath 3.6s ease-in-out infinite; }
.na-leg   { transform-box: view-box; animation: naKick 2.8s ease-in-out infinite alternate; }
.na-leg-far { animation-delay: -1.4s; }
.na-blink { transform-box: fill-box; transform-origin: center; animation: naBlink 4.6s infinite; }

/* head follows the cursor a little, but leans toward Log in by default */
.na-look  { transform-box: view-box; transform: rotate(calc(var(--ax, 0) * 3deg + 3deg)); transition: transform .25s ease-out; }
.na-pupil { transform: translate(calc(var(--ax, 0) * 1px), calc(var(--ay, 0) * .8px)); transition: transform .2s ease-out; }

@keyframes naWave  { from { transform: rotate(-14deg); } to { transform: rotate(20deg); } }
@keyframes naNod   { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(2.4deg) translateY(.6px); } }
@keyframes naBreath{ 0%,100% { transform: translateY(0); } 50% { transform: translateY(-.7px); } }
@keyframes naKick  { from { transform: rotate(-5deg); } to { transform: rotate(7deg); } }
@keyframes naBlink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }

/* hovering Log in -> looks straight at it, waves faster */
.nav-avatar[data-excited="1"] .na-wave  { animation-duration: .38s; }
.nav-avatar[data-excited="1"] .na-look  { transform: rotate(5deg) !important; }
.nav-avatar[data-excited="1"] .na-pupil { transform: translate(1.2px, 0) !important; }
.nav-avatar:active .na-tilt { transform: scale(.96); }

/* ---------- click reaction: point at Log in ---------- */
.na-armwave  { transition: opacity .15s; }
.na-armpoint {
  opacity: 0; transition: opacity .15s; pointer-events: none;
  transform-box: view-box; transform: rotate(-18deg);
}
.nav-avatar[data-pointing="1"] .na-armwave  { opacity: 0; }
.nav-avatar[data-pointing="1"] .na-armpoint {
  opacity: 1; animation: naPoke .55s ease-in-out infinite alternate;
}
.nav-avatar[data-pointing="1"] .na-look  { transform: rotate(6deg) !important; }
.nav-avatar[data-pointing="1"] .na-pupil { transform: translate(1.4px, -.2px) !important; }
@keyframes naPoke {
  from { transform: rotate(-18deg) translateX(0); }
  to   { transform: rotate(-18deg) translateX(7px); }
}

/* weak devices: idle loops off, click reaction still works */
.nav-avatar[data-lite="1"] .na-wave,
.nav-avatar[data-lite="1"] .na-nod,
.nav-avatar[data-lite="1"] .na-body,
.nav-avatar[data-lite="1"] .na-leg,
.nav-avatar[data-lite="1"] .na-blink { animation: none !important; }

/* reduced motion: fully static (arm still switches to pointing pose) */
.nav-avatar[data-still="1"] * { animation: none !important; transition: none !important; }
@media (prefers-reduced-motion: reduce) {
  .nav-avatar * { animation: none !important; transition: none !important; }
}

/* ==========================================================
   LITE MODE (auto: phones, weak CPUs, low FPS, save-data)
   ========================================================== */
.landing-root[data-lite="1"] .mobile-hide { display: none !important; }
.landing-root[data-lite="1"] .hero-stage { transform: none !important; transition: none; }
.landing-root[data-lite="1"] .hero-stage > div { transform: none !important; }
.landing-root[data-lite="1"] .tilt { transform: none !important; }
.landing-root[data-lite="1"] .tilt-glare,
.landing-root[data-lite="1"] .spot::before { display: none; }
.landing-root[data-lite="1"] .pulse-glow::after,
.landing-root[data-lite="1"] .eq-bar,
.landing-root[data-lite="1"] .grid-scan,
.landing-root[data-lite="1"] .particle,
.landing-root[data-lite="1"] .ring-a,
.landing-root[data-lite="1"] .ring-b,
.landing-root[data-lite="1"] .orbit-dot,
.landing-root[data-lite="1"] .hero-gradient { animation: none !important; }
.landing-root[data-lite="1"] .backdrop-blur,
.landing-root[data-lite="1"] .backdrop-blur-xl,
.landing-root[data-lite="1"] .backdrop-blur-2xl,
.landing-root[data-lite="1"] [class*="backdrop-blur"] {
  -webkit-backdrop-filter: none !important; backdrop-filter: none !important;
}
.landing-root[data-lite="1"] .mentor-card { will-change: auto; }
`;