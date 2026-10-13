import React, { useState } from 'react';
import { Boxes, Check, Search, ExternalLink, Terminal, Globe, Code, Shield } from 'lucide-react';

interface SkillItem {
  id: string;
  name: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  enabled: boolean;
  category: 'core' | 'browser' | 'tools' | 'mcp';
}

const AVAILABLE_SKILLS: SkillItem[] = [
  {
    id: 'skill-terminal',
    name: 'Linux Shell Executor',
    description: 'Execução de comandos bash nativos com captura de stdout/stderr e verificação de status',
    icon: Terminal,
    enabled: true,
    category: 'core'
  },
  {
    id: 'skill-browser39',
    name: 'Electron Hidden Browser',
    description: 'Sessões web ocultas em segundo plano para provedores configurados',
    icon: Globe,
    enabled: true,
    category: 'browser'
  },
  {
    id: 'skill-file-ops',
    name: 'Precision File Editing',
    description: 'Leitura, escrita e substituição cirúrgica com verificação de integridade de código',
    icon: Code,
    enabled: true,
    category: 'core'
  },
  {
    id: 'skill-local-tools',
    name: 'Local Tool Execution',
    description: 'Ferramentas locais de shell e arquivos executadas com as permissões do usuário, sem sandbox isolada',
    icon: Shield,
    enabled: true,
    category: 'tools'
  },
  {
    id: 'skill-mcp',
    name: 'ZeroScript MCP Protocol',
    description: 'Compatibilidade com servidores Model Context Protocol para estender ferramentas externas',
    icon: Boxes,
    enabled: true,
    category: 'mcp'
  }
];

export const SkillsView: React.FC = () => {
  const [skills, setSkills] = useState<SkillItem[]>(AVAILABLE_SKILLS);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const filteredSkills = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden animate-fade-in text-xs">
      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ag-text-muted" />
        <input
          type="text"
          placeholder="Buscar skills ou plugins..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-ag-bg border border-ag-border text-xs text-ag-text placeholder-ag-text-muted focus:outline-none focus:border-ag-accent transition-colors"
        />
      </div>

      {/* Skills list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredSkills.map((skill) => {
          const IconComp = skill.icon;
          return (
            <div
              key={skill.id}
              className={`p-3 rounded-lg bg-ag-bg-card border transition-all ${skill.enabled ? 'border-ag-border hover:border-ag-border-light' : 'border-ag-border/50 opacity-60'
                }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-ag-bg border border-ag-border text-ag-accent">
                    <IconComp className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-ag-text">{skill.name}</span>
                    <span className="block text-[10px] uppercase font-mono text-ag-text-muted">{skill.category}</span>
                  </div>
                </div>

                {/* Toggle switch */}
                <button
                  type="button"
                  onClick={() => toggleSkill(skill.id)}
                  className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center px-0.5 ${skill.enabled ? 'bg-ag-accent' : 'bg-ag-bg-active border border-ag-border'
                    }`}
                  title={skill.enabled ? 'Desativar Skill' : 'Ativar Skill'}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full transition-transform ${skill.enabled ? 'bg-ag-bg translate-x-3.5' : 'bg-white translate-x-0'
                      }`}
                  />
                </button>
              </div>

              <p className="text-[11px] text-ag-text-secondary leading-relaxed mt-1">
                {skill.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
