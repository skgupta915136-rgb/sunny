import React from 'react';
import { AssistantState } from '../types';
import { Mic, Volume2, Sparkles, Radio } from 'lucide-react';

interface SpinningAICircleProps {
  state: AssistantState;
  onCircleClick: () => void;
  languageText?: string;
  volumeLevel?: number;
}

export const SpinningAICircle: React.FC<SpinningAICircleProps> = ({
  state,
  onCircleClick,
  languageText = 'Hinglish / Regional',
  volumeLevel = 0,
}) => {
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-6">
      {/* Outer Atmospheric Aura Glow */}
      <div
        className={`absolute rounded-full transition-all duration-1000 pointer-events-none ${
          isSpeaking
            ? 'w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] bg-gradient-to-tr from-rose-500/25 via-pink-500/20 to-amber-500/25 blur-3xl animate-pulse'
            : isListening
            ? 'w-[300px] h-[300px] sm:w-[380px] sm:h-[380px] bg-gradient-to-r from-emerald-500/25 via-teal-500/20 to-cyan-500/25 blur-3xl animate-pulse'
            : isThinking
            ? 'w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] bg-gradient-to-br from-amber-500/20 via-rose-500/20 to-violet-500/20 blur-3xl animate-spin-fast'
            : 'w-[260px] h-[260px] sm:w-[340px] sm:h-[340px] bg-gradient-to-tr from-rose-500/15 via-amber-500/10 to-pink-500/15 blur-2xl'
        }`}
      />

      {/* Main Spinning Circle Container (Interactive) */}
      <div
        onClick={onCircleClick}
        className="relative cursor-pointer group flex items-center justify-center transition-transform active:scale-95 duration-200"
        title="Tap to speak or listen"
      >
        {/* Layer 1: Outermost Orbit Ring (Spinning Clockwise) */}
        <div
          className={`absolute rounded-full border border-dashed transition-all duration-700 pointer-events-none ${
            isSpeaking
              ? 'w-72 h-72 sm:w-[352px] sm:h-[352px] border-rose-400/50 animate-spin-fast'
              : isListening
              ? 'w-[272px] h-[272px] sm:w-[336px] sm:h-[336px] border-emerald-400/60 animate-spin-slow'
              : isThinking
              ? 'w-[272px] h-[272px] sm:w-[336px] sm:h-[336px] border-amber-400/70 animate-spin-fast'
              : 'w-64 h-64 sm:w-80 sm:h-80 border-rose-500/30 animate-spin-slow group-hover:border-rose-400/50'
          }`}
        >
          {/* Orbital Satellite Dots */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-rose-400 shadow-lg shadow-rose-500/80" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-md" />
          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-pink-400 shadow-md" />
        </div>

        {/* Layer 2: Intermediate Radiant Gradient Ring (Spinning Counter-Clockwise) */}
        <div
          className={`absolute rounded-full transition-all duration-700 pointer-events-none p-[2px] ${
            isSpeaking
              ? 'w-56 h-56 sm:w-[280px] sm:h-[280px] bg-gradient-to-r from-rose-500 via-amber-400 to-pink-500 animate-spin-reverse-fast opacity-90'
              : isListening
              ? 'w-52 h-52 sm:w-[264px] sm:h-[264px] bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 animate-spin-reverse opacity-90'
              : isThinking
              ? 'w-52 h-52 sm:w-[264px] sm:h-[264px] bg-gradient-to-r from-amber-400 via-violet-500 to-rose-400 animate-spin-reverse-fast opacity-90'
              : 'w-[200px] h-[200px] sm:w-64 sm:h-64 bg-gradient-to-r from-rose-500/60 via-amber-500/40 to-pink-500/60 animate-spin-reverse opacity-70 group-hover:opacity-100'
          }`}
        >
          <div className="w-full h-full rounded-full bg-slate-950/80 backdrop-blur-sm" />
        </div>

        {/* Layer 3: Third Segmented Ring (Spinning Clockwise) */}
        <div
          className={`absolute rounded-full border-2 border-t-rose-400 border-r-transparent border-b-amber-400 border-l-transparent transition-all pointer-events-none ${
            isSpeaking
              ? 'w-44 h-44 sm:w-56 sm:h-56 animate-spin-fast'
              : isListening
              ? 'w-42 h-42 sm:w-52 sm:h-52 animate-spin-slow border-t-emerald-400 border-b-cyan-400'
              : isThinking
              ? 'w-42 h-42 sm:w-52 sm:h-52 animate-spin-fast border-t-amber-400 border-b-violet-400'
              : 'w-40 h-40 sm:w-50 sm:h-50 animate-spin-slow'
          }`}
        />

        {/* Layer 4: Central Glowing Rotating AI Orb / Sphere */}
        <div
          className={`relative w-36 h-36 sm:w-44 sm:h-44 rounded-full flex flex-col items-center justify-center text-center shadow-2xl transition-all duration-500 ${
            isSpeaking
              ? 'shadow-rose-500/50 scale-105'
              : isListening
              ? 'shadow-emerald-500/50 scale-105'
              : isThinking
              ? 'shadow-amber-500/40 scale-[1.02]'
              : 'shadow-rose-950/80 group-hover:scale-[1.03]'
          }`}
        >
          {/* Spinning Gradient Conic Fill inside the Sphere */}
          <div
            className={`absolute inset-0 rounded-full transition-all duration-500 ${
              isSpeaking
                ? 'bg-gradient-to-tr from-rose-600 via-pink-500 to-amber-500 animate-spin-slow'
                : isListening
                ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 animate-spin-slow'
                : isThinking
                ? 'bg-gradient-to-tr from-amber-600 via-rose-500 to-violet-600 animate-spin-fast'
                : 'bg-gradient-to-tr from-rose-600/90 via-pink-600/90 to-amber-600/90 animate-spin-slow'
            }`}
          />

          {/* Frosted Glass Core with Dynamic Glow */}
          <div className="absolute inset-1 rounded-full bg-slate-950/70 backdrop-blur-md flex flex-col items-center justify-center p-3 border border-white/20">
            {/* Ambient Waveform or Sara Typography */}
            {isSpeaking ? (
              <div className="flex items-center gap-1 my-auto">
                <div className="w-1 bg-white rounded-full animate-voice-wave" style={{ animationDelay: '0s' }} />
                <div className="w-1 bg-white rounded-full animate-voice-wave" style={{ animationDelay: '0.2s' }} />
                <div className="w-1.5 bg-rose-200 rounded-full animate-voice-wave" style={{ animationDelay: '0.4s' }} />
                <div className="w-1 bg-white rounded-full animate-voice-wave" style={{ animationDelay: '0.1s' }} />
                <div className="w-1 bg-white rounded-full animate-voice-wave" style={{ animationDelay: '0.3s' }} />
              </div>
            ) : isListening ? (
              <div className="flex flex-col items-center my-auto">
                {volumeLevel > 5 ? (
                  <div className="flex items-center gap-1 my-1 h-7">
                    <div
                      className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                      style={{ height: `${Math.max(6, Math.min(26, (volumeLevel / 100) * 26))}px` }}
                    />
                    <div
                      className="w-1.5 bg-emerald-200 rounded-full transition-all duration-75"
                      style={{ height: `${Math.max(8, Math.min(28, (volumeLevel / 100) * 32))}px` }}
                    />
                    <div
                      className="w-1 bg-emerald-300 rounded-full transition-all duration-75"
                      style={{ height: `${Math.max(6, Math.min(24, (volumeLevel / 100) * 24))}px` }}
                    />
                  </div>
                ) : (
                  <Mic className="w-7 h-7 text-emerald-300 mb-1 animate-pulse" />
                )}
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-300">
                  {volumeLevel > 5 ? 'Hearing you...' : 'Listening...'}
                </span>
              </div>
            ) : isThinking ? (
              <div className="flex flex-col items-center my-auto">
                <Sparkles className="w-7 h-7 text-amber-300 animate-spin mb-1" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300">
                  Thinking
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center my-auto">
                <span className="font-serif text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white via-rose-100 to-amber-200 drop-shadow">
                  सारा
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-widest text-rose-300/90 mt-0.5">
                  Sara AI
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Circle Status & Tap Cue */}
      <div className="mt-20 sm:mt-24 text-center px-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow-lg transform translate-y-2 sm:translate-y-3 backdrop-blur-md">
          <span
            className={`w-2 h-2 rounded-full ${
              isSpeaking
                ? 'bg-rose-400 animate-ping'
                : isListening
                ? 'bg-emerald-400 animate-ping'
                : isThinking
                ? 'bg-amber-400 animate-pulse'
                : 'bg-rose-500 animate-pulse'
            }`}
          />
          <span className="font-medium">
            {isSpeaking
              ? 'Sara is speaking... (Tap circle to stop)'
              : isListening
              ? 'Listening to you... (Tap circle to finish)'
              : isThinking
              ? 'Sara is thinking...'
              : 'Tap circle to speak to Sara'}
          </span>
        </div>
      </div>
    </div>
  );
};
