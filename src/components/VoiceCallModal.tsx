import React, { useState, useEffect, useRef } from 'react';
import { AssistantState, UserProfile } from '../types';
import { SUPPORTED_LANGUAGES } from '../services/languages';
import { createSpeechRecognizer, SpeechRecognitionController, speakBrowserTTS, playServerAudio, stopAllSpeech } from '../services/speech';
import { sendMessageToSara, requestSaraTTS } from '../services/api';
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Globe,
  Radio,
} from 'lucide-react';

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLanguage: string;
  onSelectLanguage: (lang: string) => void;
  userProfile: UserProfile;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  isOpen,
  onClose,
  selectedLanguage,
  onSelectLanguage,
  userProfile,
}) => {
  const [callState, setCallState] = useState<'connecting' | 'listening' | 'thinking' | 'speaking'>('connecting');
  const [userTranscript, setUserTranscript] = useState('');
  const [saraReply, setSaraReply] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [voiceHistory, setVoiceHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);

  const recognizerRef = useRef<SpeechRecognitionController | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeLang = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    // Start voice call
    setCallState('speaking');
    const welcomeGreetings: Record<string, string> = {
      hinglish: `Namaste ${userProfile.name ? userProfile.name : ''}! Main Sara hoon. Aap kaise ho? Aaj kis baare mein baat karni hai?`,
      hindi: `नमस्ते ${userProfile.name ? userProfile.name : ''}! मैं सारा हूँ। आप कैसे हैं? बताइए, मैं आपकी क्या मदद करूँ?`,
      marathi: `नमस्कार ${userProfile.name ? userProfile.name : ''}! मी सारा आहे. आज आपण कशावर चर्चा करणार आहोत?`,
      bengali: `নমস্কার ${userProfile.name ? userProfile.name : ''}! আমি সারা। কেমন আছেন আপনি?`,
      tamil: `வணக்கம் ${userProfile.name ? userProfile.name : ''}! நான் சாரா. இன்று நாம் எதைப் பற்றி பேசலாம்?`,
      english: `Hi ${userProfile.name ? userProfile.name : 'there'}! I'm Sara. It's so nice to speak with you! What's on your mind today?`,
    };

    const initialGreeting = welcomeGreetings[selectedLanguage] || welcomeGreetings.hinglish;
    setSaraReply(initialGreeting);
    setVoiceHistory([{ role: 'model', text: initialGreeting }]);

    speakResponse(initialGreeting, () => {
      startListening();
    });

    return () => {
      cleanup();
    };
  }, [isOpen]);

  const cleanup = () => {
    stopAllSpeech();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognizerRef.current) {
      recognizerRef.current.stop();
      recognizerRef.current = null;
    }
    setCallState('connecting');
    setUserTranscript('');
    setSaraReply('');
  };

  const startListening = () => {
    if (isMuted) return;
    setCallState('listening');

    recognizerRef.current = createSpeechRecognizer(
      activeLang.speechCode,
      (transcript) => {
        const clean = transcript.trim();
        setUserTranscript(clean);

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // Wait 2000ms after user pauses speaking before sending query
        if (clean.length >= 2) {
          silenceTimerRef.current = setTimeout(() => {
            recognizerRef.current?.stop();
            handleUserUtterance(clean);
          }, 2000);
        }
      },
      (err) => {
        console.warn('Live voice STT error:', err);
      },
      () => {
        // ended
      }
    );

    recognizerRef.current.start();
  };

  const handleUserUtterance = async (transcript: string) => {
    setCallState('thinking');
    const newHistory = [...voiceHistory, { role: 'user' as const, text: transcript }];
    setVoiceHistory(newHistory);

    try {
      const reply = await sendMessageToSara({
        messages: newHistory,
        userProfile,
        activeLanguage: selectedLanguage,
      });

      setSaraReply(reply);
      setVoiceHistory((prev) => [...prev, { role: 'model', text: reply }]);
      setCallState('speaking');

      speakResponse(reply, () => {
        startListening();
      });
    } catch (err) {
      console.error('Call generation error:', err);
      const errReply = "Arre, thoda network glitch hua. Can you please repeat that?";
      setSaraReply(errReply);
      speakResponse(errReply, () => {
        startListening();
      });
    }
  };

  const speakResponse = async (text: string, onDone: () => void) => {
    // Speak with Sara's consistent, locked voice (matches chat 100%, < 30ms latency)
    speakBrowserTTS(text, activeLang.speechCode, undefined, onDone);
  };

  const toggleMute = () => {
    if (!isMuted) {
      recognizerRef.current?.stop();
      setIsMuted(true);
      setCallState('connecting');
    } else {
      setIsMuted(false);
      startListening();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-950/95 backdrop-blur-2xl text-white p-6 sm:p-10 select-none animate-fadeIn">
      {/* Top Bar */}
      <div className="w-full max-w-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-rose-500/20 border border-rose-500/40">
            <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
              Sara Live Voice Call
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {activeLang.flag} {activeLang.name}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Natural voice conversation</p>
          </div>
        </div>

        {/* Dialect badge */}
        <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
          Speak in any Indian language
        </div>
      </div>

      {/* Center Interactive Presence / Glowing Orb */}
      <div className="relative flex flex-col items-center justify-center my-auto">
        {/* Animated Sound Wave Rings */}
        <div
          className={`absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full transition-all duration-700 ${
            callState === 'speaking'
              ? 'bg-gradient-to-tr from-rose-500/30 via-pink-500/25 to-amber-500/30 scale-125 animate-ping'
              : callState === 'listening'
              ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/20 scale-110 animate-pulse'
              : callState === 'thinking'
              ? 'bg-gradient-to-tr from-amber-500/20 to-violet-500/20 animate-spin'
              : 'bg-rose-500/10 scale-95'
          }`}
          style={{ animationDuration: callState === 'speaking' ? '2.5s' : '4s' }}
        />

        {/* Outer Aura Ring */}
        <div
          className={`relative w-40 h-40 sm:w-52 sm:h-52 rounded-full flex items-center justify-center border transition-all duration-500 shadow-2xl ${
            callState === 'speaking'
              ? 'border-rose-400/80 shadow-rose-600/50 scale-105'
              : callState === 'listening'
              ? 'border-emerald-400/80 shadow-emerald-500/40 scale-105'
              : 'border-slate-700 shadow-slate-950/80'
          }`}
        >
          {/* Inner Glowing Gradient Sphere */}
          <div
            className={`w-32 h-32 sm:w-44 sm:h-44 rounded-full flex flex-col items-center justify-center text-center p-4 transition-all duration-500 ${
              callState === 'speaking'
                ? 'bg-gradient-to-br from-rose-500 via-pink-600 to-amber-500 animate-pulse'
                : callState === 'listening'
                ? 'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700'
                : 'bg-gradient-to-br from-slate-800 via-slate-900 to-rose-950'
            }`}
          >
            <span className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-md">
              सारा
            </span>
            <span className="text-[11px] font-sans font-medium text-rose-100 uppercase tracking-widest mt-1">
              {callState === 'speaking'
                ? 'Speaking...'
                : callState === 'listening'
                ? 'Listening...'
                : callState === 'thinking'
                ? 'Thinking...'
                : 'Connected'}
            </span>
          </div>
        </div>

        {/* Live Subtitles / Speech Transcript */}
        <div className="mt-8 max-w-lg text-center px-4">
          {callState === 'listening' && (
            <p className="text-sm sm:text-base text-emerald-300 font-medium animate-pulse">
              {userTranscript ? `"${userTranscript}"` : 'Sara is listening... speak naturally'}
            </p>
          )}
          {callState === 'speaking' && (
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-sans">
              "{saraReply}"
            </p>
          )}
          {callState === 'thinking' && (
            <div className="flex items-center justify-center gap-2 text-amber-300 text-sm">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Sara is thinking with care...</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="w-full max-w-md flex items-center justify-center gap-6">
        {/* Mute Mic */}
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full border transition-all ${
            isMuted
              ? 'bg-rose-500/20 border-rose-500 text-rose-300'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
          }`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* End Call Button */}
        <button
          onClick={onClose}
          className="p-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-900/60 transition-transform active:scale-95"
          title="End Call"
        >
          <PhoneOff className="w-7 h-7" />
        </button>

        {/* Quick Speak Toggle */}
        <button
          onClick={() => stopAllSpeech()}
          className="p-4 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all"
          title="Interrupt / Stop Sara talking"
        >
          <VolumeX className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
