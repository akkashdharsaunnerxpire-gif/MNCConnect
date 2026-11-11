// src/utils/imageUrl.js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

// "/uploads/a.jpg" -> "http://localhost:5000/uploads/a.jpg"
export const fixUrl = (u) => {
  if (!u || typeof u !== "string") return "";
  const url = u.trim();
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url) || url.startsWith("//")) return url;
  return `${API_ORIGIN}/${url.replace(/^\/+/, "")}`;
};

const KEY_RE = /(profile.?pic|picture|image|img|avatar|photo|^pic$|^dp$)/i;
const SKIP_KEY_RE = /(topic|cover|banner|logo|company|resume|document|certificate)/i;
const VALUE_RE =
  /^(https?:|data:|blob:|\/)|\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i;

// looks inside an object (and nested objects) for ANY image-like field
export const findImage = (obj, depth = 0) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj) || depth > 3) {
    return "";
  }

  for (const [k, v] of Object.entries(obj)) {
    if (
      typeof v === "string" &&
      v.trim() &&
      KEY_RE.test(k) &&
      !SKIP_KEY_RE.test(k) &&
      VALUE_RE.test(v.trim())
    ) {
      return fixUrl(v);
    }
  }

  for (const v of Object.values(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const found = findImage(v, depth + 1);
      if (found) return found;
    }
  }
  return "";
};