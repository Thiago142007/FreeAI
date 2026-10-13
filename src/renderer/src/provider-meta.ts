import { AIProvider, ProviderInfo } from '../types';

export const STATIC_PROVIDERS: ProviderInfo[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    status: 'disconnected',
    icon: 'Bot',
    color: '#3b82f6'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    status: 'disconnected',
    icon: 'Sparkles',
    color: '#10b981'
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT / OpenAI',
    models: ['gpt-4o', 'o1', 'o3-mini'],
    status: 'disconnected',
    icon: 'MessageSquare',
    color: '#f59e0b'
  },
  {
    id: 'kimi',
    name: 'Kimi',
    models: [],
    status: 'disconnected',
    icon: 'Zap',
    color: '#818cf8',
    modelOptions: [
      { id: 'instant', label: 'Instantané (chat rápido)' },
      { id: 'k2.6', label: 'K2.6' },
      { id: 'k3', label: 'K3' },
      { id: 'k3-swarm', label: 'K3 Swarm (agente)' }
    ],
    capabilities: [{ id: 'vision', label: 'Imagens (entrada)' }]
  },
  {
    id: 'glm',
    name: 'GLM (Z.ai)',
    models: [],
    status: 'disconnected',
    icon: 'Cpu',
    color: '#22d3ee',
    capabilities: [
      { id: 'vision', label: 'Imagens (entrada)' },
      { id: 'image_gen', label: 'Gerar imagem', experimental: true }
    ]
  },
  {
    id: 'arena',
    name: 'Arena AI',
    models: [],
    status: 'disconnected',
    icon: 'Swords',
    color: '#a3e635',
    modelOptions: [{ id: 'direct', label: 'Direct' }],
    capabilities: [
      { id: 'vision', label: 'Imagens (entrada)' },
      { id: 'web_search', label: 'Pesquisa Web', experimental: true },
      { id: 'image_gen', label: 'Gerar imagem', experimental: true }
    ]
  },
  {
    id: 'qwen',
    name: 'Qwen',
    models: [],
    status: 'disconnected',
    icon: 'Cloud',
    color: '#a78bfa',
    modelOptions: [
      { id: 'qwen3.7-plus', label: 'Qwen3.7-Plus' },
      { id: 'qwen3.7-max', label: 'Qwen3.7-Max' },
      { id: 'qwen3.8-max-preview', label: 'Qwen3.8-Max-Preview' }
    ],
    capabilities: [{ id: 'vision', label: 'Imagens (entrada)' }]
  },
  {
    id: 'meta',
    name: 'Meta AI',
    models: [],
    status: 'disconnected',
    icon: 'Infinity',
    color: '#60a5fa',
    modelOptions: [
      { id: 'instant', label: 'Instantané' },
      { id: 'reflexion', label: 'Réflexion (raciocínio)' }
    ],
    capabilities: [{ id: 'vision', label: 'Imagens (entrada)' }]
  },
  {
    id: 'dola',
    name: 'Dola AI',
    models: [],
    status: 'disconnected',
    icon: 'Flower2',
    color: '#f472b6',
    capabilities: [{ id: 'image_gen', label: 'Gerar imagem', experimental: true }]
  }
];

export const ALL_PROVIDER_IDS: AIProvider[] = STATIC_PROVIDERS.map((p) => p.id);

export function getProviderMeta(provider: AIProvider): ProviderInfo | undefined {
  return STATIC_PROVIDERS.find((p) => p.id === provider);
}
