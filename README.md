# Valtec TTS Studio

**Valtec TTS Studio** là môi trường thử nghiệm (Sandbox) và kiến trúc tham chiếu tiêu chuẩn (Architectural Reference) để phát triển, tối ưu hóa các giải pháp chuyển đổi văn bản thành giọng nói (Text-to-Speech) tiếng Việt ngoại tuyến (Offline). 

Dự án cung cấp giao diện quản lý trực quan và tài liệu tích hợp toàn diện cho hai engine offline phổ biến: **Valtec ONNX** (kiến trúc đa giọng đọc chất lượng cao) và **Piper TTS** (baseline so sánh hiệu năng).

---

## 🚀 Quick Start

### 1. Model Files (Đã tích hợp sẵn)
Các file model Valtec ONNX đã được sao chép sẵn vào thư mục `resources/valtec/`. Bạn không cần chạy script tải thêm trừ khi muốn reset/cập nhật lại model từ HF:
```bash
# Chỉ chạy lệnh này nếu muốn tải lại từ đầu:
cd resources/valtec
BASE="https://huggingface.co/valtecAI-team/valtec-tts-onnx/resolve/main"
for f in phoneme_dict.json tts_config.json precomputed_latents.json \
          text_encoder.onnx duration_predictor.onnx flow.onnx decoder.onnx; do
  curl -L -o "$f" "$BASE/$f"
done
```

### 2. Cài dependencies
```bash
npm install
# Approve build script cho onnxruntime-node:
npx pnpm approve-builds   # hoặc: npm rebuild onnxruntime-node
```

### 3. Chạy app
```bash
# Desktop (Electron):
npm run dev

# Web (chỉ UI, không có TTS inference):
npm run dev:web
```

### 4. Build & đóng gói
```bash
# Build web:
npm run build:web

# Build Electron (macOS):
npm run build:mac

# Build Electron (Windows):
npm run build:win
```

---

## 📁 Cấu trúc project

```
valtec-tts-studio/
├── docs/                       ← Thư mục tài liệu hướng dẫn và đặc tả kỹ thuật
│   ├── 00-overview.md          ← Tổng quan giải pháp và so sánh tính năng
│   ├── 01-voice-models.md      ← Danh sách liên kết tải và speaker ID
│   ├── 02-valtec-pipeline.md   ← Chi tiết luồng xử lý tensor của ONNX Pipeline
│   ├── 03-piper-guide.md       ← Hướng dẫn sử dụng và tích hợp Piper TTS
│   ├── 04-integration.md       ← Quy trình tích hợp engine vào dự án Electron mới
│   ├── 05-ai-agent-skill.md    ← Tài liệu hướng dẫn tự động hóa dành cho AI Agent
│   └── 06-web-deployment.md    ← Phương án triển khai Web Assembly và API Server
│
├── electron/
│   ├── main.ts                 ← Khởi tạo Electron Main Process & IPC Handlers
│   ├── preload.ts              ← Phơi bày API an toàn qua Context Bridge
│   └── valtec-tts.ts           ← Trọng tâm: Module suy luận ONNX và G2P tiếng Việt
│
├── src/
│   ├── App.tsx                 ← Layout giao diện chính
│   ├── tts-bridge.ts           ← Cầu nối môi trường chạy (Electron Desktop / Browser Web)
│   ├── types.ts                ← Định nghĩa kiểu dữ liệu và cấu hình giọng đọc
│   └── components/
│       ├── Sidebar.tsx         ← Cấu hình giọng đọc, tốc độ và chế độ ngắt câu
│       ├── TextInput.tsx       ← Khung nhập liệu văn bản
│       ├── AudioList.tsx       ← Quản lý danh sách audio đầu ra (Phát/Tải xuống/Xóa)
│       └── SystemLog.tsx       ← Bảng theo dõi log hoạt động thời gian thực
│
├── resources/
│   └── valtec/                 ← Thư mục chứa các tệp mô hình ONNX ngoại tuyến
│       ├── text_encoder.onnx
│       ├── duration_predictor.onnx
│       ├── flow.onnx
│       ├── decoder.onnx
│       ├── phoneme_dict.json
│       ├── precomputed_latents.json
│       └── tts_config.json
│
├── electron.vite.config.ts     ← Cấu hình build cho ứng dụng Desktop
├── vite.web.config.ts          ← Cấu hình build cho ứng dụng Web tĩnh
├── electron-builder.yml        ← Tham số đóng gói ứng dụng đa nền tảng
└── package.json
```

---

## 🎙 Giọng đọc có sẵn

| ID       | Giọng        | Vùng | Giới tính | Chất lượng |
|----------|-------------|------|-----------|------------|
| `NF`     | Nữ Bắc      | Bắc  | Nữ        | ★★★★★     |
| `SF`     | Nữ Nam      | Nam  | Nữ        | ★★★★★     |
| `NM1`    | Nam Bắc 1   | Bắc  | Nam       | ★★★★☆     |
| `NM2`    | Nam Bắc 2   | Bắc  | Nam       | ★★★★☆     |
| `SM`     | Nam Nam     | Nam  | Nam       | ★★★★☆     |

Sample rate: **24kHz** | Định dạng: **PCM 16-bit mono** | Gia tốc phần cứng: **Tự động kích hoạt GPU (CoreML/DirectML) / CPU fallback**

---

## 🔧 Tích hợp nhanh vào dự án mới

### 1. Sao chép tài nguyên
Sao chép mã nguồn động cơ và tệp cấu hình mô hình sang thư mục dự án đích:
```bash
cp electron/valtec-tts.ts  <project>/electron/valtec-tts.ts
cp -r resources/valtec/    <project>/resources/valtec
```

### 2. Khai báo thư viện phụ thuộc
Thêm thư viện suy luận ONNX vào file cấu hình `package.json`:
```json
{
  "dependencies": {
    "onnxruntime-node": "^1.20.1"
  }
}
```

### 3. Thực thi suy luận trong mã nguồn
```typescript
import { runValtec } from './valtec-tts';

const result = await runValtec(
  'Xin chào Việt Nam',  // Nội dung cần chuyển đổi
  'NF',                  // Speaker ID: NF | SF | NM1 | NM2 | SM
  1.0,                   // Tốc độ phát (0.5 – 2.0)
  '/path/to/valtec/',    // Đường dẫn tuyệt đối đến thư mục chứa model
);

if (result.ok && result.buffer) {
  // result.buffer: Đối tượng Buffer chứa dữ liệu âm thanh thô Int16 PCM
  // result.sampleRate: Tần số mẫu mặc định (24000)
}
```

---

## 📚 Tài liệu đặc tả kỹ thuật chi tiết

* [**`docs/00-overview.md`**](docs/00-overview.md) — Phân tích ưu nhược điểm và phạm vi áp dụng của từng TTS Engine.
* [**`docs/01-voice-models.md`**](docs/01-voice-models.md) — Điểm tải xuống tập trung và Speaker ID tương ứng.
* [**`docs/02-valtec-pipeline.md`**](docs/02-valtec-pipeline.md) — Sơ đồ kiến trúc toán học và quy trình xử lý Tensor của Valtec.
* [**`docs/03-piper-guide.md`**](docs/03-piper-guide.md) — Hướng dẫn cài đặt và tích hợp Baseline Piper TTS.
* [**`docs/04-integration.md`**](docs/04-integration.md) — Quy trình từng bước tích hợp hệ thống vào ứng dụng Electron thực tế.
* [**`docs/05-ai-agent-skill.md`**](docs/05-ai-agent-skill.md) — Bản chỉ dẫn kỹ thuật tự động hóa kiểm thử dành cho AI Agent.
* [**`docs/06-web-deployment.md`**](docs/06-web-deployment.md) — Phương án triển khai Client-side WebAssembly và API Server.

---

## 📜 Giấy phép bản quyền (License)

- **Mô hình Valtec TTS**: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — Chỉ áp dụng cho mục đích phi thương mại.
- **Piper TTS**: Giấy phép MIT.
- **Mã nguồn dự án này**: Giấy phép MIT.

