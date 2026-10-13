import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// screen_capture: equivalente ao screen_capture do ZeroScript, capturando a
// área de trabalho Linux real (scrot; fallback: ImageMagick import)
export async function screenCapture(dirPath?: string): Promise<string> {
  const dir = dirPath || path.join(os.tmpdir(), 'freeai-captures');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `capture-${Date.now()}.png`);

  const run = (cmd: string, args: string[]) =>
    new Promise<void>((resolve, reject) => {
      execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
    });

  try {
    await run('scrot', ['--overwrite', file]);
  } catch {
    await run('import', ['-window', 'root', file]);
  }

  if (!fs.existsSync(file)) {
    throw new Error('screen_capture: o capturador não gerou arquivo');
  }
  return `Captura salva em: ${file}`;
}

interface InputAction {
  action: string;
  key?: string;
  x?: number;
  y?: number;
  button?: string;
  text?: string;
  scroll?: string;
  waitMs?: number;
}

// simulate_input: user_keyboard_input/user_mouse_input do ZeroScript,
// traduzidos para xdotool no desktop do usuário
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

  const buttonCode: Record<string, string> = { left: '1', middle: '2', right: '3' };

  for (const a of actions) {
    let args: string[] | null = null;
    switch (a.action) {
      case 'keyPress': args = ['key', a.key!]; break;
      case 'keyDown': args = ['keydown', a.key!]; break;
      case 'keyUp': args = ['keyup', a.key!]; break;
      case 'moveTo': args = ['mousemove', String(a.x), String(a.y)]; break;
      case 'click': args = ['click', buttonCode[a.button || 'left']]; break;
      case 'scroll': args = ['click', a.scroll === 'up' ? '4' : '5']; break;
      case 'type': args = ['type', '--delay', '12', a.text!]; break;
    }
    if (args) {
      await new Promise<void>((resolve, reject) => {
        execFile('xdotool', args!, (err) =>
          err ? reject(new Error(`simulate_input (xdotool ${args!.join(' ')}): ${err.message}`)) : resolve()
        );
      });
    } else if (a.action === 'wait') {
      await new Promise((r) => setTimeout(r, a.waitMs));
    }
  }

  return `OK: ${actions.length} ações executadas via xdotool`;
}
