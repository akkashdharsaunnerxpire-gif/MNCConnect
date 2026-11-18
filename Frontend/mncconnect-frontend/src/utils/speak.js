
const supported =
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  "SpeechSynthesisUtterance" in window;

export const isSpeechSupported = () => supported;

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
let current = null;
let runId = 0;
let resumeTimer = null;

const getVoices = () => {
  if (!supported) return [];
  return window.speechSynthesis.getVoices() || [];
};

const scoreVoice = (voice) => {
  const name = (voice.name || "").toLowerCase();
  let score = 0;

  const saysFemale = /\bfemale\b/.test(name);
  const saysMale = /\bmale\b/.test(name) && !saysFemale;

  if (
    saysMale ||
    MALE_HINTS.some((hint) => name.includes(hint))
  ) {
    score += 40;
  }

  if (
    saysFemale ||
    FEMALE_HINTS.some((hint) => name.includes(hint))
  ) {
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
        voice.name === cachedVoice.name &&
        voice.lang === cachedVoice.lang
    )
  ) {
    return cachedVoice;
  }

  const englishVoices = voices.filter((voice) =>
    /^en/i.test(voice.lang)
  );

  const pool = englishVoices.length
    ? englishVoices
    : voices;

  cachedVoice =
    [...pool].sort(
      (a, b) => scoreVoice(b) - scoreVoice(a)
    )[0] || null;

  return cachedVoice;
}

export const pickFemaleVoice = pickMaleVoice;

if (supported) {
  getVoices();

  window.speechSynthesis.addEventListener?.(
    "voiceschanged",
    () => {
      cachedVoice = null;
      pickMaleVoice();
    }
  );
}

const makeUtterance = (text) => {
  const utterance = new SpeechSynthesisUtterance(
    String(text)
  );

  const voice = pickMaleVoice();

  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-IN";
  }

  utterance.volume = 1;
  utterance.rate = 0.95;
  utterance.pitch = 0.9;

  return utterance;
};

const clearResumeTimer = () => {
  if (resumeTimer !== null) {
    clearInterval(resumeTimer);
    resumeTimer = null;
  }
};

const clearRunTimers = (run) => {
  if (!run) return;

  if (run.safetyTimer !== null) {
    clearTimeout(run.safetyTimer);
    run.safetyTimer = null;
  }
};

export function stopSpeaking() {
  runId += 1;

  if (current) {
    clearRunTimers(current);
  }

  current = null;
  clearResumeTimer();

  if (supported) {
    window.speechSynthesis.cancel();
  }
}

const finishRun = (id, error = null) => {
  if (!current || current.id !== id) return;

  const run = current;

  clearRunTimers(run);
  current = null;
  clearResumeTimer();

  if (error) {
    run.callbacks.onError?.(error);
  }

  run.callbacks.onEnd?.();
};

const startResumeMonitor = (id) => {
  clearResumeTimer();

  resumeTimer = setInterval(() => {
    if (!current || current.id !== id) return;

    const synth = window.speechSynthesis;

    if (synth.paused) {
      synth.resume();
    }
  }, 3000);
};

/*
 * Speak the complete text using ONE utterance.
 * This avoids artificial gaps caused by splitting sentences.
 */
const startSingleUtterance = (id) => {
  if (!current || current.id !== id) return;

  const run = current;
  const text = run.text.trim();

  if (!text) {
    finishRun(id);
    return;
  }

  const utterance = makeUtterance(text);

  run.utterance = utterance;

  utterance.onstart = () => {
    if (!current || current.id !== id) return;

    run.started = true;
    run.callbacks.onStart?.();
  };

  // Reveal cloud words as browser speaks.
  utterance.onboundary = (event) => {
    if (!current || current.id !== id) return;

    if (event.name && event.name !== "word") return;

    run.callbacks.onBoundary?.(
      event,
      text,
      0
    );
  };

  utterance.onend = () => {
    if (!current || current.id !== id) return;

    finishRun(id);
  };

  utterance.onerror = (event) => {
    if (!current || current.id !== id) return;

    if (
      event.error === "canceled" ||
      event.error === "interrupted"
    ) {
      finishRun(id);
      return;
    }

    finishRun(
      id,
      event.error || "Speech playback failed."
    );
  };

  // Safety timeout.
  run.safetyTimer = setTimeout(() => {
    if (!current || current.id !== id) return;

    window.speechSynthesis.cancel();

    finishRun(
      id,
      "Speech playback timed out."
    );
  }, Math.max(45000, text.length * 180));

  try {
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    finishRun(
      id,
      error?.message || "Unable to start speech."
    );
  }
};

/**
 * Start a speech stream.
 * Text is buffered until finishSpeechStream().
 */
export function startSpeechStream({
  onStart,
  onBoundary,
  onEnd,
  onError,
} = {}) {
  if (!supported) {
    onError?.("Speech synthesis is not supported.");
    onEnd?.();
    return false;
  }

  stopSpeaking();

  const id = ++runId;

  current = {
    id,
    text: "",
    finished: false,
    started: false,
    utterance: null,
    safetyTimer: null,

    callbacks: {
      onStart,
      onBoundary,
      onEnd,
      onError,
    },
  };

  startResumeMonitor(id);

  return true;
}

/**
 * Add narration text.
 * All text is combined into one utterance.
 */
export function addSpeechSentence(sentence) {
  if (!supported || !current) return false;

  if (current.finished) return false;

  const text = String(sentence || "").trim();

  if (!text) return true;

  current.text += current.text
    ? ` ${text}`
    : text;

  return true;
}

/**
 * Finish adding text and start speaking.
 */
export function finishSpeechStream() {
  if (!current || current.finished) return;

  current.finished = true;

  startSingleUtterance(current.id);
}

/**
 * Backward-compatible speakSequence().
 */
export function speakSequence(
  lines,
  {
    onStart,
    onBoundary,
    onEnd,
    onError,
  } = {}
) {
  if (!supported) {
    onError?.("Speech synthesis is not supported.");
    onEnd?.();
    return;
  }

  const text = (lines || [])
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .join(" ");

  stopSpeaking();

  const id = ++runId;

  current = {
    id,
    text,
    finished: true,
    started: false,
    utterance: null,
    safetyTimer: null,

    callbacks: {
      onStart,
      onBoundary,
      onEnd,
      onError,
    },
  };

  startResumeMonitor(id);

  startSingleUtterance(id);
}

// Speak a single text.
export const speak = (text, options = {}) => {
  speakSequence([text], options);
};

// Existing helper.
export const speakGoingTo = (sectionName) => {
  speak(String(sectionName));
};
