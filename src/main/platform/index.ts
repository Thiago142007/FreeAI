import { ChildProcess } from 'child_process';

export interface InputAction {
  action: string;
  key?: string;
  x?: number;
  y?: number;
  button?: string;
  text?: string;
  scroll?: string;
  waitMs?: number;
}

export interface ShellInvocation {
  cmd: string;
  args: string[];
}

export class InputUnavailableError extends Error {}

export interface PlatformAdapter {
  id: string;
  label: string;
  shellName: string;
  spawnShell(command: string): ShellInvocation;
  killTree(child: ChildProcess, signal: NodeJS.Signals): void;
  screenCaptureAttempts(file: string): ShellInvocation[];
  inputCommands(a: InputAction): ShellInvocation[];
  sandboxFlags: string[];
  windowOptions: Record<string, unknown>;
  quitOnAllClosed: boolean;
}

const MAC_KEYCODES: Record<string, number> = {
  Return: 36, Tab: 48, Escape: 53, Delete: 51, Space: 49,
  Up: 126, Down: 125, Left: 123, Right: 124,
};

const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`;
const asQuote = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

function unixKillTree(child: ChildProcess, signal: NodeJS.Signals) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

const xdotoolButton: Record<string, string> = { left: '1', middle: '2', right: '3' };

const linux: PlatformAdapter = {
  id: 'linux',
  label: 'Linux',
  shellName: 'bash',
  spawnShell: (command) => ({ cmd: 'bash', args: ['-c', command] }),
  killTree: unixKillTree,
  screenCaptureAttempts: (file) => [
    { cmd: 'scrot', args: ['--overwrite', file] },
    { cmd: 'import', args: ['-window', 'root', file] },
  ],
  inputCommands: (a) => {
    switch (a.action) {
      case 'keyPress': return [{ cmd: 'xdotool', args: ['key', a.key!] }];
      case 'keyDown': return [{ cmd: 'xdotool', args: ['keydown', a.key!] }];
      case 'keyUp': return [{ cmd: 'xdotool', args: ['keyup', a.key!] }];
      case 'moveTo': return [{ cmd: 'xdotool', args: ['mousemove', String(a.x), String(a.y)] }];
      case 'click': return [{ cmd: 'xdotool', args: ['click', xdotoolButton[a.button || 'left']] }];
      case 'scroll': return [{ cmd: 'xdotool', args: ['click', a.scroll === 'up' ? '4' : '5'] }];
      case 'type': return [{ cmd: 'xdotool', args: ['type', '--delay', '12', a.text!] }];
      default: throw new InputUnavailableError(`UNAVAILABLE in Linux: ação ${a.action}`);
    }
  },
  sandboxFlags: ['no-sandbox', 'disable-setuid-sandbox', 'disable-gpu'],
  windowOptions: { frame: false },
  quitOnAllClosed: true,
};

const darwin: PlatformAdapter = {
  id: 'darwin',
  label: 'macOS',
  shellName: 'zsh',
  spawnShell: (command) => ({ cmd: '/bin/zsh', args: ['-c', command] }),
  killTree: unixKillTree,
  screenCaptureAttempts: (file) => [{ cmd: 'screencapture', args: ['-x', file] }],
  inputCommands: (a) => {
    const say = (body: string) => [{ cmd: 'osascript', args: ['-e', `tell application "System Events" to ${body}`] }];
    if (a.action === 'keyPress') {
      const code = MAC_KEYCODES[a.key!];
      if (code !== undefined) return say(`key code ${code}`);
      if (a.key!.length === 1) return say(`keystroke "${asQuote(a.key!)}"`);
      throw new InputUnavailableError(`UNAVAILABLE in macOS: tecla "${a.key}" sem mapeamento`);
    }
    if (a.action === 'type') return say(`keystroke "${asQuote(a.text!)}"`);
    throw new InputUnavailableError(
      `UNAVAILABLE in macOS: ação ${a.action} exige clique/movimento por coordenada, que o AppleScript nativo não faz`
    );
  },
  sandboxFlags: [],
  windowOptions: { frame: true, titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 12 } },
  quitOnAllClosed: false,
};

const winScreenScript = (file: string) =>
  `$ErrorActionPreference='Stop';` +
  `Add-Type -AssemblyName System.Windows.Forms,System.Drawing;` +
  `$b=New-Object System.Drawing.Bitmap(` +
  `[System.Windows.Forms.SystemInformation]::VirtualScreen.Width,` +
  `[System.Windows.Forms.SystemInformation]::VirtualScreen.Height);` +
  `$g=[System.Drawing.Graphics]::FromImage($b);` +
  `$g.CopyFromScreen(0,0,0,0,$b.Size);` +
  `$b.Save(${psQuote(file)});` +
  `$g.Dispose();$b.Dispose()`;

const win32: PlatformAdapter = {
  id: 'win32',
  label: 'Windows',
  shellName: 'PowerShell',
  spawnShell: (command) => ({ cmd: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', command] }),
  killTree: (child, signal) => {
    try { child.kill(signal); } catch { /* já finalizado */ }
  },
  screenCaptureAttempts: (file) => [
    { cmd: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', winScreenScript(file)] },
  ],
  inputCommands: (a) => {
    throw new InputUnavailableError(
      `UNAVAILABLE in Windows: simulate_input não tem equivalente nativo do xdotool; use run_command com PowerShell (ação "${a.action}")`
    );
  },
  sandboxFlags: [],
  windowOptions: { frame: false },
  quitOnAllClosed: true,
};

export function getPlatformAdapter(platform: string = process.platform): PlatformAdapter {
  if (platform === 'darwin') return darwin;
  if (platform === 'win32') return win32;
  return linux;
}
