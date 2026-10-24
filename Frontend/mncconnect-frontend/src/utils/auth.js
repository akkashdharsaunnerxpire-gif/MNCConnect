// src/utils/auth.js
const decode = (token) => {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
};

// Returns the token only if it is a real, non-expired JWT. Otherwise clears it.
const getValidToken = (key) => {
  const token = localStorage.getItem(key);
  if (!token) return null;

  const payload = decode(token);
  const expired = !payload || (payload.exp && payload.exp * 1000 < Date.now());

  if (expired) {
    localStorage.removeItem(key);
    return null;
  }
  return token;
};

export const isFresherLoggedIn = () => Boolean(getValidToken("fresher_token"));
export const isMentorLoggedIn = () => Boolean(getValidToken("mnc_mentor_token"));

export const clearFresherSession = () => {
  ["fresher_token", "user", "token", "fresherName"].forEach((k) =>
    localStorage.removeItem(k),
  );
};