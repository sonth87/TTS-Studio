import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { runValtec, warmupValtec } from './valtec-tts';

function valtecDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'valtec')
    : join(app.getAppPath(), 'resources', 'valtec');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 500,
    titleBarStyle: 'hidden',
    frame: false,
    backgroundColor: '#0f0f1a',
    webPreferences: {
      preload:        join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // IPC: TTS speak
  ipcMain.handle('tts:speak', async (_e, { text, voiceId, speed }: { text: string; voiceId: string; speed: number }) => {
    if (!text?.trim()) return { ok: false, error: 'Empty text' };
    if (voiceId.startsWith('valtec-')) {
      const speakerId = voiceId.replace('valtec-', '');
      return runValtec(text.trim(), speakerId, speed ?? 1.0, valtecDir());
    }
    return { ok: false, error: `Engine không được hỗ trợ: ${voiceId}` };
  });

  // IPC: Warmup
  ipcMain.handle('tts:warmup', async () => {
    await warmupValtec('NF', valtecDir());
    return { ok: true };
  });

  // IPC: Mở file
  ipcMain.handle('tts:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Mở file văn bản',
      filters: [
        { name: 'Text Files', extensions: ['txt', 'srt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return null;
    return readFileSync(filePaths[0], 'utf-8');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
