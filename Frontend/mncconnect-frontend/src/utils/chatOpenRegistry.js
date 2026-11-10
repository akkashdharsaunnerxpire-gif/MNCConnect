// Which chats are open right now (so we don't show an alert for them)
const open = new Map();

export const setChatOpen = (id, value) => {
  const key = String(id || "");
  if (!key) return;
  const n = (open.get(key) || 0) + (value ? 1 : -1);
  if (n <= 0) open.delete(key);
  else open.set(key, n);
};

export const isChatOpen = (id) => (open.get(String(id || "")) || 0) > 0;