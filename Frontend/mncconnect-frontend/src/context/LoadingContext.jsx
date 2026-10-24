// src/context/LoadingContext.jsx
import React, { createContext, useCallback, useContext, useRef, useState } from "react";

export const LoadingContext = createContext({
  isLoading: false,
  start: () => {},
  stop: () => {},
});

export const LoadingProvider = ({ children }) => {
  const [count, setCount] = useState(0);
  const timer = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  // Small delay: very fast requests (<150ms) la bar flicker aagaama irukka
  const start = useCallback(() => {
    setCount((c) => {
      if (c === 0) {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setIsLoading(true), 150);
      }
      return c + 1;
    });
  }, []);

  const stop = useCallback(() => {
    setCount((c) => {
      const next = Math.max(0, c - 1);
      if (next === 0) {
        clearTimeout(timer.current);
        setIsLoading(false);
      }
      return next;
    });
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, start, stop }}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => useContext(LoadingContext);