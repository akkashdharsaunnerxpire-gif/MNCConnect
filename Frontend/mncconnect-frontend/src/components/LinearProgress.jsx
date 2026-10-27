// src/components/LinearProgress.jsx
import React, { useEffect, useRef, useState } from "react";

const LinearProgress = ({ isLoading }) => {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    clearTimeout(hideTimer.current);

    if (isLoading) {
      setVisible(true);
    } else {
      hideTimer.current = setTimeout(() => setVisible(false), 300);
    }

    return () => clearTimeout(hideTimer.current);
  }, [isLoading]);

  if (!visible) return null;

  // Rendu pulse, 0.6s gap: center la irundhu continuous-a varum
  const delays = ["0s", "0.6s"];

  return (
    <>
      <style>{`
        @keyframes mnc-center-left {
          0%   { transform: translateX(250%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes mnc-center-right {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
      `}</style>

      <div
        className={`fixed inset-x-0 top-0 z-[99999] h-[5px] pointer-events-none bg-[#2569e9] transition-opacity duration-300 ${
          visible && isLoading ? "opacity-100" : "opacity-0"
        }`}
        role="progressbar"
        aria-busy={isLoading}
      >
        {/* LEFT half: center -> left */}
        <div className="absolute top-0 right-1/2 h-full w-1/2 overflow-hidden">
          {delays.map((d) => (
            <div
              key={d}
              className="absolute top-0 left-0 h-full w-2/5 rounded-full bg-gradient-to-l from-indigo-950 via-indigo-800 to-transparent shadow-[0_0_12px_rgba(49,46,129,0.9)]"
              style={{
                animation: "mnc-center-left 1.2s linear infinite",
                animationDelay: d,
                transform: "translateX(250%)",
              }}
            />
          ))}
        </div>

        {/* RIGHT half: center -> right */}
        <div className="absolute top-0 left-1/2 h-full w-1/2 overflow-hidden">
          {delays.map((d) => (
            <div
              key={d}
              className="absolute top-0 left-0 h-full w-2/5 rounded-full bg-gradient-to-r from-indigo-950 via-indigo-800 to-transparent shadow-[0_0_12px_rgba(49,46,129,0.9)]"
              style={{
                animation: "mnc-center-right 1.2s linear infinite",
                animationDelay: d,
                transform: "translateX(-100%)",
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default LinearProgress;
