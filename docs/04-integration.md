# 04 — Tích hợp Valtec TTS vào Electron App

## Copy-paste nhanh (5 bước)

### Bước 1: Copy inference engine
```bash
cp valtec-tts-studio/electron/valtec-tts.ts  <your-app>/electron/valtec-tts.ts
```

### Bước 2: Copy model files
```bash
cp -r valtec-tts-studio/resources/valtec  <your-app>/resources/valtec
```

### Bước 3: Thêm dependency
```bash
cd <your-app>
npm install onnxruntime-node
# Approve build scripts:
npx pnpm approve-builds   # chọn onnxruntime-node → Enter
```

### Bước 4: Thêm vào electron-builder.yml
```yaml
extraResources:
  - from: resources/valtec
    to: valtec
asarUnpack:
  - node_modules/onnxruntime-node/**
```

### Bước 5: Thêm IPC handler
```typescript
// electron/paths.ts
export function valtecDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'valtec')
    : join(app.getAppPath(), 'resources', 'valtec');
}

// electron/ipc.ts
import { runValtec, warmupValtec } from './valtec-tts';
import { valtecDir } from './paths';

// Trong registerIpcHandlers():
ipcMain.handle('tts:speak', async (_e, { text, modelName, speed }) => {
  if (!text?.trim()) return { ok: false, error: 'Empty text' };
  if (modelName?.startsWith('valtec-')) {
    const speakerId = modelName.replace('valtec-', '');  // NF, SF, NM1, NM2, SM
    return runValtec(text.trim(), speakerId, speed ?? 1.0, valtecDir());
  }
  // Fallback Piper...
});

ipcMain.handle('tts:warmup', async () => {
  await warmupValtec('NF', valtecDir());
  return { ok: true };
});
```

### Bước 5b: Cập nhật preload.ts
```typescript
// Đảm bảo trả về sampleRate:
contextBridge.exposeInMainWorld('slide', {
  speak: (text, modelName, speed) =>
    ipcRenderer.invoke('tts:speak', { text, modelName, speed }).then(res => {
      if (res.ok && res.buffer) {
        return {
          ok: true,
          sampleRate: res.sampleRate ?? 24000,  // ← quan trọng!
          buffer: res.buffer.buffer.slice(...),
        };
      }
      return { ok: false, error: res.error };
    }),
});
```

### Bước 6: Phát audio trong renderer (Web Audio API)
```typescript
async function playPcm(arrayBuffer: ArrayBuffer, sampleRate = 24000) {
  const ctx = new AudioContext();
  const samples = arrayBuffer.byteLength / 2;
  const int16 = new Int16Array(arrayBuffer, 0, samples);
  const float32 = new Float32Array(samples);
  for (let i = 0; i < samples; i++) float32[i] = int16[i] / 32768;
  
  const buffer = ctx.createBuffer(1, samples, sampleRate);
  buffer.copyToChannel(float32, 0);
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
}

// Dùng:
const res = await window.slide.speak(text, 'valtec-NF', 1.0);
if (res.ok && res.buffer) {
  await playPcm(res.buffer, res.sampleRate); // ← truyền đúng sampleRate
}
```

---

## Danh sách voice ID

```typescript
const VALTEC_VOICES = {
  'valtec-NF':  { speakerId: 'NF',  label: 'Nữ Bắc' },
  'valtec-SF':  { speakerId: 'SF',  label: 'Nữ Nam' },
  'valtec-NM1': { speakerId: 'NM1', label: 'Nam Bắc 1' },
  'valtec-NM2': { speakerId: 'NM2', label: 'Nam Bắc 2' },
  'valtec-SM':  { speakerId: 'SM',  label: 'Nam Nam' },
};
```

---

## Kiểm tra models đã tải chưa
```typescript
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function checkModels(valtecDir: string): boolean {
  const required = ['text_encoder.onnx', 'duration_predictor.onnx', 'flow.onnx', 'decoder.onnx'];
  return required.every(f => existsSync(join(valtecDir, f)));
}
```

---

## Lỗi thường gặp khi tích hợp

### "Cannot find module 'onnxruntime-node'"
```bash
cd <your-app>
pnpm install onnxruntime-node
pnpm approve-builds  # QUAN TRỌNG
```

### App đóng gói chạy được nhưng TTS lỗi
```yaml
# electron-builder.yml — phải có asarUnpack:
asarUnpack:
  - node_modules/onnxruntime-node/**
```

### Audio nghe sai tốc độ / pitch
Kiểm tra sample rate: Valtec = **24000Hz**, Piper = **22050Hz**.  
Không dùng hardcode `22050` khi phát Valtec audio.

### Lần đầu TTS rất chậm (10-15s)
Bình thường — lần đầu load 4 ONNX sessions.  
Giải pháp: warmup khi app khởi động:
```typescript
app.whenReady().then(() => {
  setTimeout(() => warmupValtec('NF', valtecDir()), 2000);
});
```
