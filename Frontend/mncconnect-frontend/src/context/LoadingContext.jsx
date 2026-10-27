
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export const LoadingContext = createContext({
  isLoading: false,
  start: () => {},
  stop: () => {},
});

export const LoadingProvider = ({ children }) => {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const timer = useRef(null);

  const start = useCallback(() => {
    setCount((current) => {
      if (current === 0) {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          setIsLoading(true);
        }, 150);
      }

      return current + 1;
    });
  }, []);

  const stop = useCallback(() => {
    setCount((current) => {
      const next = Math.max(0, current - 1);

      if (next === 0) {
        clearTimeout(timer.current);
        setIsLoading(false);
      }

      return next;
    });
  }, []);

  useEffect(() => {
    return () => clearTimeout(timer.current);
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, start, stop }}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => useContext(LoadingContext);
