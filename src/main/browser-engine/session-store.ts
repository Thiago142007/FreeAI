import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ProviderSessionMeta {
  provider: string;
  isAuthenticated: boolean;
  lastUsed: number;
}

export class SessionStore {
  private configDir: string;
  private metaFile: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.config', 'freeai');
    this.metaFile = path.join(this.configDir, 'sessions.json');
    this.ensureDirs();
  }

  private ensureDirs() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    if (!fs.existsSync(this.metaFile)) {
      fs.writeFileSync(
        this.metaFile,
        JSON.stringify(
          {
            deepseek: { provider: 'deepseek', isAuthenticated: false, lastUsed: 0 },
            gemini: { provider: 'gemini', isAuthenticated: false, lastUsed: 0 },
            chatgpt: { provider: 'chatgpt', isAuthenticated: false, lastUsed: 0 },
          },
          null,
          2
        ),
        'utf-8'
      );
    }
  }

  public getSessionMeta(provider: string): ProviderSessionMeta {
    try {
      const data = JSON.parse(fs.readFileSync(this.metaFile, 'utf-8'));
      return data[provider] || { provider, isAuthenticated: false, lastUsed: 0 };
    } catch {
      return { provider, isAuthenticated: false, lastUsed: 0 };
    }
  }

  public setSessionMeta(provider: string, meta: Partial<ProviderSessionMeta>) {
    try {
      const data = JSON.parse(fs.readFileSync(this.metaFile, 'utf-8'));
      data[provider] = { ...data[provider], ...meta, lastUsed: Date.now() };
      fs.writeFileSync(this.metaFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  public getPartition(provider: string): string {
    return `persist:freeai_${provider}`;
  }
}
