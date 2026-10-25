export type Role = 'user' | 'model';

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64 data URL
  size?: number;
  type: 'image' | 'video' | 'audio' | 'document';
}

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  attachments?: Attachment[];
  imagePrompt?: string;
  generatedImageUrl?: string;
  isStreaming?: boolean;
}

export interface UserProfile {
  id?: string;
  name: string;
  email?: string;
  city?: string;
  language: string;
  facts: string[];
}

export interface ChatHistoryRecord {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
}

export interface TaskItem {
  id: string;
  title: string;
  dueDate?: string;
  isCompleted: boolean;
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  speechCode: string;
  flag: string;
}

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';
