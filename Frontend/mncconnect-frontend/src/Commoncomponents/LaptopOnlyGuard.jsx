import React, { useEffect, useState } from "react";
import { Laptop } from "lucide-react";
import { isPhoneOrTablet } from "../utils/device";

export default function LaptopOnlyGuard({ children }) {
  const [blocked, setBlocked] = useState(isPhoneOrTablet);

  useEffect(() => {
    const check = () => setBlocked(isPhoneOrTablet());
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!blocked) return children;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
        <Laptop className="h-8 w-8 text-blue-600" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Open this on a laptop</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        MNCConnect meetings work only on a laptop or desktop with Chrome and a
        stable internet connection. Please open this link on your laptop.
      </p>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(window.location.href)}
        className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Copy meeting link
      </button>
    </div>
  );
}