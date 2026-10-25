import { LanguageOption } from '../types';

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'auto', name: 'Auto Detect', nativeName: 'ऑटो डिटेक्ट', speechCode: 'hi-IN', flag: '✨' },
  { code: 'hinglish', name: 'Hinglish', nativeName: 'हिंग्लिश', speechCode: 'hi-IN', flag: '🇮🇳' },
  { code: 'hindi', name: 'Hindi', nativeName: 'हिंदी', speechCode: 'hi-IN', flag: '🇮🇳' },
  { code: 'english', name: 'English', nativeName: 'English (India)', speechCode: 'en-IN', flag: '🇮🇳' },
  { code: 'marathi', name: 'Marathi', nativeName: 'मराठी', speechCode: 'mr-IN', flag: '🇮🇳' },
  { code: 'bengali', name: 'Bengali', nativeName: 'বাংলা', speechCode: 'bn-IN', flag: '🇮🇳' },
  { code: 'tamil', name: 'Tamil', nativeName: 'தமிழ்', speechCode: 'ta-IN', flag: '🇮🇳' },
  { code: 'telugu', name: 'Telugu', nativeName: 'తెలుగు', speechCode: 'te-IN', flag: '🇮🇳' },
  { code: 'gujarati', name: 'Gujarati', nativeName: 'ગુજરાતી', speechCode: 'gu-IN', flag: '🇮🇳' },
  { code: 'punjabi', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', speechCode: 'pa-IN', flag: '🇮🇳' },
  { code: 'kannada', name: 'Kannada', nativeName: 'ಕನ್ನಡ', speechCode: 'kn-IN', flag: '🇮🇳' },
  { code: 'malayalam', name: 'Malayalam', nativeName: 'മലയാളം', speechCode: 'ml-IN', flag: '🇮🇳' },
  { code: 'urdu', name: 'Urdu', nativeName: 'اردو', speechCode: 'ur-IN', flag: '🇮🇳' },
  { code: 'bhojpuri', name: 'Bhojpuri', nativeName: 'भोजपुरी', speechCode: 'hi-IN', flag: '🇮🇳' },
  { code: 'odia', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', speechCode: 'or-IN', flag: '🇮🇳' },
  { code: 'assamese', name: 'Assamese', nativeName: 'অসমীয়া', speechCode: 'as-IN', flag: '🇮🇳' },
];

export interface StarterPrompt {
  id: string;
  category: 'chat' | 'image' | 'analysis' | 'regional';
  title: string;
  prompt: string;
  langTag: string;
  icon: string;
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: 'hinglish-greet',
    category: 'chat',
    title: 'Hinglish Chai & Chat',
    prompt: 'Sara, namaste! Aaj ka din kaisa chal raha hai? Kuch mazedaar baat batao.',
    langTag: 'Hinglish',
    icon: '☕',
  },
  {
    id: 'hindi-poem',
    category: 'regional',
    title: 'प्रेरणादायक कविता',
    prompt: 'सारा, मुझे जिंदगी और हौसले पर एक खूबसूरत प्रेरणादायक कविता सुनाओ।',
    langTag: 'हिंदी',
    icon: '✍️',
  },
  {
    id: 'marathi-travel',
    category: 'regional',
    title: 'महाराष्ट्रातील पर्यटन',
    prompt: 'सारा, महाराष्ट्रात पावसाळ्यात किंवा वीकेंडला फिरण्यासाठी टॉप 3 अप्रतिम ठिकाणं सांगा.',
    langTag: 'मराठी',
    icon: '🏞️',
  },
  {
    id: 'bengali-lit',
    category: 'regional',
    title: 'বাংলা সাহিত্য ও সংস্কৃতি',
    prompt: 'সারা, রবীন্দ্রনাথ ঠাকুরের সাহিত্যের মূল সুর এবং আনন্দের অর্থ সহজ ভাষায় বুঝিয়ে দাও।',
    langTag: 'বাংলা',
    icon: '📚',
  },
  {
    id: 'tamil-recipe',
    category: 'regional',
    title: 'தமிழ் பாரம்பரிய உணவு',
    prompt: 'சாரா, உண்மையான மதுரை ஸ்டைல் மல்லிகை பூ இட்லி மற்றும் தக்காளி சட்னி செய்முறை சொல்.',
    langTag: 'தமிழ்',
    icon: '🍲',
  },
  {
    id: 'image-diwali',
    category: 'image',
    title: 'Create Visual: Festive India',
    prompt: 'Sara, generate an image of a vibrant Indian evening courtyard illuminated with brass diyas, marigold garlands, rangoli, and warm fairy lights in cinematic 4k.',
    langTag: 'English',
    icon: '🎨',
  },
  {
    id: 'doc-summary',
    category: 'analysis',
    title: 'Analyze Photo / Document',
    prompt: 'Sara, please explain this uploaded photo in detail, transcribe any text you see, and give me key takeaways.',
    langTag: 'Multimodal',
    icon: '🔍',
  },
  {
    id: 'punjabi-warmth',
    category: 'regional',
    title: 'ਪੰਜਾਬੀ ਖੁਸ਼ਮਿਜ਼ਾਜ ਗੱਲਬਾਤ',
    prompt: 'ਸਾਰਾ ਜੀ, ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਅੱਜ ਮਨ ਬਹੁਤ ਖੁਸ਼ ਏ, ਕੋਈ ਵਧੀਆ ਜਿਹਾ ਪੰਜਾਬੀ ਟੋਟਕਾ ਜਾਂ ਸਲਾਹ ਦਿਓ!',
    langTag: 'ਪੰਜਾਬੀ',
    icon: '✨',
  },
];
