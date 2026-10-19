// utils/realtime.js
//
// 1) setIO(io)                      -> call once in server.js
// 2) emitToUser(userId, event, data)-> push to every tab of that user
// 3) notify({...})                  -> save a Notification AND push it live
//
// Every logged-in user joins the room "user:<id>" (see the join-user event
// in the server.js snippet). Nothing here ever throws.

const Notification = require("../models/Notification");

let io = null;

const setIO = (instance) => {
  io = instance;
};

const room = (id) => `user:${String(id)}`;

const emitToUser = (userId, event, payload = {}) => {
  try {
    if (io && userId) io.to(room(userId)).emit(event, payload);
  } catch (error) {
    console.error("emitToUser failed:", error.message);
  }
};

const serializeNotification = (n) => ({
  id: n._id,
  title: n.title,
  message: n.message,
  type: n.type,
  link: n.link,
  read: n.read,
  createdAt: n.createdAt,
});

const notify = async ({ user, role = "mentor", title, message = "", type = "info", link = "" }) => {
  if (!user || !title) return null;
  try {
    const doc = await Notification.create({ user, role, title, message, type, link });
    emitToUser(user, "notification:new", serializeNotification(doc));
    return doc;
  } catch (error) {
    console.error("notify failed:", error.message);
    return null;
  }
};

module.exports = { setIO, emitToUser, notify, serializeNotification };