import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface StoredProject {
  id: string;
  name: string;
  folderPath: string;
  createdAt: string;
}

export interface ConversationMeta {
  id: string;
  title: string;
  provider: string;
  mode: string;
  cwd: string;
  projectId: string | null;
  filePath: string | null;
  createdAt: string;
  updatedAt: string;
  totalMessages: number;
  preview: string;
}

function storageRoot(): string {
  const root = path.join(app.getPath('userData'), 'storage');
  const convDir = path.join(root, 'conversations');
  if (!fs.existsSync(convDir)) fs.mkdirSync(convDir, { recursive: true });
  return root;
}

function projectsFile(): string {
  return path.join(storageRoot(), 'projects.json');
}

function conversationFile(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error('Invalid conversation id');
  }
  return path.join(storageRoot(), 'conversations', `${id}.json`);
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

export function listProjects(): StoredProject[] {
  return readJson<StoredProject[]>(projectsFile(), []);
}

export function createProject(name: string, folderPath: string): StoredProject {
  const project: StoredProject = {
    id: uuidv4(),
    name,
    folderPath,
    createdAt: new Date().toISOString()
  };
  const projects = listProjects();
  projects.push(project);
  writeJson(projectsFile(), projects);
  return project;
}

export function deleteProject(id: string): void {
  const projects = listProjects().filter((p) => p.id !== id);
  writeJson(projectsFile(), projects);
}

const META_FIELDS = [
  'id',
  'title',
  'provider',
  'mode',
  'cwd',
  'projectId',
  'filePath',
  'createdAt',
  'updatedAt'
] as const;

export function saveConversation(conv: any): void {
  const existing = loadConversation(conv.id);
  const clean: Record<string, unknown> = { messages: existing?.messages ?? [] };
  for (const key of META_FIELDS) {
    if (conv[key] !== undefined) clean[key] = conv[key];
  }
  writeJson(conversationFile(conv.id), clean);
}

export function upsertMessage(conversationId: string, message: any): void {
  const conv = loadConversation(conversationId) ?? { id: conversationId, messages: [] };
  const messages: any[] = Array.isArray(conv.messages) ? conv.messages : [];
  const idx = messages.findIndex((m) => m.id === message.id);
  const serialized = JSON.parse(JSON.stringify(message));
  if (idx >= 0) messages[idx] = serialized;
  else messages.push(serialized);
  conv.messages = messages;
  conv.updatedAt = new Date().toISOString();
  writeJson(conversationFile(conversationId), conv);
}

export function deleteConversation(id: string): void {
  try {
    fs.unlinkSync(conversationFile(id));
  } catch {
    // já não existia
  }
}

function loadConversation(id: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(conversationFile(id), 'utf8'));
  } catch {
    return null;
  }
}

function reviveMessage(msg: any): any {
  return { ...msg, timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date() };
}

export function listConversationMeta(): ConversationMeta[] {
  const dir = path.join(storageRoot(), 'conversations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const metas: ConversationMeta[] = [];
  for (const file of files) {
    const conv = loadConversation(file.slice(0, -'.json'.length));
    if (!conv || !conv.id) continue;
    const messages: any[] = Array.isArray(conv.messages) ? conv.messages : [];
    const last = messages[messages.length - 1];
    metas.push({
      id: conv.id,
      title: conv.title ?? 'Untitled Conversation',
      provider: conv.provider ?? 'deepseek',
      mode: conv.mode ?? 'agent',
      cwd: conv.cwd ?? '',
      projectId: conv.projectId ?? null,
      filePath: conv.filePath ?? null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      totalMessages: messages.length,
      preview: typeof last?.content === 'string' ? last.content : ''
    });
  }
  metas.sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
  return metas;
}

export function getMessageWindow(
  conversationId: string,
  start: number,
  count: number
): { messages: any[]; total: number } {
  const conv = loadConversation(conversationId);
  const messages: any[] = conv && Array.isArray(conv.messages) ? conv.messages : [];
  const safeStart = Math.max(0, Math.min(start, messages.length));
  const slice = messages.slice(safeStart, safeStart + count).map(reviveMessage);
  return { messages: slice, total: messages.length };
}
