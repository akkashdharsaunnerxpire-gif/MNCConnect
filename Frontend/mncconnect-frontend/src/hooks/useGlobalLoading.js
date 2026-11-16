import { useEffect } from "react";
import { useLoading } from "../context/LoadingContext";

// active = true irukkura varaikkum mela irukkura global linear progress odum
export default function useGlobalLoading(active) {
  const { start, stop } = useLoading();
  useEffect(() => {
    if (!active) return undefined;
    start();
    return () => stop(); // oru start-ku exactly oru stop
  }, [active, start, stop]);
}