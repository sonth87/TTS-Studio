import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('__tts', {
  speak: (text: string, voiceId: string, speed: number) =>
    ipcRenderer.invoke('tts:speak', { text, voiceId, speed }).then((res: any) => {
      if (res.ok && res.buffer) {
        return {
          ok: true,
          sampleRate: res.sampleRate ?? 24000,
          buffer: res.buffer.buffer.slice(
            res.buffer.byteOffset,
            res.buffer.byteOffset + res.buffer.byteLength,
          ),
        };
      }
      return { ok: res.ok, error: res.error };
    }),
  warmup: () => ipcRenderer.invoke('tts:warmup'),
  openFile: () => ipcRenderer.invoke('tts:openFile'),
});
