import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ProviderSessionMeta {
  provider: string;
  isAuthenticated: boolean;
  lastUsed: number;
}

// Lista completa de provedores suportados — mantida em sincronia com provider-configs.ts
// e BrowserManager.PROVIDER_URLS para que o sessions.json nunca esteja incompleto.
const ALL_PROVIDERS = [
  'deepseek',
  'gemini',
  'chatgpt',
  'kimi',
  'glm',
  'arena',
  'qwen',
  'qwen-net',
  'meta',
  'dola',
  'useai',
];

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

    // Cria o arquivo se não existir
    if (!fs.existsSync(this.metaFile)) {
      const defaults: Record<string, ProviderSessionMeta> = {};
      for (const p of ALL_PROVIDERS) {
        defaults[p] = { provider: p, isAuthenticated: false, lastUsed: 0 };
      }
      fs.writeFileSync(this.metaFile, JSON.stringify(defaults, null, 2), 'utf-8');
      return;
    }

    // Arquivo já existe: garante que novos provedores tenham entrada (migração)
    try {
      const data: Record<string, ProviderSessionMeta> = JSON.parse(
        fs.readFileSync(this.metaFile, 'utf-8')
      );
      let changed = false;
      for (const p of ALL_PROVIDERS) {
        if (!data[p]) {
          data[p] = { provider: p, isAuthenticated: false, lastUsed: 0 };
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(this.metaFile, JSON.stringify(data, null, 2), 'utf-8');
      }
    } catch {
      // Arquivo corrompido — recria do zero preservando os nomes
      const defaults: Record<string, ProviderSessionMeta> = {};
      for (const p of ALL_PROVIDERS) {
        defaults[p] = { provider: p, isAuthenticated: false, lastUsed: 0 };
      }
      fs.writeFileSync(this.metaFile, JSON.stringify(defaults, null, 2), 'utf-8');
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

  /**
   * Marca explicitamente a sessão como autenticada (true) ou desconectada (false).
   *
   * Importante: quando `authenticated` é false, SÓ grava se o estado atual no disco
   * também já for false — nunca apaga um login bem-sucedido por causa de um erro de
   * envio de mensagem. A sessão autenticada só é revogada por logout explícito ou
   * pela janela de login (openLoginWindow) que confirma a ausência de cookies.
   */
  public setSessionAuthenticated(provider: string, authenticated: boolean) {
    if (!authenticated) {
      // Não sobrescreve 'true' salvo com 'false' por erro de envio
      const current = this.getSessionMeta(provider);
      if (current.isAuthenticated) return;
    }
    this.setSessionMeta(provider, { isAuthenticated: authenticated });
  }

  public getPartition(provider: string): string {
    return `persist:freeai_${provider}`;
  }
}
