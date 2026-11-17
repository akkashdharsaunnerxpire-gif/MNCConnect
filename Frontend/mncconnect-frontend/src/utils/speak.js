const supported =
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  "SpeechSynthesisUtterance" in window;

export const isSpeechSupported = () => supported;

// Male voices (Windows / Edge / macOS / Chrome). Indian English ones win.
const MALE_HINTS = [
  "prabhat", "ravi", "rishi", "hemant", "valluvar",
  "david", "mark", "george", "james", "guy",
  "daniel", "alex", "fred", "ryan", "thomas",
  "oliver", "arthur", "aaron", "eric", "davis",
];

const FEMALE_HINTS = [
  "heera", "neerja", "zira", "hazel", "susan",
  "aria", "jenny", "libby", "sonia", "samantha",
  "karen", "moira", "tessa", "veena", "priya",
  "kalpana", "lekha", "kanya", "fiona", "victoria",
  "google us english", "google uk english female",
];

let cachedVoice = null;
let runId = 0;
let current = null;

const getVoices = () => {
  if (!supported) return [];
  return window.speechSynthesis.getVoices() || [];
};

const scoreVoice = (voice) => {
  const name = voice.name.toLowerCase();
  let score = 0;

  // "female" contains "male", so these two are matched as whole words
  const saysFemale = /\bfemale\b/.test(name);
  const saysMale = /\bmale\b/.test(name) && !saysFemale;

  if (saysMale || MALE_HINTS.some((hint) => name.includes(hint))) {
    score += 40;
  }

  if (saysFemale || FEMALE_HINTS.some((hint) => name.includes(hint))) {
    score -= 50;
  }

  if (/en[-_]in/i.test(voice.lang)) score += 12;
  if (/en[-_]gb/i.test(voice.lang)) score += 5;
  if (/en[-_]us/i.test(voice.lang)) score += 4;

  if (/natural|online/i.test(name)) score += 6;

  return score;
};

export function pickMaleVoice() {
  if (!supported) return null;

  const voices = getVoices();
  if (!voices.length) return null;

  if (
    cachedVoice &&
    voices.some(
      (voice) =>
        voice.name === cachedVoice.name && voice.lang === cachedVoice.lang,
    )
  ) {
    return cachedVoice;
  }

  const englishVoices = voices.filter((voice) => /^en/i.test(voice.lang));
  const pool = englishVoices.length ? englishVoices : voices;

  cachedVoice =
    [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;

  return cachedVoice;
}

// old name kept so other files that import it do not break
export const pickFemaleVoice = pickMaleVoice;

// Load voices when browser makes them available.
if (supported) {
  getVoices();

  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    cachedVoice = null;
    pickMaleVoice();
  });
}

const makeUtterance = (text) => {
  const utterance = new SpeechSynthesisUtterance(String(text));

  const voice = pickMaleVoice();

  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-IN";
  }

  utterance.volume = 1.0;

  // calm, clear presenter pace
  utterance.rate = 1.0;

  // a little lower = more masculine, also helps when the voice is not male
  utterance.pitch = 0.9;

  return utterance;
};

const finishCurrent = (id) => {
  if (!current || current.id !== id) return;

  const callback = current.onEnd;
  current = null;

  callback?.();
};

// Stop current speech immediately.
export function stopSpeaking() {
  if (!supported) return;

  runId++;

  const old = current;
  current = null;

  window.speechSynthesis.cancel();

  old?.onEnd?.();
}

// Split long text into manageable sentences.
const splitText = (lines) => {
  return (lines || [])
    .filter(Boolean)
    .flatMap((line) => {
      const text = String(line).trim();

      if (!text) return [];

      return text
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
    });
};

// Speak one sentence at a time.
export function speakSequence(lines, { onStart, onEnd, onError } = {}) {
  if (!supported) {
    onError?.("Speech synthesis is not supported.");
    onEnd?.();
    return;
  }

  const queue = splitText(lines);

  if (!queue.length) {
    onEnd?.();
    return;
  }

  // Cancel previous speech.
  const old = current;
  current = null;

  window.speechSynthesis.cancel();
  old?.onEnd?.();

  const id = ++runId;

  current = {
    id,
    onEnd,
  };

  let index = 0;
  let started = false;

  const speakNext = () => {
    if (id !== runId || !current || current.id !== id) {
      return;
    }

    if (index >= queue.length) {
      finishCurrent(id);
      return;
    }

    const utterance = makeUtterance(queue[index]);

    utterance.onstart = () => {
      if (id !== runId) return;

      if (!started) {
        started = true;
        onStart?.();
      }
    };

    utterance.onend = () => {
      if (id !== runId) return;

      index++;
      speakNext();
    };

    utterance.onerror = (event) => {
      if (id !== runId) return;

      // Ignore cancellation caused by a new speech request.
      if (event.error === "canceled" || event.error === "interrupted") {
        return;
      }

      onError?.(event.error || "Speech playback failed.");
      finishCurrent(id);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Resume if the browser speech engine is paused.
  window.speechSynthesis.resume();

  speakNext();
}

export const speak = (text, options = {}) => {
  speakSequence([text], options);
};

export const speakGoingTo = (sectionName) => {
  speak(String(sectionName));
};