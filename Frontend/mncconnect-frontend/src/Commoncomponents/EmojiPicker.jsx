// src/Commoncomponents/EmojiPicker.jsx
import React, { useState } from "react";
import { EMOJI_GROUPS } from "./../data/emojiData";

export default function EmojiPicker({ onPick, pickerRef }) {
  const [tab, setTab] = useState(EMOJI_GROUPS[0].id);
  const group = EMOJI_GROUPS.find((g) => g.id === tab) || EMOJI_GROUPS[0];

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-3 right-3 z-10 mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:right-auto sm:w-80"
    >
      {/* category tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50 px-1">
        {EMOJI_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            title={g.label}
            aria-label={g.label}
            onClick={() => setTab(g.id)}
            className={`flex-1 border-b-2 py-2 text-lg transition ${
              tab === g.id
                ? "border-blue-500"
                : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            {g.icon}
          </button>
        ))}
      </div>

      {/* emoji grid */}
      <div className="grid h-48 grid-cols-8 content-start gap-0.5 overflow-y-auto p-2">
        {group.list.map((e) => (
          <button
            key={e}
            type="button"
            // keep textarea focus / cursor position when clicking an emoji
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => onPick(e)}
            className="flex h-9 items-center justify-center rounded-lg text-[22px] transition hover:bg-slate-100 active:scale-90"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}