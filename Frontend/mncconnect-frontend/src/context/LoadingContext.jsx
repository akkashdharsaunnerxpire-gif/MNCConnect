// src/context/LoadingContext.jsx
import { createContext, useContext } from "react";

export const LoadingContext = createContext(null);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within LoadingContext.Provider");
  }
  return context;
};