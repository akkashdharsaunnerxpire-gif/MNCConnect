import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// ---- Loading handlers (App.jsx la irundhu register aagum) ----
let loadingHandlers = { start: () => {}, stop: () => {} };

export const registerLoadingHandlers = (start, stop) => {
  loadingHandlers = { start, stop };
};

// ---- Request: JWT + loading start ----
API.interceptors.request.use((req) => {
  // Background calls ku: API.get(url, { silent: true })
  if (!req.silent) loadingHandlers.start();
  return req;
});

// ---- Response: loading stop (success + error rendulayum) ----
API.interceptors.response.use(
  (res) => {
    if (!res.config.silent) loadingHandlers.stop();
    return res;
  },
  (err) => {
    if (!err.config?.silent) loadingHandlers.stop();
    return Promise.reject(err);
  }
);

export default API;