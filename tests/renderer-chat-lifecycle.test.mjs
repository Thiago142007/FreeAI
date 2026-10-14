import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

const repoRoot = path.join(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, 'src', rel), 'utf8');

// Bundle do store para node puro: zustand fica externo (resolvido de node_modules pelo
// diretório do bundle), o resto (uuid, stores irmãos) é inlined.
const tmpDir = path.join(repoRoot, 'tests', '.tmp');
fs.mkdirSync(tmpDir, { recursive: true });
const bundleFile = path.join(tmpDir, 'chat-store.bundle.mjs');

function makeBridge() {
  const handlers = {};
  const db = new Map();
  const sent = [];
  const stopped = [];

  const on = (name) => (cb) => {
    (handlers[name] ||= []).push(cb);
    return () => {
      handlers[name] = (handlers[name] || []).filter((f) => f !== cb);
    };
  };

  const messagesOf = (id) => [...(db.get(id)?.values() || [])];

  return {
    sent,
    stopped,
    emit(name, data) {
      for (const cb of [...(handlers[name] || [])]) cb(data);
    },
    messagesOf,
    defaultCwd: '/tmp',
    windowSize: 50,
    sendMessage: async (payload) => {
      sent.push(payload);
      return { success: true };
    },
    stopGeneration: (provider) => stopped.push(provider),
    listProjects: async () => [],
    listConversations: async () => [],
    saveConversation: async () => true,
    deleteConversation: async () => true,
    upsertMessage: async (conversationId, message) => {
      if (!db.has(conversationId)) db.set(conversationId, new Map());
      db.get(conversationId).set(message.id, message);
      return true;
    },
    getConversationWindow: async (conversationId, start, count) => {
      const all = messagesOf(conversationId);
      return { messages: all.slice(start, start + count), total: all.length };
    },
    fsReadFile: async (filePath) => ({ content: `conteúdo de ${filePath}`, size: 12 }),
    fsWriteFile: async () => ({ bytes: 0, error: null }),
    onToken: on('token'),
    onThinking: on('thinking'),
    onToolCall: on('toolCall'),
    onToolResult: on('toolResult'),
    onComplete: on('complete'),
    onError: on('error')
  };
}

const bridge = makeBridge();
globalThis.window = { freeai: bridge };

await esbuild.build({
  stdin: {
    contents: [
      `export { useChatStore } from '${path.join(repoRoot, 'src/renderer/src/store/chat-store.ts')}';`,
      `export { useEditorStore } from '${path.join(repoRoot, 'src/renderer/src/store/editor-store.ts')}';`
    ].join('\n'),
    resolveDir: repoRoot,
    sourcefile: 'stores-virtual-entry.mjs',
    loader: 'js'
  },
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: bundleFile,
  external: ['zustand']
});

const { useChatStore, useEditorStore } = await import(bundleFile);

// O App.tsx assina os eventos do agente na raiz do app; sem isso o store não recebe nada.
const detach = useChatStore.getState().attachAgentEvents();

function reset() {
  useChatStore.setState({ conversations: [], running: {}, activeConversationId: null });
  useEditorStore.setState({
    opened: { path: null, name: null, root: null },
    conversationId: null,
    previousConversationId: null
  });
}

const convOf = (id) => useChatStore.getState().conversations.find((c) => c.id === id);
const assistantOf = (id) => {
  const conv = convOf(id);
  return conv?.messages.find((m) => m.role === 'assistant');
};

const run = (conversationId, displayText = 'escreva algo') =>
  useChatStore.getState().startRun(conversationId, displayText, {
    prompt: displayText,
    provider: 'deepseek',
    mode: 'agent',
    cwd: '/tmp'
  });

test('startRun registra a corrida no store e despacha ao agente', () => {
  reset();
  const a = useChatStore.getState().createConversation('deepseek', 'agent', '/tmp');
  bridge.sent.length = 0;

  assert.equal(run(a), true);

  const state = useChatStore.getState();
  assert.equal(state.activeConversationId, a);
  assert.deepEqual(
    convOf(a).messages.map((m) => m.role),
    ['user', 'assistant']
  );
  assert.equal(assistantOf(a).isStreaming, true);
  assert.equal(state.running[a].messageId, assistantOf(a).id);
  assert.equal(bridge.sent[0].conversationId, a);
  assert.equal(bridge.sent[0].provider, 'deepseek');
});

test('streaming continua com a conversa fora da tela (bug: corrida órfã ao trocar de página)', () => {
  reset();
  const a = useChatStore.getState().createConversation('deepseek', 'agent', '/tmp');
  const b = useChatStore.getState().createConversation('deepseek', 'agent', '/tmp');
  useChatStore.getState().setActiveConversation(a);
  run(a);

  // vai para outra conversa/arquivo: o ChatCanvas desmonta, o store continua assinado
  useChatStore.getState().setActiveConversation(b);
  bridge.emit('token', { conversationId: a, token: 'mundo', fullText: 'olá mundo' });
  bridge.emit('toolCall', {
    conversationId: a,
    toolCall: { id: 't1', name: 'run_command', displayName: 'Executar', parameters: { cmd: 'ls' } }
  });
  bridge.emit('toolResult', {
    conversationId: a,
    toolResult: { id: 't1', name: 'run_command', status: 'completed', output: 'ok', durationMs: 12 }
  });

  const msg = assistantOf(a);
  assert.equal(msg.content, 'olá mundo');
  assert.equal(msg.toolCalls[0].status, 'completed');
  assert.equal(useChatStore.getState().running[a].messageId, msg.id);

  bridge.emit('complete', { conversationId: a, finalText: 'olá mundo!' });
  assert.equal(assistantOf(a).content, 'olá mundo!');
  assert.equal(assistantOf(a).isStreaming, false);
  assert.equal(useChatStore.getState().running[a], undefined);
});

test('erro encerra a corrida e para o indicador', () => {
  reset();
  const a = useChatStore.getState().createConversation('deepseek', 'agent', '/tmp');
  run(a);
  bridge.emit('error', { conversationId: a, error: 'sessão expirou' });

  assert.match(assistantOf(a).content, /sessão expirou/);
  assert.equal(assistantOf(a).isStreaming, false);
  assert.equal(useChatStore.getState().running[a], undefined);
});

test('stopRun interrompe o provedor da corrida e limpa o indicador', () => {
  reset();
  const a = useChatStore.getState().createConversation('deepseek', 'agent', '/tmp');
  run(a);
  bridge.stopped.length = 0;

  useChatStore.getState().stopRun(a);

  assert.deepEqual(bridge.stopped, ['deepseek']);
  assert.equal(useChatStore.getState().running[a], undefined);
  assert.equal(assistantOf(a).isStreaming, false);
});

test('duas conversas podem correr ao mesmo tempo sem sobrescrever a mensagem', () => {
  reset();
  const a = useChatStore.getState().createConversation('deepseek', 'agent', '/tmp');
  const b = useChatStore.getState().createConversation('gemini', 'agent', '/tmp');
  run(a, 'pergunta A');
  useChatStore.getState().startRun(b, 'pergunta B', {
    prompt: 'pergunta B',
    provider: 'gemini',
    mode: 'agent',
    cwd: '/tmp'
  });

  bridge.emit('token', { conversationId: a, token: '', fullText: 'resposta A' });
  bridge.emit('token', { conversationId: b, token: '', fullText: 'resposta B' });

  assert.equal(convOf(a).messages.find((m) => m.role === 'assistant').content, 'resposta A');
  assert.equal(convOf(b).messages.find((m) => m.role === 'assistant').content, 'resposta B');
});

test('conversa excluída não deixa corrida pendente', () => {
  reset();
  const a = useChatStore.getState().createConversation('deepseek', 'agent', '/tmp');
  run(a);
  useChatStore.getState().deleteConversation(a);

  assert.equal(useChatStore.getState().running[a], undefined);
});

test('mensagens vindas do disco nunca chegam como streaming vivo', async () => {
  reset();
  const a = useChatStore.getState().createConversation('deepseek', 'agent', '/tmp');
  const b = useChatStore.getState().createConversation('deepseek', 'agent', '/tmp');
  // simula o que o processo ficou em disco quando o app foi fechado no meio da resposta
  await bridge.upsertMessage(a, { id: 'm1', role: 'user', content: 'oi', isStreaming: false });
  await bridge.upsertMessage(a, {
    id: 'm2',
    role: 'assistant',
    content: 'resposta cortada',
    isStreaming: true
  });
  useChatStore.setState((state) => ({
    conversations: state.conversations.map((c) =>
      c.id === a ? { ...c, messages: [], windowStart: 2, totalMessages: 2 } : c
    )
  }));

  useChatStore.getState().setActiveConversation(a);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const conv = convOf(a);
  assert.equal(conv.messages.length, 2);
  assert.equal(conv.messages.find((m) => m.id === 'm2').isStreaming, false);
  assert.equal(useChatStore.getState().activeConversationId, a);
  void b;
});

test('só o store assina os eventos do agente (nada de estado de corrida na view)', () => {
  const store = read('renderer/src/store/chat-store.ts');
  const canvas = read('renderer/src/components/chat/ChatCanvas.tsx');
  const editor = read('renderer/src/components/layout/editor/FileEditorView.tsx');
  const app = read('renderer/src/App.tsx');

  for (const view of [canvas, editor]) {
    assert.equal(/freeai\.on(Token|Thinking|ToolCall|Complete|Error)/.test(view), false);
    assert.equal(/setGenerating|setIsGenerating/.test(view), false);
  }
  assert.match(app, /attachAgentEvents\(\)/);
  assert.match(store, /onToken/);
});

test('fechar o arquivo devolve a conversa do chat em que o usuário estava', async () => {
  reset();
  const chat = useChatStore.getState();
  const p = chat.createConversation('deepseek', 'agent', '/tmp');
  chat.setActiveConversation(p);

  await useEditorStore.getState().openFile('/tmp/proj/a.txt', '/tmp/proj');
  const fileConv = useEditorStore.getState().conversationId;
  assert.notEqual(fileConv, p);
  assert.equal(useChatStore.getState().activeConversationId, fileConv);

  useEditorStore.getState().closeFile();
  assert.equal(useEditorStore.getState().opened.path, null);
  assert.equal(useChatStore.getState().activeConversationId, p);
});

test('sequência de arquivos ainda volta ao chat original ao fechar', async () => {
  reset();
  const chat = useChatStore.getState();
  const p = chat.createConversation('deepseek', 'agent', '/tmp');
  chat.setActiveConversation(p);

  await useEditorStore.getState().openFile('/tmp/proj/a.txt', '/tmp/proj');
  await useEditorStore.getState().openFile('/tmp/proj/b.txt', '/tmp/proj');
  assert.equal(useEditorStore.getState().previousConversationId, p);

  useEditorStore.getState().closeFile();
  assert.equal(useChatStore.getState().activeConversationId, p);
});

test('detach desassina os eventos (cleanup do efeito raiz)', () => {
  reset();
  const a = useChatStore.getState().createConversation('deepseek', 'agent', '/tmp');
  run(a);

  detach();
  bridge.emit('token', { conversationId: a, token: '', fullText: 'ignorado' });

  assert.equal(assistantOf(a).content, '');
});

test.after(() => {
  detach();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
