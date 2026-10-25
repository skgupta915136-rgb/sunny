import React from 'react';
import { AssistantState } from '../types';
import { Sparkles, Mic, Volume2 } from 'lucide-react';

interface SaraAvatarProps {
  state?: AssistantState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
}

export const SaraAvatar: React.FC<SaraAvatarProps> = ({
  state = 'idle',
  size = 'md',
  showBadge = false,
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-28 h-28 text-3xl',
  };

  const ringSizes = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    xl: 'w-36 h-36',
  };

  return (
    <div className="relative inline-flex items-center justify-center select-none">
      {/* Dynamic Animated Glowing Backing */}
      {state === 'speaking' && (
        <div
          className={`absolute ${ringSizes[size]} rounded-full bg-gradient-to-tr from-rose-500/40 via-amber-500/40 to-pink-500/40 animate-ping opacity-75`}
        />
      )}
      {state === 'listening' && (
        <div
          className={`absolute ${ringSizes[size]} rounded-full border-2 border-rose-400/60 animate-pulse-glow`}
        />
      )}
      {state === 'thinking' && (
        <div
          className={`absolute ${ringSizes[size]} rounded-full bg-gradient-to-r from-amber-400/30 to-violet-500/30 animate-spin`}
          style={{ animationDuration: '4s' }}
        />
      )}

      {/* Main Avatar Bubble */}
      <div
        className={`${sizeClasses[size]} relative rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center text-white font-bold shadow-lg shadow-rose-950/50 border border-rose-300/30 transition-transform duration-300 ${
          state === 'speaking' ? 'scale-105' : 'hover:scale-102'
        }`}
      >
        <img
          src="/src/assets/images/sara_ai_logo_1791460473992.jpg"
          alt="Sara AI"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />

        {/* State Indicator Icon Overlay */}
        {state === 'speaking' && (
          <div className="absolute -bottom-1 -right-1 p-1 bg-rose-600 rounded-full border border-white/40 shadow-sm">
            <Volume2 className="w-3 h-3 text-white animate-bounce" />
          </div>
        )}
        {state === 'listening' && (
          <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full border border-white/40 shadow-sm animate-pulse">
            <Mic className="w-3 h-3 text-white" />
          </div>
        )}
        {state === 'thinking' && (
          <div className="absolute -top-1 -right-1 p-1 bg-amber-500 rounded-full border border-white/40 shadow-sm">
            <Sparkles className="w-3 h-3 text-white animate-spin" />
          </div>
        )}
      </div>

      {showBadge && (
        <div className="ml-3 flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-white tracking-wide text-sm md:text-base">
              Sara AI
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium">
              सारा
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                state === 'listening'
                  ? 'bg-emerald-400 animate-ping'
                  : state === 'speaking'
                  ? 'bg-rose-400 animate-pulse'
                  : state === 'thinking'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span>
              {state === 'listening'
                ? 'Listening to you...'
                : state === 'speaking'
                ? 'Speaking...'
                : state === 'thinking'
                ? 'Sara is thinking...'
                : 'Always here for you'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
