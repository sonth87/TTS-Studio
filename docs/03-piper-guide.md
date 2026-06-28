# 03 — Hướng dẫn sử dụng Piper TTS

> **Piper TTS** là một engine TTS offline nhanh, nhẹ, viết bằng C++ và có binding cho nhiều ngôn ngữ. Trong dự án này, Piper được giữ lại làm Baseline (so sánh chất lượng) với Valtec.

---

## 🚀 Giới thiệu về Piper

- **Ưu điểm**:
  - Tốc độ sinh audio cực kỳ nhanh (thường dưới 0.5s cho một câu ngắn trên CPU).
  - Không có dependencies phức tạp (chạy trực tiếp file binary).
  - License MIT hoàn toàn thương mại hóa được.
- **Nhược điểm**:
  - Giọng đọc tiếng Việt còn hơi thô, có phần giống robot hoặc giọng trẻ con (nếu dùng các model cũ).
  - Khó custom hoặc clone giọng trực tiếp nếu không train lại.

---

## 📁 Tài nguyên & Link tải model

Tất cả các model Piper tiếng Việt chính thức được lưu trữ tại HuggingFace:
`https://huggingface.co/rhasspy/piper-voices/tree/main/vi/vi_VN`

Hiện tại model tốt nhất cho tiếng Việt là **vais1000** (giọng nữ):
- **Model ONNX**: [vi_VN-vais1000-medium.onnx](https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vais1000/medium/vi_VN-vais1000-medium.onnx) (~63 MB)
- **Model Config**: [vi_VN-vais1000-medium.onnx.json](https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vais1000/medium/vi_VN-vais1000-medium.onnx.json)

---

## 🛠 Cách chạy Piper từ Command Line (CLI)

### 1. Tải binary
Theo hệ điều hành của bạn, tải binary tương ứng tại [Piper Releases](https://github.com/rhasspy/piper/releases).

### 2. Thực thi qua Terminal/CMD
Để chạy trực tiếp và xuất ra file WAV:
```bash
echo "Chào mừng bạn đến với Studio." | ./piper \
  --model vi_VN-vais1000-medium.onnx \
  --output_file output.wav
```

Nếu muốn xuất ra dạng raw PCM 16-bit 22050Hz (để đưa vào buffer xử lý trực tiếp):
```bash
echo "Chào mừng bạn đến với Studio." | ./piper \
  --model vi_VN-vais1000-medium.onnx \
  --output_raw > output.raw
```

---

## 💻 Tích hợp Piper vào Node.js / Electron

Dưới đây là wrapper tối giản để chạy Piper từ Node.js sử dụng `child_process.spawn`:

```typescript
import { spawn } from 'node:child_process';
import { existsSync, chmodSync } from 'node:fs';

interface PiperResult {
  ok: boolean;
  buffer?: Buffer; // PCM 16-bit mono 22050Hz
  error?: string;
}

export function runPiper(
  text: string, 
  binPath: string, 
  modelPath: string, 
  speed: number = 1.0
): Promise<PiperResult> {
  return new Promise((resolve) => {
    if (!existsSync(binPath)) {
      return resolve({ ok: false, error: `Không tìm thấy file binary: ${binPath}` });
    }
    if (!existsSync(modelPath)) {
      return resolve({ ok: false, error: `Không tìm thấy file model: ${modelPath}` });
    }

    // Đảm bảo quyền thực thi trên macOS / Linux
    if (process.platform !== 'win32') {
      try {
        chmodSync(binPath, 0o755);
      } catch (err) {
        console.warn('Không thể cấp quyền thực thi:', err);
      }
    }

    const lengthScale = String(1.0 / speed);
    const chunks: Buffer[] = [];
    
    const proc = spawn(binPath, [
      '--model', modelPath, 
      '--length_scale', lengthScale, 
      '--output_raw'
    ], {
      windowsHide: true,
    });

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (data) => console.log('[Piper log]', data.toString().trim()));

    proc.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve({ ok: true, buffer: Buffer.concat(chunks) });
      } else {
        resolve({ ok: false, error: `Piper process kết thúc với code: ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });

    // Gửi text vào stdin để Piper dịch
    proc.stdin.write(text, 'utf-8');
    proc.stdin.end();
  });
}
```

---

## ⚠️ Những điểm khác biệt quan trọng với Valtec

1. **Sample Rate**: Piper xuất ra **22050Hz** ( vais1000 ), trong khi Valtec xuất ra **24000Hz**. Nếu bạn play chung 1 audio context, cần truyền đúng sample rate tương ứng, nếu không tiếng sẽ bị méo (nhanh hơn/chậm hơn).
2. **Inference process**: Piper spawn một process con độc lập và giao tiếp qua stdout/stdin. Valtec dùng thư viện C++ `onnxruntime-node` liên kết trực tiếp trong bộ nhớ của Node.js Main Process.
3. **Bộ nhớ**: Piper giải phóng bộ nhớ ngay sau khi process con thoát. Valtec cache lại `InferenceSession` trong bộ nhớ của Electron Main Process để tăng tốc độ cho lần gọi sau.
