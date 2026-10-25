// Speech recognition and synthesis services for Sara AI

// Clean text for speech synthesis (strip markdown, asterisks, brackets, image prompts, emojis)
export function sanitizeTextForSpeech(text: string): string {
  let cleaned = text;
  // Remove image prompt blocks
  cleaned = cleaned.replace(/\[IMAGE_PROMPT:[\s\S]*?\]/gi, '');
  // Remove markdown bold/italics/code/quotes
  cleaned = cleaned.replace(/[*_#`~>]/g, ' ');
  // Remove links markdown [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Remove parenthetical translations/notes (e.g. "(मिस्टर सन्नी पन्नालाल गुप्ता जी)" or "(vision)")
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ');
  // Remove bullet symbols or dashes at line starts
  cleaned = cleaned.replace(/^[\s*•\-–—]+/gm, '');
  // Remove emojis using unicode ranges
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '');
  // Remove remaining brackets and symbols
  cleaned = cleaned.replace(/[\[\]\(\)\{\}]/g, '');
  // Remove multiple spaces/newlines
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

let activeAudio: HTMLAudioElement | null = null;
let activeUtterances: SpeechSynthesisUtterance[] = [];
let speechKeepAliveInterval: any = null;

export function stopAllSpeech(): void {
  if (speechKeepAliveInterval) {
    clearInterval(speechKeepAliveInterval);
    speechKeepAliveInterval = null;
  }
  activeUtterances = [];

  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch (e) {}
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
}

// Unlock browser audio context on user gesture
export function unlockAudio(): void {
  if (typeof window !== 'undefined') {
    try {
      const silentAudio = new Audio();
      silentAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      silentAudio.play().then(() => {
        silentAudio.pause();
      }).catch(() => {});
    } catch (e) {}

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
      } catch (e) {}
    }
  }
}

// Play server generated audio wav (from Gemini TTS)
export function playServerAudio(audioUrl: string, onEnd?: () => void): Promise<void> {
  stopAllSpeech();
  return new Promise((resolve, reject) => {
    try {
      const audio = new Audio(audioUrl);
      activeAudio = audio;
      audio.onended = () => {
        activeAudio = null;
        if (onEnd) onEnd();
        resolve();
      };
      audio.onerror = (e) => {
        console.warn('Audio playback error:', e);
        activeAudio = null;
        if (onEnd) onEnd();
        reject(e);
      };
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio play was prevented by browser:', err);
          activeAudio = null;
          if (onEnd) onEnd();
          reject(err);
        });
      }
    } catch (err) {
      if (onEnd) onEnd();
      reject(err);
    }
  });
}

// Split text into natural sentence chunks to prevent browser speech synthesis from stopping on long text
function chunkTextForSpeech(text: string): string[] {
  const rawSegments = text.split(/([।\.\?!;\n]+)/);
  const chunks: string[] = [];
  let current = '';

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i];
    if (!seg) continue;

    if (current.length + seg.length < 220) {
      current += seg;
    } else {
      if (current.trim()) chunks.push(current.trim());
      current = seg;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

// Voice cache and configuration
let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesLoadedPromise: Promise<SpeechSynthesisVoice[]> | null = null;

export interface SaraVoiceConfig {
  voiceURI: string;
  voiceName: string;
  rate: number;
  pitch: number;
  isLocked: boolean;
}

const DEFAULT_VOICE_CONFIG: SaraVoiceConfig = {
  voiceURI: '',
  voiceName: '',
  rate: 1.08,
  pitch: 1.1,
  isLocked: true,
};

export function getSaraVoiceConfig(): SaraVoiceConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_VOICE_CONFIG };
  try {
    const raw = localStorage.getItem('sara_voice_config_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_VOICE_CONFIG, ...parsed };
    }
  } catch (e) {}
  return { ...DEFAULT_VOICE_CONFIG };
}

export function saveSaraVoiceConfig(cfg: Partial<SaraVoiceConfig>): SaraVoiceConfig {
  const current = getSaraVoiceConfig();
  const updated = { ...current, ...cfg };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('sara_voice_config_v2', JSON.stringify(updated));
    } catch (e) {}
  }
  return updated;
}

// Ensure browser voices are loaded without returning empty [] on initial page load
export function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }

  const existing = window.speechSynthesis.getVoices();
  if (existing && existing.length > 0) {
    cachedVoices = existing;
    return Promise.resolve(existing);
  }

  if (voicesLoadedPromise) {
    return voicesLoadedPromise;
  }

  voicesLoadedPromise = new Promise((resolve) => {
    let resolved = false;

    const onVoicesChanged = () => {
      if (resolved) return;
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        resolved = true;
        cachedVoices = v;
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(v);
      }
    };

    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

    // Timeout safety fallback after 350ms so UI never stalls
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      const v = window.speechSynthesis.getVoices();
      cachedVoices = v || [];
      resolve(cachedVoices);
    }, 350);
  });

  return voicesLoadedPromise;
}

// Pre-warm voices on startup
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

const FEMALE_VOICE_KEYWORDS = [
  'swara',
  'lekha',
  'kalpana',
  'veena',
  'heera',
  'neerja',
  'priya',
  'shreya',
  'sunita',
  'ananya',
  'pooja',
  'kavya',
  'zira',
  'samantha',
  'karen',
  'victoria',
  'female',
  'woman',
  'girl',
  'हिन्दी',
  'hindi',
];

const MALE_VOICE_KEYWORDS = [
  'male',
  'man',
  'ravi',
  'madhav',
  'george',
  'david',
  'guy',
  'boy',
];

export function isLikelyFemaleVoice(v: SpeechSynthesisVoice): boolean {
  const name = v.name.toLowerCase();
  if (MALE_VOICE_KEYWORDS.some((k) => name.includes(k))) return false;
  return FEMALE_VOICE_KEYWORDS.some((k) => name.includes(k)) || !MALE_VOICE_KEYWORDS.some((k) => name.includes(k));
}

// Get all available voices categorized with Sara-recommended Indian voices marked
export function getAvailableSaraVoices(): {
  voice: SpeechSynthesisVoice;
  isRecommended: boolean;
  label: string;
}[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return [];

  return voices.map((v) => {
    const isFemale = isLikelyFemaleVoice(v);
    const isIndian =
      v.lang.startsWith('hi') ||
      v.lang.startsWith('mr') ||
      v.lang.startsWith('gu') ||
      v.lang.startsWith('bn') ||
      v.lang.startsWith('ta') ||
      v.lang.startsWith('te') ||
      v.lang === 'en-IN' ||
      v.name.toLowerCase().includes('india') ||
      v.name.toLowerCase().includes('hindi') ||
      v.name.includes('हिन्दी') ||
      v.name.toLowerCase().includes('swara') ||
      v.name.toLowerCase().includes('neerja') ||
      v.name.toLowerCase().includes('lekha');

    const isRecommended = isIndian && isFemale;
    let label = v.name;
    if (isRecommended) {
      label = `⭐ ${v.name} (${v.lang}) - Sara AI`;
    } else {
      label = `${v.name} (${v.lang})`;
    }

    return { voice: v, isRecommended, label };
  });
}

// Get the locked, persistent female voice for Sara. Voice NEVER switches unexpectedly!
export function getBestFemaleVoice(
  langCode: string = 'hi-IN',
  explicitVoicesList?: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;

  const voices =
    explicitVoicesList && explicitVoicesList.length > 0
      ? explicitVoicesList
      : cachedVoices.length > 0
      ? cachedVoices
      : window.speechSynthesis.getVoices();

  if (!voices || voices.length === 0) return undefined;

  const config = getSaraVoiceConfig();

  // 1. If user has a locked voice in config, find and return that exact voice!
  if (config.voiceURI || config.voiceName) {
    const matched = voices.find(
      (v) => (config.voiceURI && v.voiceURI === config.voiceURI) || (config.voiceName && v.name === config.voiceName)
    );
    if (matched) return matched;
  }

  // 2. Priority: Indian Hindi Female voices (Google हिन्दी, Swara, Lekha, etc.)
  const hindiFemaleVoice = voices.find(
    (v) =>
      (v.lang.startsWith('hi') || v.name.includes('हिन्दी') || v.name.toLowerCase().includes('swara') || v.name.toLowerCase().includes('lekha')) &&
      isLikelyFemaleVoice(v)
  ) || voices.find(
    (v) => v.lang.startsWith('hi') || v.name.includes('हिन्दी') || v.name.toLowerCase().includes('hindi')
  );

  if (hindiFemaleVoice) {
    // Lock this authentic Hindi female voice so Sara's voice stays 100% consistent across all pages and sessions!
    saveSaraVoiceConfig({
      voiceURI: hindiFemaleVoice.voiceURI,
      voiceName: hindiFemaleVoice.name,
    });
    return hindiFemaleVoice;
  }

  // 3. Indian English Female voice (Neerja, Heera, Veena, Google en-IN)
  const indianEnglishFemale = voices.find(
    (v) =>
      (v.lang === 'en-IN' || v.name.toLowerCase().includes('india') || v.name.toLowerCase().includes('neerja')) &&
      isLikelyFemaleVoice(v)
  );

  if (indianEnglishFemale) {
    return indianEnglishFemale;
  }

  // 4. Any Indian regional language voice matching langCode
  const langMatch = voices.find((v) => v.lang.startsWith(langCode) && isLikelyFemaleVoice(v));
  if (langMatch) {
    return langMatch;
  }

  // 5. Any pleasant female voice
  const anyFemale = voices.find((v) => isLikelyFemaleVoice(v));
  if (anyFemale) {
    return anyFemale;
  }

  // 6. Default fallback system voice (temporary, never stored in localStorage to prevent permanent degradation)
  return voices.find((v) => v.default) || voices[0];
}

// Browser Web Speech API TTS (Guaranteed consistent voice, zero switching, natural conversational pace)
export function speakBrowserTTS(
  text: string,
  langCode: string = 'hi-IN',
  onStart?: () => void,
  onEnd?: () => void
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  stopAllSpeech();

  const cleaned = sanitizeTextForSpeech(text);
  if (!cleaned) {
    if (onEnd) onEnd();
    return;
  }

  const chunks = chunkTextForSpeech(cleaned);
  let chunkIndex = 0;

  // Use locked consistent voice - never switches between Devanagari and Roman script!
  const config = getSaraVoiceConfig();
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  const lockedVoice = getBestFemaleVoice(langCode, voices);

  const speakNext = () => {
    if (chunkIndex >= chunks.length) {
      activeUtterances = [];
      if (onEnd) onEnd();
      return;
    }

    const chunkText = chunks[chunkIndex++];
    if (!chunkText || !chunkText.trim()) {
      speakNext();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunkText);
    if (lockedVoice) {
      utterance.voice = lockedVoice;
      // CRITICAL: Keep utterance.lang tied to voice.lang so the browser TTS never substitutes voices
      utterance.lang = lockedVoice.lang || langCode || 'hi-IN';
    } else {
      utterance.lang = langCode || 'hi-IN';
    }

    utterance.rate = config.rate || 1.08;
    utterance.pitch = config.pitch || 1.1;

    // Keep reference in activeUtterances so garbage collector does not silence speech mid-way
    activeUtterances.push(utterance);

    if (chunkIndex === 1 && onStart) {
      onStart();
    }

    utterance.onend = () => {
      const idx = activeUtterances.indexOf(utterance);
      if (idx !== -1) activeUtterances.splice(idx, 1);
      setTimeout(() => {
        speakNext();
      }, 20);
    };

    utterance.onerror = (e) => {
      console.warn('Speech chunk notice:', e);
      const idx = activeUtterances.indexOf(utterance);
      if (idx !== -1) activeUtterances.splice(idx, 1);
      setTimeout(() => {
        speakNext();
      }, 20);
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      const idx = activeUtterances.indexOf(utterance);
      if (idx !== -1) activeUtterances.splice(idx, 1);
      setTimeout(() => {
        speakNext();
      }, 20);
    }
  };

  // Small delay after stopAllSpeech() ensures Chromium's cancel operation finishes cleanly
  setTimeout(() => {
    speakNext();
  }, 25);
}

export interface StreamingSpeechPlayer {
  pushChunk: (fullCleanTextSoFar: string) => void;
  finish: (finalFullText?: string) => void;
  cancel: () => void;
}

// Sentence-pipelined speech player: begins speaking Sentence 1 as soon as it arrives from LLM!
// Gives < 500ms time-to-speech without waiting for the full response to finish generating!
export function createStreamingSpeechPlayer(
  langCode: string = 'hi-IN',
  onStart?: () => void,
  onDone?: () => void
): StreamingSpeechPlayer {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return {
      pushChunk: () => {},
      finish: () => {
        if (onDone) onDone();
      },
      cancel: () => {},
    };
  }

  stopAllSpeech();

  const config = getSaraVoiceConfig();
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  const lockedVoice = getBestFemaleVoice(langCode, voices);

  const queue: string[] = [];
  let isPlaying = false;
  let isCancelled = false;
  let isFinished = false;
  let processedIndex = 0;
  let hasStarted = false;

  const playNext = () => {
    if (isCancelled) return;

    if (queue.length === 0) {
      isPlaying = false;
      if (isFinished) {
        activeUtterances = [];
        if (onDone) onDone();
      }
      return;
    }

    isPlaying = true;
    const textToSpeak = queue.shift()!;
    const cleaned = sanitizeTextForSpeech(textToSpeak);
    if (!cleaned) {
      playNext();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleaned);
    if (lockedVoice) {
      utterance.voice = lockedVoice;
      utterance.lang = lockedVoice.lang || langCode || 'hi-IN';
    } else {
      utterance.lang = langCode || 'hi-IN';
    }

    utterance.rate = config.rate || 1.08;
    utterance.pitch = config.pitch || 1.1;

    activeUtterances.push(utterance);

    if (!hasStarted) {
      hasStarted = true;
      if (onStart) onStart();
    }

    utterance.onend = () => {
      const idx = activeUtterances.indexOf(utterance);
      if (idx !== -1) activeUtterances.splice(idx, 1);
      setTimeout(() => {
        playNext();
      }, 15);
    };

    utterance.onerror = (e) => {
      console.warn('Streaming speech chunk notice:', e);
      const idx = activeUtterances.indexOf(utterance);
      if (idx !== -1) activeUtterances.splice(idx, 1);
      setTimeout(() => {
        playNext();
      }, 15);
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      const idx = activeUtterances.indexOf(utterance);
      if (idx !== -1) activeUtterances.splice(idx, 1);
      setTimeout(() => {
        playNext();
      }, 15);
    }
  };

  return {
    pushChunk: (fullCleanTextSoFar: string) => {
      if (isCancelled) return;

      const remainingText = fullCleanTextSoFar.slice(processedIndex);
      const match = remainingText.match(/([।\.\?!;\n]+)/);

      if (match && match.index !== undefined) {
        const sentenceEnd = match.index + match[0].length;
        const candidateSentence = remainingText.slice(0, sentenceEnd).trim();

        if (candidateSentence.length >= 2) {
          queue.push(candidateSentence);
          processedIndex += sentenceEnd;
          if (!isPlaying) {
            playNext();
          }
        }
      }
    },
    finish: (finalFullText?: string) => {
      if (isCancelled) return;
      isFinished = true;

      const fullText = finalFullText || '';
      if (fullText && processedIndex < fullText.length) {
        const leftover = fullText.slice(processedIndex).trim();
        if (leftover.length >= 1) {
          queue.push(leftover);
          processedIndex = fullText.length;
        }
      }

      if (!isPlaying) {
        if (queue.length > 0) {
          playNext();
        } else {
          activeUtterances = [];
          if (onDone) onDone();
        }
      }
    },
    cancel: () => {
      isCancelled = true;
      queue.length = 0;
      stopAllSpeech();
    },
  };
}

// Test voice playback in Settings modal
export function testSaraVoice(
  sampleText: string = 'नमस्ते! मैं सारा हूँ, आपकी पर्सनल AI असिस्टेंट। मेरी यह आवाज़ अब हमेशा एक जैसी रहेगी।',
  onStart?: () => void,
  onEnd?: () => void
): void {
  speakBrowserTTS(sampleText, 'hi-IN', onStart, onEnd);
}

// Web Speech Recognition (STT)
export interface SpeechRecognitionController {
  start: () => void;
  stop: () => void;
  reset?: () => void;
  isSupported: boolean;
}

export function createSpeechRecognizer(
  langCode: string,
  onResult: (transcript: string, isFinal: boolean) => void,
  onError: (err: any) => void,
  onEnd: () => void
): SpeechRecognitionController {
  if (typeof window === 'undefined') {
    return { start: () => {}, stop: () => {}, isSupported: false };
  }

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    return { start: () => {}, stop: () => {}, isSupported: false };
  }

  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const recognizer = new SpeechRecognitionClass();
  // Android Chrome crashes/stops immediately with continuous = true; desktop handles it fine
  recognizer.continuous = !isMobile;
  recognizer.interimResults = true;
  recognizer.lang = langCode || 'hi-IN';

  let isExplicitlyStopped = false;
  let sessionPrefixText = '';
  let lastSessionFinal = '';
  let restartTimeout: any = null;

  recognizer.onresult = (event: any) => {
    let currentSessionFinal = '';
    let currentInterim = '';

    // Iterate over ALL results in current recognition session from 0 to preserve full sentence
    for (let i = 0; i < event.results.length; ++i) {
      const res = event.results[i];
      if (res && res[0]) {
        if (res.isFinal) {
          currentSessionFinal += res[0].transcript + ' ';
        } else {
          currentInterim += res[0].transcript;
        }
      }
    }

    lastSessionFinal = currentSessionFinal;
    const fullTranscript = (sessionPrefixText + currentSessionFinal + currentInterim).trim();
    if (fullTranscript) {
      onResult(fullTranscript, currentInterim.trim().length === 0);
    }
  };

  recognizer.onerror = (e: any) => {
    // Expected mobile silence, aborted, or audio-capture collisions
    if (e.error === 'no-speech' || e.error === 'aborted') {
      return;
    }
    console.warn('Speech recognition notice on device:', e.error || e);
    onError(e);
  };

  recognizer.onend = () => {
    if (!isExplicitlyStopped) {
      // Accumulate words already spoken into prefix so nothing is lost
      sessionPrefixText = (sessionPrefixText + lastSessionFinal).trim() + (lastSessionFinal ? ' ' : '');
      lastSessionFinal = '';

      // Auto-restart recognizer seamlessly across pauses so Sara never cuts the user off!
      if (restartTimeout) clearTimeout(restartTimeout);
      restartTimeout = setTimeout(() => {
        if (!isExplicitlyStopped) {
          try {
            recognizer.start();
          } catch (err) {}
        }
      }, 50);
    }
    onEnd();
  };

  return {
    start: () => {
      isExplicitlyStopped = false;
      sessionPrefixText = '';
      lastSessionFinal = '';
      if (restartTimeout) clearTimeout(restartTimeout);
      try {
        recognizer.start();
      } catch (err) {}
    },
    stop: () => {
      isExplicitlyStopped = true;
      if (restartTimeout) clearTimeout(restartTimeout);
      try {
        recognizer.stop();
      } catch (err) {}
    },
    reset: () => {
      isExplicitlyStopped = true;
      sessionPrefixText = '';
      lastSessionFinal = '';
      if (restartTimeout) clearTimeout(restartTimeout);
      try {
        recognizer.stop();
      } catch (err) {}
    },
    isSupported: true,
  };
}
