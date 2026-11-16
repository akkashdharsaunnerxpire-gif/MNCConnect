// src/context/ThemeContext.jsx
// Light / dark mode for the FRESHER side only.
// Mounted inside FresherProtectedRoute, so it exists only while a fresher is in /Home.
// First visit: follows the phone / laptop setting. After the user flips the switch, their choice wins.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const KEY = "mnc_theme"; // "light" | "dark"

const systemPrefersDark = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);

const readInitial = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark") return true;
    if (saved === "light") return false;
  } catch {
    /* storage can be blocked, ignore */
  }
  return systemPrefersDark();
};

const ThemeContext = createContext({
  dark: false,
  setDark: () => {},
  toggle: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [dark, setDarkState] = useState(readInitial);

  // apply to <html>  (removed again when the fresher leaves /Home or logs out)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = dark ? "#0f1219" : "#ffffff";

    return () => root.classList.remove("dark");
  }, [dark]);

  // keep two open tabs in sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY && (e.newValue === "dark" || e.newValue === "light")) {
        setDarkState(e.newValue === "dark");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setDark = useCallback((value) => {
    setDarkState(Boolean(value));
    try {
      localStorage.setItem(KEY, value ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => setDark(!dark), [dark, setDark]);

  const value = useMemo(
    () => ({ dark, setDark, toggle }),
    [dark, setDark, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);