import { create } from 'zustand';
import {
  AIProvider,
  AgentMode,
  SidebarView,
  ConnectionStatus,
  ProviderBusyInfo,
  ProviderInfo
} from '../types';
import { STATIC_PROVIDERS, ALL_PROVIDER_IDS } from '../provider-meta';

export type { ProviderInfo };
export { STATIC_PROVIDERS };

export type AuxiliaryTab = 'artifacts' | 'subagents' | 'tasks' | 'terminal' | 'browser';

const initialStatus = Object.fromEntries(
  ALL_PROVIDER_IDS.map((p) => [p, 'disconnected'])
) as Record<AIProvider, ConnectionStatus>;

interface SettingsState {
  provider: AIProvider;
  mode: AgentMode;
  sidebarView: SidebarView;
  sidebarOpen: boolean;
  auxiliaryPaneOpen: boolean;
  auxiliaryTab: AuxiliaryTab;
  providerStatus: Record<AIProvider, ConnectionStatus>;
  activeModels: Record<string, string>;
  activeCapabilities: Record<string, string | null>;
  limitedFeatures: Record<string, boolean>;
  webSearchEnabled: boolean;
  cwd: string;
  providers: ProviderInfo[];
  providerBusy: Record<string, ProviderBusyInfo | null>;

  setProvider: (provider: AIProvider) => void;
  setProviderBusy: (provider: string, info: ProviderBusyInfo | null) => void;
  setMode: (mode: AgentMode) => void;
  setSidebarView: (view: SidebarView) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAuxiliaryPaneOpen: (open: boolean) => void;
  toggleAuxiliaryPane: () => void;
  setAuxiliaryTab: (tab: AuxiliaryTab) => void;
  setProviderStatus: (provider: AIProvider, status: ConnectionStatus) => void;
  setActiveModel: (provider: AIProvider, modelId: string) => void;
  setActiveCapability: (provider: AIProvider, capabilityId: string | null) => void;
  markFeatureLimited: (provider: AIProvider, featureKey: string, limited?: boolean) => void;
  setWebSearchEnabled: (enabled: boolean) => void;
  toggleWebSearch: () => void;
  setCwd: (cwd: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  provider: 'deepseek',
  mode: 'agent',
  sidebarView: 'conversations',
  sidebarOpen: true,
  auxiliaryPaneOpen: false,
  auxiliaryTab: 'artifacts',
  providerStatus: initialStatus,
  activeModels: {},
  activeCapabilities: {},
  limitedFeatures: {},
  webSearchEnabled: false,
  cwd: window.freeai?.defaultCwd ?? '.',
  providers: STATIC_PROVIDERS,
  providerBusy: {},

  setProvider: (provider) => set({ provider }),
  setProviderBusy: (provider, info) =>
    set((state) => {
      const next = { ...state.providerBusy };
      if (info) next[provider] = info;
      else delete next[provider];
      return { providerBusy: next };
    }),
  setMode: (mode) => set({ mode }),
  setSidebarView: (sidebarView) => set({ sidebarView }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setAuxiliaryPaneOpen: (auxiliaryPaneOpen) => set({ auxiliaryPaneOpen }),
  toggleAuxiliaryPane: () =>
    set((state) => ({ auxiliaryPaneOpen: !state.auxiliaryPaneOpen })),
  setAuxiliaryTab: (auxiliaryTab) => set({ auxiliaryTab }),
  setProviderStatus: (provider, status) =>
    set((state) => ({
      providerStatus: {
        ...state.providerStatus,
        [provider]: status
      },
      providers: state.providers.map((p) =>
        p.id === provider ? { ...p, status } : p
      )
    })),
  setActiveModel: (provider, modelId) =>
    set((state) => ({ activeModels: { ...state.activeModels, [provider]: modelId } })),
  setActiveCapability: (provider, capabilityId) =>
    set((state) => ({ activeCapabilities: { ...state.activeCapabilities, [provider]: capabilityId } })),
  markFeatureLimited: (provider, featureKey, limited = true) =>
    set((state) => ({
      limitedFeatures: { ...state.limitedFeatures, [`${provider}:${featureKey}`]: limited }
    })),
  setWebSearchEnabled: (webSearchEnabled) => set({ webSearchEnabled }),
  toggleWebSearch: () =>
    set((state) => ({ webSearchEnabled: !state.webSearchEnabled })),
  setCwd: (cwd) => set({ cwd })
}));
