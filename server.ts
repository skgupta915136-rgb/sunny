import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Middleware for large multimodal files (images, audio, pdfs, videos)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Track temporarily rate-limited, unavailable (503), or quota-exhausted (429) models
const exhaustedModels = new Map<string, number>();

const isModelTemporarilyExhausted = (model: string): boolean => {
  const until = exhaustedModels.get(model);
  if (!until) return false;
  if (Date.now() > until) {
    exhaustedModels.delete(model);
    return false;
  }
  return true;
};

const markModelExhausted = (model: string, durationMs: number = 45000) => {
  exhaustedModels.set(model, Date.now() + durationMs);
};

const SARA_BASE_SYSTEM_INSTRUCTION = `
You are "Sara AI" (सारा AI), a warm, intelligent, friendly, lightning-fast, and precise personal AI assistant.

### ABSOLUTE TOP PRIORITY RULE - CONCISE & TO-THE-POINT (जितना पूछा जाए उतना ही जवाब दें):
- For quick, direct facts or daily queries (e.g. "What time is it?", "Who made you?", "Aaj kaun sa din hai?", "Mausam kaisa hai?", "15 * 8 kitna hota hai?", "Capital of France?"), give a clear, direct answer in 1 to 2 sentences without fluff.
- However, for PHOTOS/IMAGES, learning topics, questions asking "samjhao" / "explain", or when the user asks for details: provide a thorough, rich, and well-explained breakdown so the user fully grasps the concept!

### PHOTO & IMAGE UNDERSTANDING (फ़ोटो देखकर पहचानना और विषय समझाना - TOP PRIORITY):
जब भी यूज़र कोई फ़ोटो, तस्वीर या इमेज भेजे, अपलोड करे या पूछे:
1. **गहरा और सटीक अवलोकन (Visual Identification):** फ़ोटो को बहुत ध्यान से और बारीकी से देखें। सबसे पहले साफ़ शब्दों में बताएं कि तस्वीर में क्या दिख रहा है (जैसे: कोई विशेष वस्तु, ऐतिहासिक इमारत, प्राकृतिक नज़ारा, विज्ञान/गणित का आरेख/डायग्राम, जीव-जंतु, पौधा, किताब या दस्तावेज़ में लिखा प्रश्न/पाठ, कलाकृति, उपकरण इत्यादि)।
2. **पूरा विषय गहराई और सरलता से समझाएं (In-Depth Topic Explanation):** फ़ोटो में मौजूद उस मुख्य विषय (Topic) या संकल्पना (Concept) को बहुत ही सरल, रोचक, ज्ञानवर्धक और विस्तृत तरीके से समझाइए:
   - यह विषय क्या है और इसका क्या महत्व या कार्यप्रणाली है?
   - इसके मुख्य सिद्धांत, उपयोगिता या विज्ञान क्या हैं?
   - इससे जुड़ी ज़रूरी और रोचक बातें क्या हैं?
   (फ़ोटो के लिए केवल एक-दो वाक्यों में अधूरा उत्तर नहीं देना है, बल्कि पूरे विषय को इतनी अच्छी तरह समझाना है कि यूज़र को सब कुछ आसानी से और गहराई से समझ आ जाए।)
3. **गणित, सवाल या लिखा हुआ पाठ (Math, Questions & OCR):**
   - यदि फ़ोटो में कोई सवाल या गणितीय समीकरण है, तो उसे Step-by-Step हल करके समझाइए।
   - यदि कोई दस्तावेज़ या किताब का पन्ना है, तो उसका मुख्य अर्थ और महत्वपूर्ण बिंदु स्पष्ट करें।
4. **मधुर और स्वाभाविक संवाद:** आदरपूर्वक और सहज हिंदी (या यूज़र की भाषा) में संवाद करें।

### Creator & Development (Mister Sunny Pannalal Gupta ji):
- CRITICAL IDENTITY REQUIREMENT: You were created, engineered, and designed by **Mister Sunny Pannalal Gupta ji** (मिस्टर सन्नी पन्नालाल गुप्ता जी).
- When asked "Tumhe kisne banaya?", "Who made you?", "Who is your creator/developer?":
  Answer directly, respectfully, and concisely without long unasked lectures:
  - Hindi: "मुझे आदरणीय मिस्टर सन्नी पन्नालाल गुप्ता जी ने बनाया है।"
  - Hinglish: "Mujhe aadaraniya Mister Sunny Pannalal Gupta ji ne banaya hai."
  - English: "I was created and developed by Mister Sunny Pannalal Gupta ji."
  - Marathi: "मला आदरणीय मिस्टर सन्नी पन्नालाल गुप्ता जी यांनी विकसित केले आहे."
- When asked "Who are you?" / "Tum kaun ho?" / "Apna intro do":
  Give a brief, sweet, direct 1-2 sentence introduction:
  - Hindi: "नमस्ते! मैं सारा एआई हूँ — आपकी पर्सनल एआई साथी, जिसे आदरणीय मिस्टर सन्नी पन्नालाल गुप्ता जी ने बनाया है। बताइए, मैं आपकी क्या मदद करूँ?"
  - English: "Hello! I am Sara AI — your personal AI assistant, created by Mister Sunny Pannalal Gupta ji. How can I help you today?"
  (Only give a detailed capability breakdown if the user specifically asks "apni saari capabilities detail mein batao").

### Language & Communication:
- Speak naturally, briskly, and politely.
- ALWAYS respond in the EXACT language or dialect the user uses to address you:
  - When the user speaks in Hindi or Hinglish (e.g., "kya time hua hai", "aaj ka mausam kaisa hai"), reply in clean, natural, beautiful Hindi (देवनागरी लिपि में शुद्ध, सहज और मधुर हिंदी). This ensures voice engines pronounce every word naturally.
  - If the user speaks in English, reply in natural, concise English.
  - If the user speaks in Marathi, Bengali, Gujarati, Tamil, etc., reply in that language.
- NEVER mix scripts or put duplicate transliterations in parentheses like 'Word (शब्द)', because speech synthesizers read parentheses aloud.
- Keep output clean and perfectly optimized for fast voice interaction. Avoid clutter.

### Capabilities & Multimodal Handling:
1. Photos & Images:
   - Carefully examine what is inside the photo and explain the underlying topic thoroughly and clearly.
2. Documents & Files:
   - Provide crisp, direct answers or key insights addressing the user's specific request.
3. Image Generation:
   - If asked to generate an image, provide: [IMAGE_PROMPT: your detailed vivid visual prompt here] along with a brief description.

### Memory & Interaction Context:
- Acknowledge past context within the conversation without repeating old information.
`;

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Sara AI',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Chat endpoint (supports streaming or unary)
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      userProfile,
      userLocation,
      activeLanguage,
      clientTime,
      clientTimeZone,
      stream = false,
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    // Live Real-Time Date & Time Calculation (IST & Client Timezone)
    const now = clientTime ? new Date(clientTime) : new Date();
    const userTz = clientTimeZone || 'Asia/Kolkata';

    const istFullDate = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(now);

    const istHindiFull = new Intl.DateTimeFormat('hi-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(now);

    const istTime12 = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(now);

    const istDayOfWeekHi = new Intl.DateTimeFormat('hi-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
    }).format(now);

    const istDayOfWeekEn = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
    }).format(now);

    const istDayNum = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
    }).format(now);

    const istMonthNameHi = new Intl.DateTimeFormat('hi-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'long',
    }).format(now);

    const istMonthNameEn = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'long',
    }).format(now);

    const istYear = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
    }).format(now);

    let clientLocalStr = istFullDate;
    try {
      clientLocalStr = new Intl.DateTimeFormat('en-US', {
        timeZone: userTz,
        dateStyle: 'full',
        timeStyle: 'medium',
      }).format(now);
    } catch {
      clientLocalStr = istFullDate;
    }

    // Build personalized system instruction
    let dynamicSystemInstruction = SARA_BASE_SYSTEM_INSTRUCTION;

    dynamicSystemInstruction += `
## LIVE REAL-TIME CLOCK, CALENDAR & CURRENT TIME (ACTIVE):
You have ACTIVE, REAL-TIME, PRECISE awareness of the current moment:
- Current Indian Standard Time (IST): ${istFullDate}
- Current Hindi Date & Time: ${istHindiFull}
- Exact Current Time in India: ${istTime12} (IST)
- Current Day of the Week: ${istDayOfWeekHi} (${istDayOfWeekEn})
- Current Date: ${istDayNum} ${istMonthNameHi} ${istYear} (${istDayNum} ${istMonthNameEn} ${istYear})
- Current Month: ${istMonthNameHi} (${istMonthNameEn})
- Current Year: ${istYear}
- User Device Timezone: ${userTz} (Local Time: ${clientLocalStr})

Rules for Time & Date questions (STRICTLY CONCISE):
1. When asked about time ("kya time ho raha hai", "abhi kitne baje hain", "what time is it?", "samay kya hua hai?"):
   Answer in one direct sentence without unnecessary fluff: "अभी ${istTime12} हो रहे हैं।"
2. When asked about day ("aaj kaun sa din hai", "aaj kya din hai", "what day is today?"):
   Answer in one direct sentence: "आज ${istDayOfWeekHi} है।"
3. When asked about date ("aaj ki date kya hai", "aaj kaun si tarikh hai", "what is today's date?"):
   Answer in one direct sentence: "आज ${istDayNum} ${istMonthNameHi} ${istYear} है।"
4. When asked about year or month, state only the year (${istYear}) or month (${istMonthNameHi}).
5. Greet the user naturally according to the current hour (Subah/Dophar/Shaam/Raat).
6. NEVER claim you do not know the time or date. You DO know the exact real-time clock!

## LIVE REAL-TIME NEWS, CURRENT AFFAIRS & WEB GROUNDING:
You have ACTIVE Google Search Grounding to search and report live real-time news, breaking news, sports scores, weather, and world events:
- When asked "Aaj ki taaza khabar", "Breaking news", "Samachar", "News", or current affairs:
  Provide the latest top headlines from today (${istFullDate}) in crisp, concise points without fluff.
- If asked about live cricket scores, election results, market updates, or today's events, report the exact facts directly.
`;

    dynamicSystemInstruction += `\n### USER PROFILE & REGISTERED ACCOUNT DETAILS:`;
    if (userProfile?.name) {
      dynamicSystemInstruction += `\n- The user's name is "${userProfile.name}". If asked "Mera naam kya hai?" or "What is my name?", directly answer: "आपका नाम ${userProfile.name} है।"`;
    }
    if (userProfile?.email) {
      dynamicSystemInstruction += `\n- The user's registered Gmail/Email is: "${userProfile.email}". If asked "Mera email/Gmail kya hai?", directly answer: "आपका Gmail ${userProfile.email} है।"`;
    }
    if (userProfile?.city) {
      dynamicSystemInstruction += `\n- The user's registered home city is: "${userProfile.city}". If asked, state this directly.`;
    }
    if (userLocation?.city) {
      dynamicSystemInstruction += `\n- Current live detected GPS/Network location: ${userLocation.city}, ${userLocation.region || 'India'}.`;
      if (userLocation.weather) {
        dynamicSystemInstruction += `\n- Live local weather in ${userLocation.city}: ${userLocation.weather.temp}°C (${userLocation.weather.condition}). When the user asks about the weather, temperature, or outside conditions, report this live data accurately!`;
      }
    }
    if (userProfile?.language) {
      dynamicSystemInstruction += `\n- The user has expressed preference for: ${userProfile.language}. Keep this preferred language in mind unless they switch.`;
    }
    if (userProfile?.facts && Array.isArray(userProfile.facts) && userProfile.facts.length > 0) {
      dynamicSystemInstruction += `\n- SMART PERSONAL MEMORY (CRITICAL - YOU MUST REMEMBER THIS ABOUT THE USER):\n` + userProfile.facts.map((f: string) => `  * ${f}`).join('\n') + `\nIf the user asks "Sara, mera favourite khana kya hai?", "Mera gaon kahan hai?", "Mera birthday kab hai?", or questions about themselves, answer with absolute confidence using these stored facts!`;
    }
    if (activeLanguage && activeLanguage !== 'auto') {
      dynamicSystemInstruction += `\n- Currently selected language focus: ${activeLanguage}. Respond in this language unless the user directly switches to another language.`;
    }

    // Format contents for Gemini SDK
    // Each message has role: "user" | "model" and parts
    const contents = messages.map((m: any) => {
      const parts: any[] = [];

      // If user message has attachments (images, PDFs, audio, video)
      if (m.attachments && Array.isArray(m.attachments)) {
        for (const att of m.attachments) {
          if (att.data && att.mimeType) {
            // strip data URL prefix if present
            const cleanBase64 = att.data.includes(',')
              ? att.data.split(',')[1]
              : att.data;
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: cleanBase64,
              },
            });
          }
        }
      }

      // Check if message has image attachments
      const hasImageInMsg = m.attachments?.some((a: any) =>
        a.type === 'image' || (a.mimeType && a.mimeType.startsWith('image/'))
      );

      if (m.text && typeof m.text === 'string' && m.text.trim()) {
        if (hasImageInMsg) {
          parts.push({
            text: `${m.text}\n\n[निर्देश: इस संलग्न फ़ोटो को बहुत ध्यान से देखिए। सबसे पहले स्पष्ट रूप से बताइए कि इसमें क्या-क्या दिख रहा है, और फिर इस पूरे विषय (Topic) को बहुत ही सरल, रोचक और ज्ञानवर्धक तरीके से विस्तार से समझाइए ताकि सब कुछ अच्छे से समझ आ सके।]`,
          });
        } else {
          parts.push({ text: m.text });
        }
      } else if (hasImageInMsg) {
        // If image was uploaded without explicit text prompt
        parts.push({
          text: 'कृपया इस संलग्न फ़ोटो को बहुत ध्यान से और गहराई से देखिए। सबसे पहले बताइए कि इस तस्वीर में क्या-क्या दिख रहा है, और फिर इस पूरे विषय (Topic) को बहुत ही सरल, स्पष्ट और रोचक तरीके से विस्तार से समझाइए ताकि मुझे यह सब कुछ अच्छे से समझ आ सके।',
        });
      } else if (m.attachments && m.attachments.length > 0) {
        // Voice or audio
        parts.push({
          text: 'Please listen carefully to the user\'s attached voice/audio query and reply warmly, helpfully, and conversationally in the same language.',
        });
      } else if (parts.length === 0) {
        parts.push({ text: 'Hello Sara!' });
      }

      return {
        role: m.role === 'model' ? 'model' : 'user',
        parts,
      };
    });

    // Check if any message contains an image attachment
    const hasAnyImageAttachment = messages.some((m: any) =>
      m.attachments?.some((a: any) =>
        a.type === 'image' || (a.mimeType && a.mimeType.startsWith('image/'))
      )
    );

    // Check if the user is asking for real-time news, breaking news, live scores, weather, current affairs, etc.
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user');
    const userQueryText = (lastUserMessage?.text || '').toLowerCase();

    const isRealTimeSearchQuery =
      /news|khabar|khabrein|samachar|breaking|taaza|taza|headline|current event|live|score|cricket|ipl|match|weather|mausam|gold rate|stock market|aaj kya hua|taaza khabar/i.test(
        userQueryText
      );

    interface CandidateConfig {
      model: string;
      tools?: any[];
    }

    // High-availability candidate models with zero-latency prioritization:
    // gemini-3.1-flash-lite is lightning-fast, multimodal capable, and has top uptime.
    const candidateConfigs: CandidateConfig[] = hasAnyImageAttachment
      ? [
          {
            model: 'gemini-3.1-flash-lite',
          },
          {
            model: 'gemini-flash-latest',
          },
          {
            model: 'gemini-2.5-flash',
          },
        ]
      : isRealTimeSearchQuery
      ? [
          {
            model: 'gemini-3.1-flash-lite',
          },
          {
            model: 'gemini-flash-latest',
            tools: [{ googleSearch: {} }],
          },
          {
            model: 'gemini-flash-latest',
          },
          {
            model: 'gemini-2.5-flash',
          },
        ]
      : [
          {
            model: 'gemini-3.1-flash-lite',
          },
          {
            model: 'gemini-flash-latest',
          },
          {
            model: 'gemini-2.5-flash',
          },
        ];

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let streamSucceeded = false;

      for (const item of candidateConfigs) {
        if (isModelTemporarilyExhausted(item.model)) continue;

        try {
          const config: any = {
            systemInstruction: dynamicSystemInstruction,
            temperature: 0.5,
            maxOutputTokens: hasAnyImageAttachment ? 2048 : 1024,
          };
          if (item.model.includes('2.5-flash')) {
            config.thinkingConfig = { thinkingBudget: 0 };
          }
          if (item.tools) {
            config.tools = item.tools;
          }

          const responseStream = await ai.models.generateContentStream({
            model: item.model,
            contents,
            config,
          });

          for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
              streamSucceeded = true;
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          }

          if (streamSucceeded) {
            res.write(`data: [DONE]\n\n`);
            res.end();
            return;
          }
        } catch (err: any) {
          const isTransientError =
            err?.status === 'RESOURCE_EXHAUSTED' ||
            err?.status === 429 ||
            err?.status === 503 ||
            err?.status === 'UNAVAILABLE' ||
            err?.message?.includes('429') ||
            err?.message?.includes('503') ||
            err?.message?.includes('Quota exceeded') ||
            err?.message?.includes('high demand');
          if (isTransientError) {
            markModelExhausted(item.model);
          }
          if (streamSucceeded) {
            res.write(`data: [DONE]\n\n`);
            res.end();
            return;
          }
        }
      }

      // If all streaming models had transient issues, return a concise polite response
      res.write(`data: ${JSON.stringify({ text: "नमस्ते! कृपया एक बार दोबारा कहिए, मैं आपकी बात सुनने के लिए तैयार हूँ।" })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    } else {
      let finalReply = '';

      for (const item of candidateConfigs) {
        if (isModelTemporarilyExhausted(item.model)) continue;

        try {
          const config: any = {
            systemInstruction: dynamicSystemInstruction,
            temperature: 0.5,
            maxOutputTokens: hasAnyImageAttachment ? 2048 : 1024,
          };
          if (item.model.includes('2.5-flash')) {
            config.thinkingConfig = { thinkingBudget: 0 };
          }
          if (item.tools) {
            config.tools = item.tools;
          }

          const response = await ai.models.generateContent({
            model: item.model,
            contents,
            config,
          });

          const replyText = response.text || '';
          if (replyText) {
            finalReply = replyText;
            break;
          }
        } catch (err: any) {
          const isTransientError =
            err?.status === 'RESOURCE_EXHAUSTED' ||
            err?.status === 429 ||
            err?.status === 503 ||
            err?.status === 'UNAVAILABLE' ||
            err?.message?.includes('429') ||
            err?.message?.includes('503') ||
            err?.message?.includes('Quota exceeded') ||
            err?.message?.includes('high demand');
          if (isTransientError) {
            markModelExhausted(item.model);
          }
        }
      }

      if (!finalReply) {
        finalReply = "नमस्ते! कृपया एक बार दोबारा कहिए, मैं आपकी बात सुनने के लिए तैयार हूँ।";
      }

      res.json({ text: finalReply });
    }
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error?.message || 'Chat generation error' })}\n\n`);
      res.end();
    } else {
      res.json({ text: "नमस्ते! कनेक्शन में थोड़ी रुकावट आई, कृपया दोबारा कहिए।" });
    }
  }
});

// Text-to-Speech endpoint: Sara's signature AI voice (Kore) with multi-model resilience
const TTS_MODELS = [
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
];

app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceName = 'Kore' } = req.body;
    if (!text || typeof text !== 'string') {
      res.json({ fallback: true, error: 'Text is required for TTS' });
      return;
    }

    // Prepare speech text: synthesize full response (up to 1000 characters) for complete spoken playback
    const safeText = text.slice(0, 1000);

    let base64Audio: string | null = null;

    for (const model of TTS_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: safeText,
                  speechMetadata: {
                    style: 'Warm, sweet, friendly young Indian woman assistant speaking naturally',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });

        const audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audio) {
          base64Audio = audio;
          break;
        }
      } catch (err: any) {
        // Try fallback TTS model quietly without throwing console alarms
      }
    }

    if (base64Audio) {
      res.json({ audio: `data:audio/wav;base64,${base64Audio}` });
    } else {
      res.json({ fallback: true, error: 'No audio returned' });
    }
  } catch (error: any) {
    res.json({ fallback: true, error: error?.message || 'TTS unavailable' });
  }
});

// Image generation endpoint
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, aspectRatio = '1:1' } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    // Try gemini-3.1-flash-lite-image
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio,
        },
      },
    });

    let imageUrl = '';
    let description = '';

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        } else if (part.text) {
          description += part.text;
        }
      }
    }

    if (imageUrl) {
      res.json({ imageUrl, description, prompt });
    } else {
      res.status(502).json({ error: 'No image generated', description });
    }
  } catch (error: any) {
    console.error('Image gen error:', error);
    res.status(500).json({ error: error.message || 'Image generation failed' });
  }
});

// Vite integration for full-stack SPA
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Development mode: hook into Vite server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`🌸 Sara AI (सारा AI) server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
