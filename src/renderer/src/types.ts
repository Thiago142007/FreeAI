// AI Provider types
export type AIProvider =
  | 'deepseek'
  | 'gemini'
  | 'chatgpt'
  | 'kimi'
  | 'glm'
  | 'arena'
  | 'qwen'
  | 'meta'
  | 'dola'
  | 'useai';
export type AgentMode = 'agent' | 'planning' | 'fast';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'auth-required';

export interface ProviderModelOption {
  id: string;
  label: string;
}

export interface ProviderCapabilityOption {
  id: string;
  label: string;
  experimental?: boolean;
}

// Message types
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  thinking?: ThinkingBlock;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

export interface ThinkingBlock {
  content: string;
  durationMs: number;
  isExpanded?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  displayName: string;
  status: 'running' | 'completed' | 'failed';
  input: string;
  output?: string;
  durationMs?: number;
}

// ask_user: a IA pergunta e o usuário responde num wizard inline
export interface AskUserQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface AskUserAnswer {
  question: string;
  answer: string;
}

// Project types
export interface Project {
  id: string;
  name: string;
  folderPath: string;
  createdAt: string;
}

export interface ProviderBusyInfo {
  conversationId: string;
  modelId?: string;
}

// Conversation types
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  provider: AIProvider;
  mode: AgentMode;
  cwd: string;
  projectId?: string | null;
  filePath?: string | null;
  totalMessages: number;
  windowStart: number;
  preview?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Sidebar view types
export type SidebarView = 'conversations' | 'explorer' | 'scheduled' | 'skills' | 'settings';

// Artifact type
export interface Artifact {
  id: string;
  title: string;
  content: string;
  type: 'markdown' | 'code' | 'diagram';
  createdAt: Date;
}

// Slash command
export interface SlashCommand {
  name: string;
  description: string;
  icon: string;
}

// Provider info for the UI
export interface ProviderInfo {
  id: AIProvider;
  name: string;
  models: string[];
  status: ConnectionStatus;
  icon: string;
  color: string;
  modelOptions?: ProviderModelOption[];
  capabilities?: ProviderCapabilityOption[];
}
