export type MessageTokens = {
  input: number;
  output: number;
  reasoning: number;
  cache?: {
    read: number;
    write: number;
  };
};

export type MessageUsage = {
  tokens: MessageTokens;
  cost?: number;
  providerId?: string;
  modelId?: string;
  contextPercent?: number | null;
};

export type MessageAttachment = {
  id: string;
  url: string;
  mime: string;
  filename: string;
};

export type MessageDiffEntry = {
  file: string;
  diff: string;
  before?: string;
  after?: string;
};

export type MessageStatus = 'streaming' | 'complete' | 'error';

export type Message = {
  id: string;
  parentId?: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  status: MessageStatus;

  agent?: string;
  model?: string;
  providerId?: string;
  modelId?: string;
  variant?: string;

  time?: number;
  usage?: MessageUsage;
  attachments?: MessageAttachment[];
  diffs?: MessageDiffEntry[];
  error?: { name: string; message: string } | null;
  classification?: 'real_user' | 'system_injection' | 'unknown';
};


