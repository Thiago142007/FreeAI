import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPlatformAdapter, InputAction } from '../../platform';

// screen_capture: equivalente ao screen_capture do ZeroScript, capturando a
// área de trabalho real do SO do usuário (capturadores escolhidos pelo adaptador)
export async function screenCapture(dirPath?: string): Promise<string> {
  const adapter = getPlatformAdapter();
  const dir = dirPath || path.join(os.tmpdir(), 'freeai-captures');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `capture-${Date.now()}.png`);

  const run = (cmd: string, args: string[]) =>
    new Promise<void>((resolve, reject) => {
      execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
    });

  let lastError: unknown;
  for (const attempt of adapter.screenCaptureAttempts(file)) {
    try {
      await run(attempt.cmd, attempt.args);
      lastError = undefined;
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError) {
    const hint =
      adapter.id === 'darwin'
        ? ' — autorize Gravação de Tela em Ajustes do Sistema → Privacidade e Segurança'
        : '';
    throw new Error(`screen_capture: capturadores de ${adapter.label} falharam: ${String(lastError)}${hint}`);
  }

  if (!fs.existsSync(file)) {
    throw new Error('screen_capture: o capturador não gerou arquivo');
  }
  return `Captura salva em: ${file}`;
}

// simulate_input: user_keyboard_input/user_mouse_input do ZeroScript,
// despachados para o mecanismo de input do SO pelo adaptador de plataforma
export async function simulateInput(actions: InputAction[]): Promise<string> {
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error('simulate_input: actions deve ser um array não vazio');
  }
  if (actions.length > 50) {
    throw new Error('simulate_input: máximo de 50 ações por chamada');
  }

  for (const a of actions) {
    switch (a.action) {
      case 'keyPress':
      case 'keyDown':
      case 'keyUp':
        if (!/^[A-Za-z0-9_+-]{1,32}$/.test(a.key || '')) {
          throw new Error(`simulate_input: tecla inválida: ${a.key}`);
        }
        break;
      case 'moveTo':
        if (typeof a.x !== 'number' || typeof a.y !== 'number') {
          throw new Error('simulate_input: moveTo exige x e y numéricos');
        }
        break;
      case 'click':
        if (a.button && !['left', 'right', 'middle'].includes(a.button)) {
          throw new Error('simulate_input: button deve ser left|right|middle');
        }
        break;
      case 'scroll':
        if (a.scroll && !['up', 'down'].includes(a.scroll)) {
          throw new Error('simulate_input: scroll deve ser up|down');
        }
        break;
      case 'type':
        if (!a.text || a.text.length > 2000) {
          throw new Error('simulate_input: type exige text de até 2000 chars');
        }
        break;
      case 'wait':
        if (!a.waitMs || a.waitMs > 10000) {
          throw new Error('simulate_input: wait exige waitMs entre 1 e 10000');
        }
        break;
      default:
        throw new Error(`simulate_input: ação desconhecida: ${a.action}`);
    }
  }

  const adapter = getPlatformAdapter();

  for (const a of actions) {
    if (a.action === 'wait') {
      await new Promise((r) => setTimeout(r, a.waitMs));
      continue;
    }
    for (const c of adapter.inputCommands(a)) {
      await new Promise<void>((resolve, reject) => {
        execFile(c.cmd, c.args, (err) =>
          err ? reject(new Error(`simulate_input (${c.cmd} ${c.args.join(' ')}): ${err.message}`)) : resolve()
        );
      });
    }
  }

  return `OK: ${actions.length} ações executadas em ${adapter.label}`;
}
