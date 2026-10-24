// src/components/RouteProgress.jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLoading } from "../context/LoadingContext";

// Route maarum bodhu short-a bar kaattum
const RouteProgress = () => {
  const location = useLocation();
  const { start, stop } = useLoading();

  useEffect(() => {
    start();
    const t = setTimeout(stop, 400);
    return () => {
      clearTimeout(t);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
};

export default RouteProgress;