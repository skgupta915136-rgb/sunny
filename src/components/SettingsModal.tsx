import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  MapPin,
  Globe,
  Clock,
  Trash2,
  Download,
  Copy,
  Check,
  X,
  Search,
  MessageSquare,
  Bot,
  Save,
  Sparkles,
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
  Lock,
  Play,
  Square,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { UserProfile, ChatHistoryRecord } from '../types';
import { SUPPORTED_LANGUAGES } from '../services/languages';
import {
  getSaraVoiceConfig,
  saveSaraVoiceConfig,
  getAvailableSaraVoices,
  ensureVoicesLoaded,
  testSaraVoice,
  stopAllSpeech,
  SaraVoiceConfig,
} from '../services/speech';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
  chatHistory: ChatHistoryRecord[];
  onClearHistory: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onSaveProfile,
  chatHistory,
  onClearHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'voice' | 'history' | 'speech'>('profile');
  const [isSpeechCopied, setIsSpeechCopied] = useState(false);

  // Profile Form State
  const [name, setName] = useState(userProfile.name || '');
  const [email, setEmail] = useState(userProfile.email || '');
  const [city, setCity] = useState(userProfile.city || '');
  const [language, setLanguage] = useState(userProfile.language || 'Hindi');
  const [isSaved, setIsSaved] = useState(false);

  // Voice Settings State
  const [voiceConfig, setVoiceConfig] = useState<SaraVoiceConfig>(() => getSaraVoiceConfig());
  const [availableVoices, setAvailableVoices] = useState<ReturnType<typeof getAvailableSaraVoices>>([]);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  // Chat History Filter & State
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      ensureVoicesLoaded().then(() => {
        setAvailableVoices(getAvailableSaraVoices());
        setVoiceConfig(getSaraVoiceConfig());
      });
    } else {
      stopAllSpeech();
      setIsTestingVoice(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      ...userProfile,
      name: name.trim() || 'User',
      email: email.trim(),
      city: city.trim(),
      language,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleVoiceChange = (voiceURI: string) => {
    const matched = availableVoices.find((v) => v.voice.voiceURI === voiceURI);
    const updated = saveSaraVoiceConfig({
      voiceURI,
      voiceName: matched ? matched.voice.name : '',
      isLocked: true,
    });
    setVoiceConfig(updated);
    setVoiceNotice('आवाज़ सुरक्षित और लॉक हो गई!');
    setTimeout(() => setVoiceNotice(null), 2500);
  };

  const handleToggleVoiceLock = () => {
    const updated = saveSaraVoiceConfig({
      isLocked: !voiceConfig.isLocked,
    });
    setVoiceConfig(updated);
    setVoiceNotice(updated.isLocked ? 'आवाज़ लॉक कर दी गई (कभी नहीं बदलेगी)' : 'आवाज़ अनलॉक है');
    setTimeout(() => setVoiceNotice(null), 2500);
  };

  const handleRateChange = (newRate: number) => {
    const updated = saveSaraVoiceConfig({ rate: newRate });
    setVoiceConfig(updated);
  };

  const handlePitchChange = (newPitch: number) => {
    const updated = saveSaraVoiceConfig({ pitch: newPitch });
    setVoiceConfig(updated);
  };

  const handleTestVoice = () => {
    if (isTestingVoice) {
      stopAllSpeech();
      setIsTestingVoice(false);
      return;
    }

    setIsTestingVoice(true);
    const phrase = name
      ? `नमस्ते ${name} जी! मैं सारा हूँ, आपकी पर्सनल AI असिस्टेंट। मेरी यह आवाज़ अब हमेशा एक जैसी और स्थिर रहेगी।`
      : 'नमस्ते! मैं सारा हूँ, आपकी पर्सनल AI असिस्टेंट। मेरी यह आवाज़ अब हमेशा एक जैसी और स्थिर रहेगी।';

    testSaraVoice(
      phrase,
      () => setIsTestingVoice(true),
      () => setIsTestingVoice(false)
    );
  };

  const handleResetDefaultVoice = () => {
    const recommended = availableVoices.find((v) => v.isRecommended);
    const updated = saveSaraVoiceConfig({
      voiceURI: recommended ? recommended.voice.voiceURI : '',
      voiceName: recommended ? recommended.voice.name : '',
      rate: 1.08,
      pitch: 1.1,
      isLocked: true,
    });
    setVoiceConfig(updated);
    setVoiceNotice('डिफ़ॉल्ट सारा आवाज़ बहाल कर दी गई');
    setTimeout(() => setVoiceNotice(null), 2500);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportHistory = () => {
    if (chatHistory.length === 0) return;
    const exportText = chatHistory
      .map(
        (m) =>
          `[${new Date(m.timestamp).toLocaleString()}] ${
            m.role === 'user' ? (name || 'User') : 'Sara AI'
          }:\n${m.text}\n`
      )
      .join('\n---\n\n');

    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sara_AI_Chat_History_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredHistory = chatHistory.filter((item) =>
    item.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="px-5 sm:px-7 py-4.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden ring-2 ring-rose-500/30 bg-slate-950 shrink-0 shadow-md">
              <img
                src="/src/assets/images/sara_ai_logo_1791460473992.jpg"
                alt="Sara AI Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>सेटिंग्स और प्रोफ़ाइल</span>
                <span className="text-xs font-normal text-rose-300">Sara AI</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                नाम, Gmail, स्थिर आवाज़ और चैट हिस्ट्री
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="बंद करें"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 sm:px-7 gap-2 pt-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'profile'
                ? 'border-rose-500 text-rose-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>नाम और Gmail (Profile)</span>
          </button>

          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'voice'
                ? 'border-rose-500 text-rose-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>सारा की आवाज़ (Voice)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'history'
                ? 'border-rose-500 text-rose-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>चैट हिस्ट्री (History)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {chatHistory.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('speech')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'speech'
                ? 'border-rose-500 text-rose-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>भाषण व परिचय (Speech)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-medium">
              स्टेज
            </span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {activeTab === 'profile' ? (
            /* Profile & Gmail Tab */
            <form onSubmit={handleSave} className="space-y-5">
              {/* Name Field */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <User className="w-4 h-4 text-rose-400" />
                  <span>आपका नाम (Your Full Name)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="उदा. Sunny Gupta / आपका नाम दर्ज करें"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/40 text-sm"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  AI आपको इसी नाम से आदरपूर्वक संबोधित करेगा।
                </p>
              </div>

              {/* Gmail / Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-rose-400" />
                  <span>आपका Gmail / Email</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="उदा. name@example.com"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/60 focus:ring-1 focus:ring-rose-500/40 text-sm font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  आपका Gmail आपके प्रोफ़ाइल में सुरक्षित रहेगा।
                </p>
              </div>

              {/* City / Location (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-400" />
                  <span>आपका शहर / पता (City)</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="उदा. Kalyan, Mumbai, Delhi, Lucknow"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/60 text-sm"
                />
              </div>

              {/* Preferred Language */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-rose-400" />
                  <span>पसंदीदा भाषा (Preferred Language)</span>
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-rose-500/60 text-sm"
                >
                  <option value="Hindi">हिंदी (Hindi)</option>
                  <option value="English">English</option>
                  <option value="Hinglish">Hinglish (हिंग्लिश)</option>
                  <option value="Marathi">मराठी (Marathi)</option>
                  <option value="Gujarati">ગુજરાતી (Gujarati)</option>
                  <option value="Bengali">বাংলা (Bengali)</option>
                </select>
              </div>

              {/* Active Profile Status Preview */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center font-bold text-rose-300">
                  {name ? name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white truncate">
                      {name || 'No Name Set'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      सक्रिय प्रोफ़ाइल
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 truncate block font-mono">
                    {email || 'Gmail नहीं जोड़ा गया'}
                  </span>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold text-sm shadow-lg shadow-rose-950/40 transition-all active:scale-[0.98]"
                >
                  {isSaved ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>सेव हो गया! (Saved)</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>जानकारी सुरक्षित करें (Save Profile)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : activeTab === 'voice' ? (
            /* Voice Tab */
            <div className="space-y-6">
              {/* Notice Banner */}
              {voiceNotice && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{voiceNotice}</span>
                </div>
              )}

              {/* Status & Intro Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-white">
                      स्थिर सारा आवाज़ (Voice Identity)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <Lock className="w-3 h-3" />
                      <span>{voiceConfig.isLocked ? 'आवाज़ लॉक है' : 'अनलॉक'}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    सारा की आवाज़ को एक जैसा बनाए रखने के लिए लॉक किया गया है। हिंदी, हिंग्लिश या अंग्रेज़ी शब्दों के दौरान भी आवाज़ कभी नहीं बदलेगी।
                  </p>
                </div>

                {/* Voice Lock Toggle */}
                <button
                  type="button"
                  onClick={handleToggleVoiceLock}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 flex items-center gap-2 ${
                    voiceConfig.isLocked
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="आवाज़ लॉक को टॉगल करें"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{voiceConfig.isLocked ? 'आवाज़ लॉक रखें (On)' : 'आवाज़ लॉक करें'}</span>
                </button>
              </div>

              {/* Active Voice Selection */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-rose-400" />
                    <span>सारा के लिए आवाज़ चुनें (Select Voice)</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {availableVoices.length} आवाज़ें उपलब्ध
                  </span>
                </label>

                <div className="relative">
                  <select
                    value={voiceConfig.voiceURI}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-rose-500/60 text-xs sm:text-sm appearance-none cursor-pointer"
                  >
                    {availableVoices.length === 0 && (
                      <option value="">डिफ़ॉल्ट सारा आवाज़ (ब्राउज़र लोडिंग...)</option>
                    )}
                    {availableVoices.map(({ voice, isRecommended, label }) => (
                      <option key={voice.voiceURI || voice.name} value={voice.voiceURI}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500">
                  ⭐ चिन्ह वाली आवाज़ें (जैसे Google हिन्दी, Swara, Lekha) सारा के लिए सबसे मीठी और उपयुक्त हैं।
                </p>
              </div>

              {/* Test Voice Control Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-200">
                      आवाज़ का टेस्ट लें (Preview Voice)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      क्लिक करके सुनें कि सारा बातचीत में कैसी आवाज़ में बोलेगी
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestVoice}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md active:scale-95 ${
                      isTestingVoice
                        ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                        : 'bg-rose-500 hover:bg-rose-600 text-white'
                    }`}
                  >
                    {isTestingVoice ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>रोकें (Stop)</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>🔊 आवाज़ सुनें (Test)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Speed & Pitch Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Speech Rate */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      बोलने की रफ़्तार (Speed)
                    </span>
                    <span className="text-xs font-mono text-rose-400 font-bold">
                      {voiceConfig.rate.toFixed(2)}x
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleRateChange(1.0)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        voiceConfig.rate === 1.0
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      सामान्य (1.0x)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRateChange(1.08)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        voiceConfig.rate === 1.08
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      तेज़ (1.08x)
                    </button>
                  </div>
                </div>

                {/* Pitch */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      आवाज़ का सुर (Pitch / Tone)
                    </span>
                    <span className="text-xs font-mono text-rose-400 font-bold">
                      {voiceConfig.pitch.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handlePitchChange(1.0)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        voiceConfig.pitch === 1.0
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      प्राकृतिक (1.0)
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePitchChange(1.1)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        voiceConfig.pitch === 1.1
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      मधुर (1.10)
                    </button>
                  </div>
                </div>
              </div>

              {/* Reset to Recommended Voice Button */}
              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={handleResetDefaultVoice}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-300 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>डिफ़ॉल्ट सारा आवाज़ बहाल करें (Reset to Default)</span>
                </button>
              </div>
            </div>
          ) : activeTab === 'history' ? (
            /* Chat History Tab */
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="चैट में खोजें (Search in chat)..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleExportHistory}
                    disabled={chatHistory.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs disabled:opacity-40 transition-colors"
                    title="चैट हिस्ट्री डाउनलोड करें"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>डाउनलोड</span>
                  </button>

                  <button
                    onClick={() => setShowClearConfirm(true)}
                    disabled={chatHistory.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-900/50 text-xs disabled:opacity-40 transition-colors"
                    title="पूरी चैट हिस्ट्री साफ़ करें"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>इतिहास साफ़ करें</span>
                  </button>
                </div>
              </div>

              {/* Clear Confirmation Prompt */}
              {showClearConfirm && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs flex items-center justify-between gap-3 animate-fadeIn">
                  <span className="text-rose-200">
                    क्या आप वाकई पूरी चैट हिस्ट्री हटाना चाहते हैं?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onClearHistory();
                        setShowClearConfirm(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700"
                    >
                      हाँ, साफ़ करें
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      रद्द करें
                    </button>
                  </div>
                </div>
              )}

              {/* Chat items list */}
              {filteredHistory.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center text-slate-500">
                  <MessageSquare className="w-12 h-12 stroke-1 mb-3 text-slate-600" />
                  <p className="text-sm font-medium text-slate-400">
                    {searchQuery ? 'कोई परिणाम नहीं मिला' : 'अभी तक कोई चैट हिस्ट्री नहीं है'}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {searchQuery
                      ? 'कृपया कोई अन्य शब्द खोजें'
                      : 'माइक पर बोलकर या टाइप करके बातचीत शुरू करें'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredHistory.map((item) => {
                    const isUser = item.role === 'user';
                    const isCopied = copiedId === item.id;
                    const dateStr = new Date(item.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isUser
                            ? 'bg-slate-950/70 border-slate-800/80'
                            : 'bg-rose-500/5 border-rose-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            {isUser ? (
                              <span className="font-semibold text-sky-400 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {name || 'You'}
                              </span>
                            ) : (
                              <span className="font-semibold text-rose-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                Sara AI
                              </span>
                            )}
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-500 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {dateStr}
                            </span>
                          </div>

                          <button
                            onClick={() => handleCopyMessage(item.id, item.text)}
                            className="p-1 rounded text-slate-500 hover:text-white transition-colors"
                            title="कॉपी करें"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
                          {item.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Speech & Presentation Tab */
            <div className="space-y-6 animate-fadeIn select-text">
              {/* Header with Quick Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-transparent border border-amber-500/30">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-amber-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>स्टेज भाषण व परिचय (Speech Script)</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    निर्माता: <strong className="text-rose-300">मिस्टर सन्नी पन्नालाल गुप्ता जी</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const text = `🌸 सारा AI (Sara AI) - प्रेजेंटेशन भाषण और परिचय
निर्माता व डेवलपर: आदरणीय मिस्टर सन्नी पन्नालाल गुप्ता जी

1. शुरुआत:
"नमस्कार देवियों और सज्जनों / सभी दोस्तों को मेरा प्रणाम!
आज मैं आप सभी के सामने एक बेहद खास और क्रांतिकारी प्रोजेक्ट पेश करने जा रहा हूँ, जिसे मैंने खुद बड़े समर्पण और लगन से तैयार किया है। मुझे आप सभी को 'सारा AI' (Sara AI) — एक नेक्स्ट-जेनरेशन वॉइस और मल्टीमॉडल पर्सनल AI असिस्टेंट से मिलवाते हुए बहुत गर्व महसूस हो रहा है!"

2. सारा AI क्या है?
"सारा AI कोई साधारण चैटबॉट नहीं है, बल्कि यह एक इंसानी अंदाज़ में बातचीत करने वाली, बेहद समझदार और बहुभाषी डिजिटल साथी है। इसे खास तौर पर भारतीय क्षेत्रीय भाषाओं, स्वाभाविक आवाज़ और हमारी रोज़मर्रा की ज़रूरतों के लिए तैयार किया गया है।"

3. प्रमुख क्षमताएँ:
- लाइव आवाज़ में बातचीत: 16+ भारतीय भाषाओं (हिंदी, हिंग्लिश, मराठी, गुजराती, बंगाली आदि) में बिना रुके सुनना व जवाब देना।
- आँखों से देखना व समझना: मोबाइल कैमरे या गैलरी की फ़ोटो, नोट्स, सवाल (OCR) और वस्तुओं को देखकर गहराई से समझाना।
- पर्सनल मेमोरी: यूज़र का नाम, Gmail व शहर याद रखना।
- लाइव समय व मौसम: हर सेकंड का लाइव भारतीय समय (IST) व शहर का मौसम।
- चैट हिस्ट्री व शेयरिंग: WhatsApp/SMS पर एक क्लिक में शेयर व हिस्ट्री सहेजना।

4. समापन:
"इस पूरे प्रोजेक्ट को मैंने — सन्नी पन्नालाल गुप्ता ने — पूरी तरह से डिज़ाइन और डेवलप किया है। आप सभी का बहुत-बहुत धन्यवाद!"`;
                      navigator.clipboard.writeText(text);
                      setIsSpeechCopied(true);
                      setTimeout(() => setIsSpeechCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition-colors"
                  >
                    {isSpeechCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">कॉपी हो गया</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>भाषण कॉपी करें</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const text = `🌸 सारा AI (Sara AI) - प्रेजेंटेशन भाषण और परिचय
निर्माता व डेवलपर: आदरणीय मिस्टर सन्नी पन्नालाल गुप्ता जी

---
[1. दमदार शुरुआत]
"नमस्कार देवियों और सज्जनों / सभी दोस्तों और आदरणीय अतिथियों को मेरा प्रणाम!
आज मैं आप सभी के सामने एक बेहद खास और क्रांतिकारी प्रोजेक्ट पेश करने जा रहा हूँ, जिसे मैंने खुद बड़े समर्पण, लगन और आधुनिक आर्टिफिशियल इंटेलिजेंस की मदद से तैयार किया है।
मुझे आप सभी को 'सारा AI' (Sara AI) — एक नेक्स्ट-जेनरेशन वॉइस और मल्टीमॉडल पर्सनल AI असिस्टेंट से मिलवाते हुए बहुत गर्व महसूस हो रहा है!"

---
[2. सारा AI क्या है?]
"सारा AI कोई साधारण चैटबॉट या रोबोट नहीं है, बल्कि यह एक इंसानी अंदाज़ में बातचीत करने वाली, बेहद समझदार और बहुभाषी डिजिटल साथी है।
अक्सर हम देखते हैं कि विदेशी AI टूल्स भारत की क्षेत्रीय भाषाओं, हमारे बोलने के लहजे और हमारी रोज़मर्रा की ज़रूरतों को सही से नहीं समझ पाते। इसी ज़रूरत को पूरा करने के लिए मैंने सारा AI को खास तौर पर भारतीय भाषाओं, सरल संवाद और रियल-टाइम वॉइस इंटरेक्शन के लिए तैयार किया है।"

---
[3. प्रमुख क्षमताएँ]
1. रियल-टाइम वॉइस इंटरेक्शन: 16+ भारतीय भाषाओं में स्वाभाविक बातचीत।
2. मल्टीमॉडल कैमरा व विज़न: लाइव फ़ोटो व गैलरी से किताबों के नोट्स, गणित के सवाल (OCR) और वस्तुओं का विस्तार से विश्लेषण।
3. पर्सनल स्मार्ट मेमोरी: यूज़र का नाम, Gmail और शहर याद रखकर व्यक्तिगत सलाह।
4. लाइव भारतीय समय व मौसम: हर सेकंड का सटीक IST समय और शहर का मौसम।
5. चैट हिस्ट्री और WhatsApp शेयर: एक क्लिक में चैट सेव, कॉपी और शेयर।
6. कस्टमाइज़ेबल वॉइस लॉक: हमेशा एक जैसी मधुर और स्थिर भारतीय आवाज़।

---
[4. समापन]
"इस पूरे प्रोजेक्ट को मैंने — सन्नी पन्नालाल गुप्ता ने — पूरी तरह से डिज़ाइन, प्रोग्राम और विकसित किया है।
आप सभी का बहुत-बहुत धन्यवाद! आइए, अब हम मिलकर सारा AI का एक लाइव डेमो देखते हैं!"
`;
                      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Sara_AI_Presentation_Speech_${name || 'Sunny_Gupta'}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs text-slate-950 font-semibold transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>डाउनलोड (.txt)</span>
                  </button>
                </div>
              </div>

              {/* Script Sections */}
              <div className="space-y-4">
                {/* Section 1 */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1.5">
                    1. दमदार शुरुआत (Opening)
                  </div>
                  <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-sans">
                    "नमस्कार देवियों और सज्जनों / सभी दोस्तों को मेरा प्रणाम! आज मैं आप सभी के सामने एक बेहद खास और क्रांतिकारी प्रोजेक्ट पेश करने जा रहा हूँ, जिसे मैंने खुद बड़े समर्पण और लगन से तैयार किया है। मुझे आप सभी को <strong>'सारा AI' (Sara AI) — एक नेक्स्ट-जेनरेशन वॉइस और मल्टीमॉडल पर्सनल AI असिस्टेंट</strong> से मिलवाते हुए बहुत गर्व महसूस हो रहा है!"
                  </p>
                </div>

                {/* Section 2 */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1.5">
                    2. सारा AI क्या है? (What is Sara AI?)
                  </div>
                  <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-sans">
                    "सारा AI कोई साधारण चैटबॉट नहीं है, बल्कि यह एक इंसानी अंदाज़ में बातचीत करने वाली, बेहद समझदार और बहुभाषी डिजिटल साथी है। अक्सर विदेशी AI टूल्स भारत की क्षेत्रीय भाषाओं और लहजे को नहीं समझ पाते। इसी ज़रूरत को पूरा करने के लिए मैंने सारा AI को खास तौर पर <strong>भारतीय भाषाओं, स्वाभाविक आवाज़ और हमारी रोज़मर्रा की ज़रूरतों</strong> के लिए तैयार किया है।"
                  </p>
                </div>

                {/* Section 3 */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1.5">
                    3. सारा AI की महाशक्तियाँ (Key Powers)
                  </div>
                  <ul className="text-xs sm:text-sm text-slate-200 space-y-2 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>लाइव आवाज़ में स्वाभाविक बातचीत:</strong> माइक दबाकर किसी भी भाषा (हिंदी, हिंग्लिश, मराठी, गुजराती, अंग्रेज़ी आदि) में बोलें — सारा पूरी बात सुनकर तुरंत मीठी आवाज़ में जवाब देती है।</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>आँखों से देखना और समझना (Multimodal Vision):</strong> कैमरे या गैलरी से किसी भी फ़ोटो, नोट्स, गणित के सवाल या वस्तु को देखकर पूरा विषय विस्तार से समझाती है।</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>पर्सनल स्मार्ट मेमोरी:</strong> यूज़र का नाम, Gmail और शहर याद रखती है और व्यक्तिगत स्तर पर मदद करती है।</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>लाइव समय व लोकल मौसम:</strong> हर सेकंड का लाइव भारतीय समय (IST) और शहर का मौसम जानती है।</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span><strong>चैट हिस्ट्री व WhatsApp शेयर:</strong> बातचीत को सेव रखना, सर्च करना और WhatsApp पर भेजना।</span>
                    </li>
                  </ul>
                </div>

                {/* Section 4 */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1.5">
                    4. समापन भाषण (Closing)
                  </div>
                  <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-sans">
                    "संक्षेप में कहें तो, सारा AI आपका सच्चा डिजिटल साथी है। इस पूरे प्रोजेक्ट को मैंने — <strong>सन्नी पन्नालाल गुप्ता</strong> ने — पूरी तरह से डिज़ाइन और डेवलप किया है। आप सभी का बहुत-बहुत धन्यवाद! आइए, अब हम मिलकर सारा AI का एक लाइव डेमो देखते हैं!"
                  </p>
                </div>

                {/* Demo Helper Box */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs">
                  <span className="font-bold flex items-center gap-1.5 mb-1 text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    लाइव डेमो के लिए पहला सवाल:
                  </span>
                  "सारा, नमस्ते! अपना परिचय दो और बताओ तुम्हें किसने बनाया है?"
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
