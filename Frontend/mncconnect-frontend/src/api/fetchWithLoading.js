// src/api/fetchWithLoading.js
import { registerLoadingHandlers } from "./axios";

let handlers = { start: () => {}, stop: () => {} };
export const registerFetchHandlers = (start, stop) => (handlers = { start, stop });

export const apiFetch = async (url, options = {}) => {
  handlers.start();
  try {
    return await fetch(url, options);
  } finally {
    handlers.stop();
  }
};