import { app, BrowserWindow, nativeTheme } from 'electron';
import * as path from 'path';
import { BrowserManager } from './browser-engine/browser-manager';
import { AgentOrchestrator } from './agent/agent-orchestrator';
import { registerIpcHandlers } from './ipc-handlers';
import { getPlatformAdapter } from './platform';

// Sandbox/GPU workarounds apply only on Linux; win/mac keep Chromium's native sandbox.
const platformAdapter = getPlatformAdapter();
for (const flag of platformAdapter.sandboxFlags) app.commandLine.appendSwitch(flag);

let mainWindow: BrowserWindow | null = null;
let browserManager: BrowserManager | null = null;
let agentOrchestrator: AgentOrchestrator | null = null;

function createWindow() {
  nativeTheme.themeSource = 'dark';

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    ...platformAdapter.windowOptions,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '..', '..', 'src', 'renderer', 'public', 'icon.png'),
  });

  browserManager = new BrowserManager();
  agentOrchestrator = new AgentOrchestrator(browserManager);

  registerIpcHandlers(mainWindow, agentOrchestrator, browserManager);

  // In development, load from Vite dev server on port 1111; in production/standalone, load built files
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:1111');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (platformAdapter.quitOnAllClosed) app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
