// src/utils/chatSounds.js
// Web Audio synth sounds. No mp3 needed.

const MASTER_VOLUME = 1.0; // 0 to 1.2, loud venum na ethunga

let ctx = null;
let master = null;
let noiseBuf = null;

const getCtx = () => {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;

  if (!ctx) {
    ctx = new AC();

    // compressor: loud-a irundhaalum distortion aagaadhu
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 20;
    comp.ratio.value = 6;
    comp.attack.value = 0.001;
    comp.release.value = 0.12;

    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;

    master.connect(comp);
    comp.connect(ctx.destination);
  }
  return ctx;
};

// browsers audio-va user interact pannra varaikum block pannum
export const unlockAudio = () => {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
};

const getNoise = (c) => {
  if (!noiseBuf) {
    const len = Math.floor(c.sampleRate * 0.4);
    noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
};

// +-pct random variation, so every sound is slightly different
const jitter = (v, pct = 0.03) => v * (1 + (Math.random() * 2 - 1) * pct);

// fast attack, exponential decay envelope
const envelope = (c, g, t0, dur, vol, attack = 0.002) => {
  g.gain.cancelScheduledValues(t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
};

// filtered noise: click / swoosh
const noise = (
  c,
  {
    start = 0,
    dur = 0.02,
    vol = 0.3,
    type = "bandpass",
    freq = 3000,
    freqEnd,
    q = 1,
    attack = 0.001,
  },
) => {
  const t0 = c.currentTime + start;
  const src = c.createBufferSource();
  src.buffer = getNoise(c);

  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t0);
  if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);

  const gain = c.createGain();
  envelope(c, gain, t0, dur, vol, attack);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);

  // random offset, so noise pattern is never identical
  src.start(t0, Math.random() * 0.2, dur + 0.03);
};

// tone with optional pitch glide
const tone = (
  c,
  {
    start = 0,
    dur = 0.1,
    vol = 0.3,
    freq = 800,
    endFreq,
    type = "sine",
    attack = 0.002,
  },
) => {
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);

  envelope(c, gain, t0, dur, vol, attack);

  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
};

/**
 * SEND: swoosh -> crisp click -> pop body
 */
export const playSendSound = () => {
  try {
    const c = getCtx();
    if (!c) return;
    unlockAudio();

    // 1. soft swoosh (message poguthu)
    noise(c, {
      start: 0,
      dur: 0.09,
      vol: 0.12,
      type: "bandpass",
      freq: 900,
      freqEnd: 4200,
      q: 0.8,
      attack: 0.03,
    });

    // 2. crisp "tick" click
    const t = 0.075;
    noise(c, {
      start: t,
      dur: 0.016,
      vol: 0.55,
      type: "highpass",
      freq: jitter(3200),
      q: 0.7,
    });

    // 3. pop body (pitch drop = "thock")
    tone(c, {
      start: t,
      dur: 0.085,
      vol: 0.5,
      freq: jitter(1250),
      endFreq: 520,
      type: "sine",
    });

    // 4. tiny sparkle on top for "real" feel
    tone(c, {
      start: t,
      dur: 0.035,
      vol: 0.16,
      freq: jitter(2600),
      endFreq: 1800,
      type: "triangle",
    });
  } catch {
    /* ignore audio errors */
  }
};

/**
 * RECEIVE (chat open): two bubble "pop-pop" notes
 */
export const playReceiveSound = () => {
  try {
    const c = getCtx();
    if (!c) return;
    unlockAudio();

    const bubble = (start, f0, f1, vol) => {
      tone(c, { start, dur: 0.13, vol, freq: f0, endFreq: f1, type: "sine" });
      // soft overtone (warmth)
      tone(c, {
        start,
        dur: 0.09,
        vol: vol * 0.3,
        freq: f0 * 2,
        endFreq: f1 * 2,
        type: "sine",
      });
      // tiny click at the start of each bubble
      noise(c, {
        start,
        dur: 0.01,
        vol: vol * 0.5,
        type: "highpass",
        freq: 2800,
      });
    };

    bubble(0, jitter(620), jitter(940), 0.3);
    bubble(0.12, jitter(830), jitter(1260), 0.3);
  } catch {
    /* ignore audio errors */
  }
};

/* ---------- which chats are open right now (so we don't double-play) ---------- */
const activeChats = new Map(); // id -> open count

export const setChatActive = (id, active) => {
  if (!id) return;
  const k = String(id);
  const n = (activeChats.get(k) || 0) + (active ? 1 : -1);
  if (n <= 0) activeChats.delete(k);
  else activeChats.set(k, n);
};

export const isChatActive = (id) => !!id && activeChats.has(String(id));

/**
 * NOTIFICATION (WhatsApp style): bright two-note "ding-ding" with bell overtone.
 * Used when a message arrives and that chat is NOT open.
 */
export const playNotificationSound = () => {
  try {
    const c = getCtx();
    if (!c) return;
    unlockAudio();

    const ding = (start, f, vol) => {
      tone(c, {
        start,
        dur: 0.38,
        vol,
        freq: jitter(f, 0.005),
        type: "sine",
        attack: 0.004,
      });
      // bell overtones
      tone(c, {
        start,
        dur: 0.25,
        vol: vol * 0.35,
        freq: f * 2.01,
        type: "sine",
        attack: 0.003,
      });
      tone(c, {
        start,
        dur: 0.12,
        vol: vol * 0.2,
        freq: f * 3.99,
        type: "triangle",
        attack: 0.002,
      });
      // tiny click
      noise(c, {
        start,
        dur: 0.008,
        vol: vol * 0.3,
        type: "highpass",
        freq: 3500,
      });
    };

    ding(0, 1175, 0.45); // D6
    ding(0.13, 1568, 0.5); // G6
  } catch {
    /* ignore audio errors */
  }
};