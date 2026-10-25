import React, { useState, useEffect, useRef } from 'react';
import { SpinningAICircle } from './components/SpinningAICircle';
import { AssistantState, Attachment } from './types';
import { SUPPORTED_LANGUAGES } from './services/languages';
import {
  createSpeechRecognizer,
  SpeechRecognitionController,
  speakBrowserTTS,
  createStreamingSpeechPlayer,
  StreamingSpeechPlayer,
  playServerAudio,
  stopAllSpeech,
  sanitizeTextForSpeech,
  unlockAudio,
  ensureVoicesLoaded,
} from './services/speech';
import {
  startVoiceRecording,
  VoiceRecorderController,
  AudioRecordingResult,
} from './services/audioRecorder';
import {
  sendMessageToSara,
  requestSaraTTS,
  processFileToAttachment,
  extractImagePrompt,
} from './services/api';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Keyboard,
  Send,
  Paperclip,
  Trash2,
  Globe,
  Sparkles,
  ChevronDown,
  X,
  RotateCcw,
  AlertCircle,
  Camera,
  Share2,
  MessageCircle,
  Check,
  Copy,
  Settings,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { SettingsModal } from './components/SettingsModal';
import { ChatHistoryRecord, UserProfile } from './types';
import { detectCurrentLocation, getCachedLocation, UserLocationData } from './services/location';

export default function App() {
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  // Subtitle / conversation interaction state
  const [userQuery, setUserQuery] = useState<string>('');
  const [saraReply, setSaraReply] = useState<string>('');
  const [history, setHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);

  // User Profile & Smart Memory (persisted in localStorage)
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('sara_user_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      name: 'User',
      email: '',
      city: '',
      language: 'Hindi',
      facts: [],
    };
  });

  // Persistent Chat History
  const [chatHistoryRecords, setChatHistoryRecords] = useState<ChatHistoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem('sara_chat_history_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  // User Location & Live Weather
  const [userLocation, setUserLocation] = useState<UserLocationData>(() => getCachedLocation());

  useEffect(() => {
    detectCurrentLocation().then((loc) => {
      setUserLocation(loc);
    });
  }, []);

  // Modals & UI States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReplyCopied, setIsReplyCopied] = useState(false);

  // Voice recording & visualizer state
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [micErrorMessage, setMicErrorMessage] = useState<string>('');

  // Text input drawer/modal toggle
  const [showTextInput, setShowTextInput] = useState(false);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeImagePreview, setActiveImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognizerRef = useRef<SpeechRecognitionController | null>(null);
  const audioRecorderRef = useRef<VoiceRecorderController | null>(null);
  const latestTranscriptRef = useRef<string>('');
  const isQuerySentRef = useRef<boolean>(false);
  const hasSpokenRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<any>(null);
  const maxListeningTimerRef = useRef<any>(null);
  const streamingPlayerRef = useRef<StreamingSpeechPlayer | null>(null);

  const activeLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];

  // Auto clean speech and timers on unmount; pre-warm voices immediately
  useEffect(() => {
    ensureVoicesLoaded();
    return () => {
      stopAllSpeech();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (maxListeningTimerRef.current) clearTimeout(maxListeningTimerRef.current);
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
      if (audioRecorderRef.current) {
        audioRecorderRef.current.cancel();
      }
    };
  }, []);

  // Safely cancel listening session and return to idle state
  const cancelListeningAndReset = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxListeningTimerRef.current) clearTimeout(maxListeningTimerRef.current);

    if (streamingPlayerRef.current) {
      streamingPlayerRef.current.cancel();
      streamingPlayerRef.current = null;
    }

    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch (e) {}
      recognizerRef.current = null;
    }

    if (audioRecorderRef.current) {
      try {
        audioRecorderRef.current.cancel();
      } catch (e) {}
      audioRecorderRef.current = null;
    }

    latestTranscriptRef.current = '';
    setUserQuery('');
    setVolumeLevel(0);
    setAssistantState('idle');
  };

  // Voice Interaction - Toggle Listening
  const toggleVoice = () => {
    unlockAudio();
    if (assistantState === 'speaking') {
      stopAllSpeech();
      setAssistantState('idle');
      return;
    }

    if (assistantState === 'listening') {
      stopVoiceAndProcess();
      return;
    }

    startListening();
  };

  // Stop listening and process valid user transcript or recorded audio
  const stopVoiceAndProcess = async () => {
    if (isQuerySentRef.current) return;
    isQuerySentRef.current = true;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxListeningTimerRef.current) clearTimeout(maxListeningTimerRef.current);

    // 1. Stop Speech Recognizer
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch (e) {}
      recognizerRef.current = null;
    }

    setVolumeLevel(0);

    const transcript = latestTranscriptRef.current.trim();

    // Fast-path: If live speech recognition captured text, send query immediately with 0ms delay!
    if (transcript.length >= 2) {
      if (audioRecorderRef.current) {
        try {
          audioRecorderRef.current.cancel();
        } catch (e) {}
        audioRecorderRef.current = null;
      }
      handleSendQuery(transcript);
      return;
    }

    // Fallback: Speech recognition gave no text, check recorded audio
    let recordedAudio: AudioRecordingResult | null = null;
    if (audioRecorderRef.current) {
      try {
        recordedAudio = await audioRecorderRef.current.stop();
      } catch (e) {
        console.warn('Audio recorder stop notice:', e);
      }
      audioRecorderRef.current = null;
    }

    if (recordedAudio && recordedAudio.base64Data && recordedAudio.durationMs >= 500) {
      const ext = recordedAudio.mimeType.includes('mp4') ? 'mp4' : 'webm';
      const audioAttachment: Attachment = {
        id: 'voice_' + Date.now(),
        name: `voice_query.${ext}`,
        mimeType: recordedAudio.mimeType || 'audio/webm',
        data: recordedAudio.base64Data,
        type: 'audio',
      };

      setUserQuery('🎙️ Voice Query (आपकी आवाज़ सुनी जा रही है...)');
      handleSendQuery(
        'User ne yeh audio voice recording bheji hai. Kripya is aawaz ko dhyan se sunkar, samajhkar, poora Hindi mein bolkar jawab dein.',
        [audioAttachment]
      );
      return;
    }

    // If no meaningful words or audio was captured
    isQuerySentRef.current = false;
    setAssistantState('idle');
    setUserQuery('');
  };

  const startListening = async () => {
    stopAllSpeech();
    unlockAudio();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxListeningTimerRef.current) clearTimeout(maxListeningTimerRef.current);

    setMicErrorMessage('');
    latestTranscriptRef.current = '';
    isQuerySentRef.current = false;
    hasSpokenRef.current = false;
    setVolumeLevel(0);

    // 1. Start audio visualizer and hardware MediaRecorder (supported on 100% of mobile phones)
    try {
      audioRecorderRef.current = await startVoiceRecording((vol) => {
        setVolumeLevel(vol);
      });
      setAssistantState('listening');
    } catch (err: any) {
      console.warn('Microphone permission or access error on phone:', err);
      const isMobile =
        typeof navigator !== 'undefined' &&
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const msg = isMobile
        ? '📱 फ़ोन पर माइक की अनुमति दें: ऊपर ब्राउज़र एड्रेस बार में लॉक 🔒 या माइक 🎙️ आइकन पर टैप करें और "Microphone" को "Allow" (अनुमति दें) करें, फिर दोबारा टैप करें।'
        : 'Microphone access blocked. Please allow microphone permission in your browser address bar to speak to Sara.';
      setMicErrorMessage(msg);
      setShowTextInput(true);
      setAssistantState('idle');
      return;
    }

    // Auto-timeout: If user activates mic and does not stop or speak for 30 seconds, gracefully process what was recorded
    maxListeningTimerRef.current = setTimeout(() => {
      if (!isQuerySentRef.current) {
        stopVoiceAndProcess();
      }
    }, 30000);

    // 2. Start speech recognizer for live real-time subtitles
    recognizerRef.current = createSpeechRecognizer(
      activeLangObj.speechCode,
      (transcript) => {
        const clean = transcript.trim();
        if (!clean) return;

        latestTranscriptRef.current = clean;
        setUserQuery(clean);
        hasSpokenRef.current = true;

        // Reset silence timer on every speech event
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // Fast, natural conversational pause: wait 950ms of silence after speaking before sending query
        if (clean.length >= 2) {
          silenceTimerRef.current = setTimeout(() => {
            if (!isQuerySentRef.current && latestTranscriptRef.current.trim().length >= 2) {
              stopVoiceAndProcess();
            }
          }, 950);
        }
      },
      (err) => {
        console.warn('Speech recognition device notice:', err);
      },
      () => {
        // onEnd: browser recognition session ended
        if (isQuerySentRef.current) return;

        if (!silenceTimerRef.current) {
          const transcript = latestTranscriptRef.current.trim();
          if (transcript.length >= 2) {
            silenceTimerRef.current = setTimeout(() => {
              if (!isQuerySentRef.current && latestTranscriptRef.current.trim().length >= 2) {
                stopVoiceAndProcess();
              }
            }, 400);
          }
        }
      }
    );

    if (recognizerRef.current.isSupported) {
      recognizerRef.current.start();
    }
  };

  // Send Query to Sara AI
  const handleSendQuery = async (text: string, atts: Attachment[] = []) => {
    const imgAtt = atts.find((a) => a.type === 'image' || a.mimeType?.startsWith('image/'));
    const effectiveText = text.trim() || (imgAtt
      ? 'सारा, इस फ़ोटो को बहुत ध्यान से देखकर बताइए कि इसमें क्या-क्या है और इस पूरे विषय (Topic) को अच्छे से विस्तार से समझाइए।'
      : '');

    if (!effectiveText && atts.length === 0) return;

    if (imgAtt) {
      setActiveImagePreview(imgAtt.data);
    }

    unlockAudio();
    setUserQuery(effectiveText);
    setSaraReply('');
    setAssistantState('thinking');
    setIsLoading(true);

    // Check celebratory trigger
    const lower = text.toLowerCase();
    if (lower.includes('badhai') || lower.includes('mubarak') || lower.includes('congrat') || lower.includes('shabaash')) {
      confetti({ particleCount: 50, spread: 70 });
    }

    // Auto-detect & save personal user facts into memory
    const favMatch = text.match(/(?:mera|meri)\s+favourite\s+([a-zA-Z\s]+?)\s+(?:hai|bhi)/i);
    if (favMatch && favMatch[1].trim().length > 2) {
      const fact = `Mera favourite ${favMatch[1].trim()} hai`;
      setUserProfile((prev) => {
        if (!prev.facts.includes(fact)) {
          const updated = { ...prev, facts: [...prev.facts, fact] };
          localStorage.setItem('sara_user_profile', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }

    // Save user message to persistent chat history
    const userMsgRecord: ChatHistoryRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      text: effectiveText,
      timestamp: Date.now(),
    };
    setChatHistoryRecords((prev) => {
      const updated = [userMsgRecord, ...prev];
      try {
        localStorage.setItem('sara_chat_history_v2', JSON.stringify(updated.slice(0, 100)));
      } catch (e) {}
      return updated;
    });

    const newHistory = [
      ...history,
      { role: 'user' as const, text: effectiveText },
    ];
    setHistory(newHistory);

    let streamedCleanText = '';

    // Initialize ultra-fast sentence-pipelined speech player
    // Speaks Sentence 1 the millisecond it arrives from LLM (< 500ms time-to-speech!)
    const speechStreamPlayer = createStreamingSpeechPlayer(
      activeLangObj.speechCode,
      () => setAssistantState('speaking'),
      () => setAssistantState('idle')
    );
    streamingPlayerRef.current = speechStreamPlayer;

    try {
      const reply = await sendMessageToSara({
        messages: newHistory.map((h) => ({
          role: h.role,
          text: h.text,
          attachments: atts.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            data: a.data,
          })),
        })),
        userProfile,
        userLocation,
        activeLanguage: selectedLanguage,
        onChunk: (partialText) => {
          const { cleanText } = extractImagePrompt(partialText);
          streamedCleanText = cleanText;
          setSaraReply(cleanText);

          if (cleanText.trim().length > 0) {
            setAssistantState('speaking');
            speechStreamPlayer.pushChunk(cleanText);
          }
        },
      });

      const { cleanText } = extractImagePrompt(reply || streamedCleanText);
      setSaraReply(cleanText);
      setHistory((prev) => [...prev, { role: 'model', text: cleanText }]);

      // Save AI reply to persistent chat history
      const aiMsgRecord: ChatHistoryRecord = {
        id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        role: 'model',
        text: cleanText,
        timestamp: Date.now(),
      };
      setChatHistoryRecords((prev) => {
        const updated = [aiMsgRecord, ...prev];
        try {
          localStorage.setItem('sara_chat_history_v2', JSON.stringify(updated.slice(0, 100)));
        } catch (e) {}
        return updated;
      });

      // Finish speech stream player, passing final full text for any trailing sentences
      if (cleanText.trim().length > 0) {
        speechStreamPlayer.finish(cleanText);
      } else {
        speechStreamPlayer.finish();
        setAssistantState('idle');
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      if (streamingPlayerRef.current) {
        streamingPlayerRef.current.cancel();
      }
      const errMsg = "Arre re! Ek chhota sa network issue aaya. Please dobara boliye, main sun rahi hoon!";
      setSaraReply(errMsg);
      speakSaraResponse(errMsg);
    } finally {
      setIsLoading(false);
      setInputText('');
      setAttachments([]);
      setShowTextInput(false);
    }
  };

  // Camera Capture Handler
  const handleCaptureFromCamera = (prompt: string, attachment: Attachment) => {
    handleSendQuery(prompt, [attachment]);
  };

  // Chat History Clear Handler
  const handleClearChatHistory = () => {
    setChatHistoryRecords([]);
    try {
      localStorage.removeItem('sara_chat_history_v2');
    } catch (e) {}
    handleClear();
  };

  // Profile Update Handler
  const handleUpdateProfile = (updated: UserProfile) => {
    setUserProfile(updated);
    localStorage.setItem('sara_user_profile', JSON.stringify(updated));
  };

  // WhatsApp & SMS Sharing
  const handleShareWhatsApp = (text: string) => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + '\n\n— सारा AI (Sara AI)')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareSMS = (text: string) => {
    const url = `sms:?body=${encodeURIComponent(text)}`;
    window.location.href = url;
  };

  const handleCopyReply = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsReplyCopied(true);
    setTimeout(() => setIsReplyCopied(false), 2000);
  };

  // Speak Sara's response INSTANTLY with zero latency (< 30ms delay) using sweet native voice
  const speakSaraResponse = (text: string, onDoneCallback?: () => void) => {
    setAssistantState('speaking');

    const onDone = () => {
      if (onDoneCallback) {
        onDoneCallback();
      } else {
        setAssistantState('idle');
      }
    };

    const cleanSpeechText = sanitizeTextForSpeech(text);
    if (!cleanSpeechText) {
      onDone();
      return;
    }

    // Instant local speech playback (starts in < 30ms, no 12-second server TTS buffering wait)
    speakBrowserTTS(cleanSpeechText, activeLangObj.speechCode, undefined, onDone);
  };

  // Replay speech
  const handleReplay = () => {
    if (saraReply) {
      unlockAudio();
      speakSaraResponse(saraReply);
    }
  };

  const handleStopSpeaking = () => {
    if (streamingPlayerRef.current) {
      streamingPlayerRef.current.cancel();
      streamingPlayerRef.current = null;
    }
    stopAllSpeech();
    setAssistantState('idle');
  };

  const handleClear = () => {
    if (streamingPlayerRef.current) {
      streamingPlayerRef.current.cancel();
      streamingPlayerRef.current = null;
    }
    stopAllSpeech();
    cancelListeningAndReset();
    setUserQuery('');
    setSaraReply('');
    setHistory([]);
    setAssistantState('idle');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAtts: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const att = await processFileToAttachment(files[i]);
        newAtts.push(att);
      } catch (err) {
        console.error('File error:', err);
      }
    }
    setAttachments((prev) => [...prev, ...newAtts]);
    e.target.value = '';
  };

  return (
    <div className="relative flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Background Starry / Glow Ambiance */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(244,63,94,0.15),rgba(255,255,255,0))] pointer-events-none" />

      {/* Minimal Top Bar */}
      <header className="relative z-20 w-full px-4 sm:px-8 py-4 flex items-center justify-between">
        {/* Sara Brand & App Logo */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl overflow-hidden shadow-lg shadow-rose-950/60 ring-2 ring-rose-500/40 bg-slate-900 shrink-0">
            <img
              src="/src/assets/images/sara_ai_logo_1791460473992.jpg"
              alt="Sara AI Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <span className="bg-gradient-to-r from-white via-slate-100 to-rose-200 bg-clip-text text-transparent">Sara AI</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-serif font-normal">
                सारा AI
              </span>
            </h1>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">
              Created by <span className="text-rose-300 font-semibold">Mister Sunny Pannalal Gupta ji</span>
            </span>
          </div>
        </div>

        {/* Minimal Controls */}
        <div className="flex items-center gap-2">
          {/* Language Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-slate-900/90 border border-slate-800 text-slate-200 hover:border-rose-500/50 hover:text-white transition-all shadow-sm"
              title="Change Language"
            >
              <Globe className="w-3.5 h-3.5 text-rose-400" />
              <span>{activeLangObj.flag} {activeLangObj.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 max-h-72 overflow-y-auto rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl p-1.5 z-50 backdrop-blur-xl">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setSelectedLanguage(lang.code);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-colors ${
                      selectedLanguage === lang.code
                        ? 'bg-rose-500/20 text-rose-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <span>{lang.flag} {lang.name}</span>
                    <span className="text-[11px] text-slate-400 font-serif">{lang.nativeName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settings Button Right Next to Auto Detect (auto detect ke baju me setting) */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-slate-900/90 border border-slate-800 text-slate-200 hover:border-rose-500/50 hover:text-white transition-all shadow-sm"
            title="सेटिंग्स - अपना नाम, Gmail और चैट हिस्ट्री देखें"
          >
            <Settings className="w-3.5 h-3.5 text-rose-400" />
            <span>सेटिंग्स</span>
          </button>

          {/* Reset / Clear Button */}
          {(userQuery || saraReply) && (
            <button
              onClick={handleClear}
              className="p-2 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Center Screen: THE SPINNING AI CIRCLE & LIVE SUBTITLES */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 max-w-3xl mx-auto w-full">
        {/* Mic Permission / Access Error Alert */}
        {micErrorMessage && (
          <div className="mb-3 mx-4 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs sm:text-sm flex items-start gap-2.5 max-w-md animate-fadeIn shadow-lg backdrop-blur-md">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-300">Microphone Permission Needed</p>
              <p className="mt-0.5 text-slate-300 text-xs leading-relaxed">{micErrorMessage}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={startListening}
                  className="px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors"
                >
                  Try Mic Again
                </button>
                <button
                  onClick={() => {
                    setMicErrorMessage('');
                    setShowTextInput(true);
                  }}
                  className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                >
                  Type Message
                </button>
              </div>
            </div>
            <button
              onClick={() => setMicErrorMessage('')}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* The Spinning AI Circle */}
        <SpinningAICircle
          state={assistantState}
          onCircleClick={toggleVoice}
          languageText={activeLangObj.name}
          volumeLevel={volumeLevel}
        />

        {/* Live Conversation Subtitles / Response Area */}
        <div className="w-full max-w-xl mt-4 px-4 flex flex-col items-center min-h-[140px] justify-center text-center">
          {/* Active Image Being Examined / Discussed */}
          {activeImagePreview && (
            <div className="mb-3 max-w-sm w-full rounded-2xl overflow-hidden border border-rose-500/40 bg-slate-900/90 shadow-xl shadow-rose-950/40 animate-fadeIn relative">
              <img
                src={activeImagePreview}
                alt="Examined visual"
                referrerPolicy="no-referrer"
                className="w-full max-h-56 object-contain bg-black/50"
              />
              <div className="px-3 py-1.5 bg-slate-950/90 border-t border-rose-500/20 flex items-center justify-between text-[11px] text-rose-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  सारा इस तस्वीर का पूरा विषय समझा रही है
                </span>
                <button
                  type="button"
                  onClick={() => setActiveImagePreview(null)}
                  className="text-slate-400 hover:text-white"
                  title="Hide preview"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* User's spoken query (when not in listening mode) */}
          {userQuery && assistantState !== 'listening' && (
            <div className="mb-2 text-xs sm:text-sm font-medium text-slate-400 animate-fadeIn">
              <span className="text-slate-500">You: </span>
              "{userQuery}"
            </div>
          )}

          {/* Sara's Answer / Live Speech */}
          {saraReply ? (
            <div className="rounded-2xl bg-slate-900/85 border border-slate-800/90 p-4 sm:p-5 shadow-2xl backdrop-blur-md max-w-xl w-full max-h-[48vh] sm:max-h-[56vh] overflow-y-auto animate-fadeIn text-left">
              <div className="sticky -top-4 bg-slate-900/95 backdrop-blur-md -mx-4 sm:-mx-5 px-4 sm:px-5 py-2 z-10 flex items-center justify-between text-xs text-rose-300 font-semibold mb-2 border-b border-white/5">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Sara AI
                </span>
                <div className="flex items-center gap-1">
                  {/* WhatsApp Share */}
                  <button
                    onClick={() => handleShareWhatsApp(saraReply)}
                    className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors"
                    title="WhatsApp पर भेजें"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  {/* SMS Share */}
                  <button
                    onClick={() => handleShareSMS(saraReply)}
                    className="p-1.5 rounded-lg hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors"
                    title="SMS भेजें"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>

                  {/* Copy Text */}
                  <button
                    onClick={() => handleCopyReply(saraReply)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title="कॉपी करें"
                  >
                    {isReplyCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Replay */}
                  <button
                    onClick={handleReplay}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title="दोबारा सुनें"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>

                  {assistantState === 'speaking' && (
                    <button
                      onClick={handleStopSpeaking}
                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
                      title="आवाज़ रोकें"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm sm:text-base text-slate-100 leading-relaxed font-sans whitespace-pre-wrap select-text">
                {saraReply}
              </div>
            </div>
          ) : assistantState === 'thinking' ? (
            <div className="flex items-center gap-2 text-sm text-amber-300 font-medium animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Sara is thinking with care...</span>
            </div>
          ) : assistantState === 'listening' ? (
            <div className="flex flex-col items-center gap-2.5 w-full max-w-lg px-2 animate-fadeIn">
              <div className="px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-medium animate-pulse flex items-center gap-2 shadow-lg shadow-emerald-950/40">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>सारा आपकी पूरी बात ध्यान से सुन रही है... बोलते रहें</span>
              </div>

              {/* Real-time transcribed text box */}
              <div className="w-full p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 text-left shadow-xl backdrop-blur-md">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>आपकी आवाज़ (Live Transcribing):</span>
                  <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    सुन रही है
                  </span>
                </div>
                <p className="text-sm sm:text-base text-slate-100 min-h-[32px] font-sans">
                  {userQuery ? (
                    <span className="text-emerald-200 font-medium">"{userQuery}"</span>
                  ) : (
                    <span className="text-slate-500 italic">आप जो भी बोलेंगे, सारा पूरा सुनकर ही जवाब देगी...</span>
                  )}
                </p>
              </div>

              {/* Quick Actions while speaking */}
              <div className="flex items-center gap-2.5 mt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!isQuerySentRef.current) {
                      stopVoiceAndProcess();
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50 transition-all active:scale-95"
                  title="अगर आपकी बात पूरी हो गई है, तो तुरंत उत्तर पाने के लिए यहाँ दबाएँ"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>पूरी बात हो गई (अभी जवाब दें)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopAllSpeech();
                    if (recognizerRef.current) recognizerRef.current.stop();
                    if (audioRecorderRef.current) audioRecorderRef.current.stop();
                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    if (maxListeningTimerRef.current) clearTimeout(maxListeningTimerRef.current);
                    setAssistantState('idle');
                    setUserQuery('');
                  }}
                  className="px-3.5 py-2 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs transition-colors"
                >
                  रद्द करें
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* Floating Bottom Control Bar */}
      <footer className="relative z-20 w-full pb-8 pt-2 flex flex-col items-center">
        <div className="flex items-center justify-center gap-4">
          {/* Keyboard / Text Mode Toggle */}
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className={`p-3.5 rounded-full border transition-all ${
              showTextInput
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
            title="टाइप करके संदेश भेजें"
          >
            <Keyboard className="w-5 h-5" />
          </button>

          {/* Central Voice Button */}
          <button
            onClick={toggleVoice}
            className={`p-5 rounded-full text-white shadow-2xl transition-all active:scale-95 flex items-center justify-center ${
              assistantState === 'listening'
                ? 'bg-emerald-500 shadow-emerald-500/50 animate-pulse'
                : assistantState === 'speaking'
                ? 'bg-rose-600 shadow-rose-600/50'
                : 'bg-gradient-to-tr from-rose-500 via-pink-600 to-amber-500 shadow-rose-950/80 hover:scale-105'
            }`}
            title={
              assistantState === 'listening'
                ? 'सुनना बंद करें'
                : assistantState === 'speaking'
                ? 'बोलना रोकें'
                : 'सारा से बात करें'
            }
          >
            {assistantState === 'listening' ? (
              <MicOff className="w-7 h-7" />
            ) : assistantState === 'speaking' ? (
              <VolumeX className="w-7 h-7 animate-pulse" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </button>
        </div>

        {/* Helper Cue */}
        <p className="mt-3 text-[11px] text-slate-500 tracking-wide font-medium">
          {assistantState === 'listening'
            ? 'बोलिए, सारा सुन रही है...'
            : assistantState === 'speaking'
            ? 'सारा बोल रही है...'
            : 'माइक पर टैप करके किसी भी भाषा में बोलिए'}
        </p>

        {/* Creator Attribution */}
        <p className="mt-1 text-[11px] text-slate-400 font-medium">
          Crafted with care by <span className="text-rose-300 font-semibold">Mister Sunny Pannalal Gupta ji</span>
        </p>
      </footer>

      {/* Minimalist Slide-up Text / Media Input (Hidden unless toggled) */}
      {showTextInput && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 bg-slate-900/95 backdrop-blur-2xl border-t border-slate-800 shadow-2xl animate-fadeIn">
          <div className="max-w-xl mx-auto flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Type message or attach photo/document for Sara:</span>
              <button
                onClick={() => setShowTextInput(false)}
                className="p-1 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Attached files preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 py-1 items-center">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-rose-500/30 text-xs text-slate-200"
                  >
                    {att.type === 'image' ? (
                      <img
                        src={att.data}
                        alt="Preview"
                        className="w-7 h-7 rounded-lg object-cover ring-1 ring-white/20"
                      />
                    ) : (
                      <Paperclip className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    <span className="truncate max-w-[120px] font-medium">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                      className="text-slate-400 hover:text-rose-400 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <span className="text-[11px] text-rose-300 font-medium ml-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  फोटो तैयार है — सारा इसे देखकर पूरा विषय समझाएगी
                </span>
              </div>
            )}

            {/* Input field */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendQuery(inputText, attachments);
                setInputText('');
                setAttachments([]);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                accept="image/*,.pdf,.txt,.csv"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400"
                title="Attach photo or document"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400"
                title="कैमरा से फोटो खींचें"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  attachments.some((a) => a.type === 'image')
                    ? "फ़ोटो के बारे में कुछ पूछें या सीधे भेजें..."
                    : "Ask Sara anything in Hinglish, Hindi, Marathi..."
                }
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60"
                autoFocus
              />

              <button
                type="submit"
                disabled={isLoading || (!inputText.trim() && attachments.length === 0)}
                className="p-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-medium"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Camera Capture & OCR Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCaptureAndSend={handleCaptureFromCamera}
      />

      {/* Settings Modal (Name, Gmail, and Chat History) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userProfile={userProfile}
        onSaveProfile={handleUpdateProfile}
        chatHistory={chatHistoryRecords}
        onClearHistory={handleClearChatHistory}
      />
    </div>
  );
}
