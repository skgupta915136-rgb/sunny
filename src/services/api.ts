import { Attachment, ChatMessage, UserProfile } from '../types';
import { UserLocationData } from './location';

export interface SendMessageOptions {
  messages: Array<{
    role: 'user' | 'model';
    text: string;
    attachments?: Array<{
      name: string;
      mimeType: string;
      data: string;
    }>;
  }>;
  userProfile?: UserProfile;
  userLocation?: UserLocationData;
  activeLanguage?: string;
  onChunk?: (partialText: string) => void;
}

export async function sendMessageToSara(options: SendMessageOptions): Promise<string> {
  const { messages, userProfile, userLocation, activeLanguage, onChunk } = options;

  const clientTime = new Date().toISOString();
  const clientTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  // Attempt streaming via SSE first
  if (onChunk) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          userProfile,
          userLocation,
          activeLanguage,
          clientTime,
          clientTimeZone,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          if (payload === '[DONE]') {
            if (fullText) return fullText;
            break;
          }

          try {
            const data = JSON.parse(payload);
            if (data.text) {
              fullText += data.text;
              onChunk(fullText);
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch (err) {
            // Ignore parse errors on partial chunks
          }
        }
      }

      if (fullText) return fullText;
    } catch (streamError) {
      console.warn('Streaming failed, falling back to unary fetch:', streamError);
    }
  }

  // Fallback to unary
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messages,
        userProfile,
        userLocation,
        activeLanguage,
        clientTime,
        clientTimeZone,
        stream: false,
      }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.text) return data.text;
    }
  } catch (unaryErr) {
    console.warn('Unary fetch error:', unaryErr);
  }

  return "Namaste! Main Sara AI hoon. Thoda connection slow tha, par main bilkul sun rahi hoon. Kripya dobara boliye!";
}

export async function requestSaraTTS(text: string, voiceName: string = 'Kore'): Promise<string | null> {
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceName }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.audio || null;
  } catch (err) {
    console.warn('Failed to call /api/tts:', err);
    return null;
  }
}

export async function generateImageWithSara(prompt: string, aspectRatio: string = '1:1'): Promise<{ imageUrl?: string; error?: string }> {
  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, aspectRatio }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      return { error: data.error || 'Failed to generate image' };
    }
    return { imageUrl: data.imageUrl };
  } catch (err: any) {
    return { error: err.message || 'Image request failed' };
  }
}

// Convert File to base64 Attachment
export function processFileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      let type: Attachment['type'] = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      resolve({
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        data: dataUrl,
        size: file.size,
        type,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Extract [IMAGE_PROMPT: ...] if present
export function extractImagePrompt(text: string): { cleanText: string; prompt: string | null } {
  const match = text.match(/\[IMAGE_PROMPT:\s*([^\]]+)\]/i);
  if (match) {
    const prompt = match[1].trim();
    const cleanText = text.replace(/\[IMAGE_PROMPT:\s*[^\]]+\]/i, '').trim();
    return { cleanText, prompt };
  }
  return { cleanText: text, prompt: null };
}
