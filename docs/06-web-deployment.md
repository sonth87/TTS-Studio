# 06 — Hướng dẫn triển khai trên Web (Không dùng Electron)

Nếu ứng dụng Slide của bạn chuyển sang chạy trên trình duyệt web thông thường (Chrome, Safari, Firefox), bạn có thể chọn một trong hai phương án triển khai sau:

---

## 🔵 Phương án A: Dựng API Server riêng (Khuyên dùng)

Phương án này giữ nguyên mã nguồn chạy ONNX bằng Node.js ở phía Backend (API Server) và giao tiếp với Frontend Web qua HTTP API hoặc Socket.IO.

```
┌─────────────────┐                 ┌────────────────┐
│   Web Browser   │ ──(HTTP GET)──> │ Node.js Server │ ──> Chạy valtec-tts.ts
│ (Slide Frontend)│ <──(Audio WAV)─ │ (Express API)  │ <── Xuất PCM 24kHz
└─────────────────┘                 └────────────────┘
```

### 1. Code mẫu Express Server (`server.js`)
Bạn tạo một file server Node.js chạy độc lập trên máy chủ hoặc máy Master LAN:

```javascript
const express = require('express');
const cors = require('cors');
const { join } = require('path');
const { runValtec } = require('./electron/valtec-tts'); // import engine

const app = express();
app.use(cors());

const MODEL_DIR = join(__dirname, 'resources', 'valtec');

app.get('/api/tts', async (req, res) => {
  const { text, voice = 'NF', speed = '1.0' } = req.query;
  
  if (!text) {
    return res.status(400).json({ error: 'Thiếu tham số text' });
  }

  try {
    const result = await runValtec(text, voice, parseFloat(speed), MODEL_DIR);
    if (!result.ok || !result.buffer) {
      return res.status(500).json({ error: result.error });
    }

    // Chuyển PCM sang WAV trước khi gửi về client
    const wavBuffer = pcmToWav(result.buffer, 24000);
    
    res.setHeader('Content-Type', 'audio/wav');
    res.send(wavBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('TTS API Server running on port 3000'));
```

### 2. Phía Client (Web React)
Sử dụng thẻ `<audio>` hoặc Web Audio API để gọi trực tiếp endpoint:

```javascript
const audio = new Audio(`http://localhost:3000/api/tts?text=Xin chào&voice=NF&speed=1.0`);
audio.play();
```

---

## 🟢 Phương án B: Chạy Web Assembly (WASM) trực tiếp trên Client

Phương án này chạy suy luận ONNX hoàn toàn offline ngay trong Sandbox trình duyệt của client.

```
┌──────────────────────────────────────────────────────────────┐
│                  Web Browser (Client-side)                   │
│                                                              │
│  Văn bản ──> [vietnamese_g2p] ──> ONNX Runtime Web (WASM) ──> Audio
└──────────────────────────────────────────────────────────────┘
```

### 1. Cài đặt dependency phía Web
```bash
npm install onnxruntime-web
```

### 2. Load model từ URL static trong React
Thay vì đọc từ file system, bạn host các file `.onnx` ở thư mục `/public` hoặc trên CDN và load qua HTTP:

```typescript
import * as ort from 'onnxruntime-web';

// Cấu hình worker path để chạy đa luồng trên trình duyệt
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

async function loadWebSession(modelUrl: string) {
  return await ort.InferenceSession.create(modelUrl, {
    executionProviders: ['wasm'], // Dùng WebAssembly
  });
}
```

### 3. Lưu ý quan trọng khi chạy WASM trên Web:
- **Tải file lớn**: Client sẽ phải tải ~170MB file mô hình khi truy cập lần đầu. Bạn nên dùng IndexedDB để lưu trữ đệm (cache) mô hình tại client.
- **Header bảo mật**: Để chạy tối đa tốc độ với WebAssembly Multi-threading, máy chủ Web cần được cấu hình trả về các header COOP/COEP:
  ```http
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```
