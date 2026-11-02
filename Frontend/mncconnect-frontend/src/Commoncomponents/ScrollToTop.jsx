// src/Commoncomponents/ScrollToTop.jsx
// Every time the route changes, open the new page from the TOP.
import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    // links like /page#section keep their own anchor scroll
    if (hash) return undefined;

    const toTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    toTop();
    // once more after the first paint (lazy pages render a bit later)
    const id = requestAnimationFrame(toTop);
    return () => cancelAnimationFrame(id);
  }, [pathname, hash]);

  return null;
}