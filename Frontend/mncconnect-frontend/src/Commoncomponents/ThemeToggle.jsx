// Put this row inside your Settings page:   <ThemeToggle />
import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext"; // adjust the path to where ThemeContext.jsx lives

const ThemeToggle = () => {
  const { dark, toggle } = useTheme();

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          {dark ? <Moon size={18} /> : <Sun size={18} />}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Dark mode</p>
          <p className="text-xs text-slate-500">
            {dark ? "On. Easy on the eyes at night." : "Off. Bright and clean."}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="Dark mode"
        onClick={toggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
          dark ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all duration-200 ${
            dark ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
};

export default ThemeToggle;