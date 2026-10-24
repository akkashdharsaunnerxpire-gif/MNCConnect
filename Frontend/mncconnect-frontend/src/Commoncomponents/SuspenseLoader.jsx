// src/components/SuspenseLoader.jsx
// React.lazy pages load aagura varai bar kaattum
import { useEffect } from "react";
import { useLoading } from "../context/LoadingContext";

const SuspenseLoader = () => {
  const { start, stop } = useLoading();
  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="min-h-[60vh]" />;
};

export default SuspenseLoader;