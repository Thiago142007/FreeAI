import React, { useState } from 'react';
import { Clock, Play, Pause, Trash2, Plus, Calendar, CheckCircle2 } from 'lucide-react';

interface ScheduledTask {
  id: string;
  name: string;
  prompt: string;
  cron: string;
  active: boolean;
  lastRun?: string;
  nextRun: string;
}

const INITIAL_TASKS: ScheduledTask[] = [
  {
    id: 'task-1',
    name: 'Git Status & Pull Check',
    prompt: 'Verificar status do git e novidades nos repositórios remotos a cada manhã',
    cron: '0 9 * * 1-5',
    active: true,
    lastRun: 'Hoje às 09:00',
    nextRun: 'Amanhã às 09:00'
  },
  {
    id: 'task-2',
    name: 'Headless Session Keep-Alive',
    prompt: 'Enviar ping leve no chat.deepseek.com para manter cookies e tokens de sessão válidos',
    cron: '*/30 * * * *',
    active: true,
    lastRun: '15 min atrás',
    nextRun: 'Em 15 min'
  },
  {
    id: 'task-3',
    name: 'Backup dos Artefatos',
    prompt: 'Sincronizar arquivos gerados em ~/.config/freeai/backups',
    cron: '0 0 * * *',
    active: false,
    lastRun: 'Ontem às 00:00',
    nextRun: 'Pausado'
  }
];

export const ScheduledTasksView: React.FC = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>(INITIAL_TASKS);
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskCron, setNewTaskCron] = useState('0 9 * * *');
  const [newTaskPrompt, setNewTaskPrompt] = useState('');

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: !t.active, nextRun: !t.active ? 'Agendado' : 'Pausado' } : t))
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim() || !newTaskPrompt.trim()) return;

    const newTask: ScheduledTask = {
      id: `task-${Date.now()}`,
      name: newTaskName.trim(),
      prompt: newTaskPrompt.trim(),
      cron: newTaskCron.trim(),
      active: true,
      nextRun: 'Próximo ciclo'
    };

    setTasks((prev) => [newTask, ...prev]);
    setNewTaskName('');
    setNewTaskPrompt('');
    setIsAdding(false);
  };

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden animate-fade-in text-xs">
      {/* Header action */}
      <button
        onClick={() => setIsAdding(!isAdding)}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 mb-3 rounded-lg bg-ag-accent hover:bg-ag-accent-hover text-white font-medium shadow-glow-sm transition-all duration-200 active:scale-[0.98]"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>{isAdding ? 'Cancelar Agendamento' : 'Novo Agendamento (/schedule)'}</span>
      </button>

      {/* Add form */}
      {isAdding && (
        <form onSubmit={handleCreate} className="p-3 mb-3 rounded-lg bg-ag-bg-card border border-ag-border space-y-2.5 animate-slide-up">
          <div>
            <label className="text-[10px] text-ag-text-muted uppercase font-semibold block mb-1">Nome da Tarefa</label>
            <input
              type="text"
              placeholder="ex: Verificação de Build"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded bg-ag-bg border border-ag-border text-xs text-ag-text focus:outline-none focus:border-ag-accent"
              required
            />
          </div>

          <div>
            <label className="text-[10px] text-ag-text-muted uppercase font-semibold block mb-1">Expressão Cron</label>
            <input
              type="text"
              placeholder="*/30 * * * *"
              value={newTaskCron}
              onChange={(e) => setNewTaskCron(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded bg-ag-bg border border-ag-border text-xs font-mono text-ag-text focus:outline-none focus:border-ag-accent"
              required
            />
          </div>

          <div>
            <label className="text-[10px] text-ag-text-muted uppercase font-semibold block mb-1">Instrução / Prompt</label>
            <textarea
              placeholder="O que o agente deve executar quando o agendamento disparar..."
              value={newTaskPrompt}
              onChange={(e) => setNewTaskPrompt(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded bg-ag-bg border border-ag-border text-xs text-ag-text focus:outline-none focus:border-ag-accent resize-none h-16"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-1.5 rounded bg-ag-green hover:bg-ag-green/90 text-white font-medium text-xs transition-colors"
          >
            Salvar Agendamento
          </button>
        </form>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`p-3 rounded-lg bg-ag-bg-card border transition-all ${
              task.active ? 'border-ag-border hover:border-ag-border-light' : 'border-ag-border/50 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-ag-text truncate">{task.name}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`p-1 rounded hover:bg-ag-bg transition-colors ${
                    task.active ? 'text-ag-green hover:text-ag-amber' : 'text-ag-text-muted hover:text-ag-green'
                  }`}
                  title={task.active ? 'Pausar' : 'Ativar'}
                >
                  {task.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="p-1 rounded hover:bg-ag-bg text-ag-text-muted hover:text-ag-red transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-ag-text-secondary line-clamp-2 mb-2 leading-relaxed">
              {task.prompt}
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-ag-border/50 text-[10px] text-ag-text-muted font-mono">
              <span className="flex items-center gap-1 text-ag-accent">
                <Clock className="w-2.5 h-2.5" />
                {task.cron}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                {task.nextRun}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
