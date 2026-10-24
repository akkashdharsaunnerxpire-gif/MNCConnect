// src/data/emojiData.js
// Space-separated string -> unique array
const toList = (str) => [...new Set(str.trim().split(/\s+/))];

export const EMOJI_GROUPS = [
  {
    id: "smileys",
    icon: "😀",
    label: "Smileys",
    list: toList(
      "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥳 🤩 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕",
    ),
  },
  {
    id: "gestures",
    icon: "👍",
    label: "Gestures",
    list: toList(
      "👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 👏 🙌 👐 🤲 💪 🫶 ✍️ 🫡 🫰",
    ),
  },
  {
    id: "hearts",
    icon: "❤️",
    label: "Hearts",
    list: toList(
      "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ✨ 🌟 ⭐ 🔥 💯 💥 🎉 🎊 🎈 🎁 🏆 🥇",
    ),
  },
  {
    id: "work",
    icon: "💼",
    label: "Work",
    list: toList(
      "💼 📚 📖 📝 ✅ ❌ ⚠️ ❓ ❗ 💡 📌 📎 📅 ⏰ ⌛ 🕐 💻 🖥️ ⌨️ 📱 🎧 🎤 📞 📧 🔔 🔒 🔑 🚀 🎯 📈 📊 🧠 👀",
    ),
  },
  {
    id: "fun",
    icon: "🍕",
    label: "Food & Fun",
    list: toList(
      "🍕 🍔 🍟 🌮 🍿 🍩 🍪 🎂 🍫 ☕ 🍵 🥤 🍎 🍌 🍉 🍇 🥭 🍚 🍛 🥗 ⚽ 🏏 🏀 🎮 🎬 🎵 🎶 🌞 🌈 ☔ 🌸 🐶 🐱",
    ),
  },
];