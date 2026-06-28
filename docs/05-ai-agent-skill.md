# 05 — Hướng dẫn dành cho AI Agent (Skills & Instructions)

> **Dành cho các AI Coding Assistant / Agents**: File này chứa các chỉ dẫn, mã lệnh mẫu và quy trình kiểm thử tự động để Agent có thể bảo trì, nâng cấp hoặc clone project này một cách dễ dàng nhất.

---

## 🤖 Hướng dẫn Đọc hiểu Hệ thống (Context Parsing)

Khi bạn (AI Agent) nhận được yêu cầu nâng cấp dự án này, hãy thực hiện các bước sau:
1. **Kiểm tra trạng thái Model**: Kiểm tra xem các file `.onnx` và `.json` đã nằm trong thư mục `resources/valtec/` hay chưa.
2. **Kiểm tra Runtime Node**: Project sử dụng `onnxruntime-node`. Native binary của thư viện này cần được compile đúng kiến trúc CPU (x64 / arm64). Nếu gặp lỗi native module, hãy chạy `pnpm rebuild onnxruntime-node`.
3. **Phát hiện Môi trường**:
   - Chế độ desktop sử dụng Electron Main Process để chạy trực tiếp mô hình ONNX qua C++ bindings.
   - Chế độ web chạy mock-up hoặc tích hợp Gradio API (nếu được mở rộng).

---

## 🛠 Lệnh CLI cần thiết cho Agent

### 1. Download Model tự động
```bash
node -e "
const fs = require('fs');
const http = require('https');
const path = require('path');

const files = [
  'phoneme_dict.json', 'tts_config.json', 'precomputed_latents.json',
  'text_encoder.onnx', 'duration_predictor.onnx', 'flow.onnx', 'decoder.onnx'
];
const base = 'https://huggingface.co/valtecAI-team/valtec-tts-onnx/resolve/main/';
const dir = path.join(__dirname, 'resources', 'valtec');

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

files.forEach(f => {
  const dest = path.join(dir, f);
  if (fs.existsSync(dest)) {
    console.log(f + ' already exists. Skipping.');
    return;
  }
  console.log('Downloading ' + f + '...');
  const file = fs.createWriteStream(dest);
  http.get(base + f, response => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(f + ' downloaded.');
    });
  }).on('error', err => {
    fs.unlink(dest, () => {});
    console.error('Error downloading ' + f + ':', err.message);
  });
});
"
```

### 2. Smoke Test ONNX pipeline (Chạy thử không cần mở UI)
Chạy script dưới đây để kiểm tra xem `onnxruntime-node` có load mô hình thành công không và tính toán thử một chuỗi test:
```bash
node -e "
const ort = require('onnxruntime-node');
const path = require('path');
async function test() {
  const dir = './resources/valtec';
  const opts = { executionProviders: ['cpu'] };
  console.log('Testing model loading...');
  await ort.InferenceSession.create(path.join(dir, 'text_encoder.onnx'), opts);
  await ort.InferenceSession.create(path.join(dir, 'duration_predictor.onnx'), opts);
  await ort.InferenceSession.create(path.join(dir, 'flow.onnx'), opts);
  await ort.InferenceSession.create(path.join(dir, 'decoder.onnx'), opts);
  console.log('✓ Smoke test passed: All 4 models loaded successfully!');
}
test().catch(err => {
  console.error('✕ Smoke test failed:', err);
  process.exit(1);
});
"
```

---

## 📐 Kiến thức G2P tiếng Việt cần nắm vững

Khi cần sửa lỗi phát âm hoặc thêm từ viết tắt tiếng Việt vào bộ từ điển:
- Quy tắc chuyển đổi được định nghĩa trong hàm `trans()` của `electron/valtec-tts.ts`.
- Mảng `Cus_onsets` định nghĩa phụ âm đầu.
- Mảng `Cus_nuclei` định nghĩa nguyên âm.
- Mảng `Cus_codas` định nghĩa phụ âm cuối.
- Mảng `Cus_tones_p` định nghĩa dấu thanh tiếng Việt (sắc, huyền, hỏi, ngã, nặng, ngang).
- Khi thêm một từ viết tắt (Ví dụ: "DNU" → "Đại học Đại Nam"), hãy thêm một tầng xử lý chuẩn hóa văn bản trước khi đưa văn bản vào bộ G2P (Text Normalization).

---

## 🔍 Danh sách kiểm thử hồi quy (Regression Test Checklist)

Trước khi gửi PR hoặc bàn giao code, hãy kiểm tra:
- [ ] Code không bị lỗi compile TypeScript (`npm run typecheck`).
- [ ] Chạy build thử xem có bị lỗi import asset hoặc đóng gói không (`npm run build`).
- [ ] Đảm bảo `resources/valtec` được copy chính xác vào thư mục build app sau khi đóng gói.
- [ ] Kiểm tra xem thư mục native module `onnxruntime-node` có bị asar nén lại làm lỗi khởi chạy không (phải nằm trong `asarUnpack` của `electron-builder.yml`).
