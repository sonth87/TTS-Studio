# 00 — Tổng quan Vietnamese TTS

## Các engine TTS tiếng Việt phổ biến (2025)

| Engine | License | Offline | Chất lượng | File size | Inference |
|--------|---------|---------|-----------|-----------|-----------|
| **Valtec ONNX** | CC BY-NC 4.0 | ✅ | ⭐⭐⭐⭐⭐ | ~170MB | CPU/GPU |
| **Piper TTS** | MIT | ✅ | ⭐⭐⭐ | ~60MB/model | CPU |
| **VietTTS** | MIT | ✅ | ⭐⭐⭐⭐ | ~300MB | CPU/GPU |
| **Coqui TTS** | MPL 2.0 | ✅ | ⭐⭐⭐⭐ | ~200MB | CPU/GPU |
| **Google TTS** | Proprietary | ❌ | ⭐⭐⭐⭐⭐ | N/A (API) | Cloud |
| **FPT.AI TTS** | Proprietary | ❌ | ⭐⭐⭐⭐⭐ | N/A (API) | Cloud |
| **Zalo TTS** | Proprietary | ❌ | ⭐⭐⭐⭐ | N/A (API) | Cloud |

## Khi nào dùng cái nào?

### ✅ Dùng Valtec ONNX khi:
- Cần **offline 100%** (event, buổi lễ, vùng mạng yếu)
- Cần **nhiều giọng** (5 giọng Bắc/Nam/Nam/Nữ)
- Chạy trong **Electron app**
- Không muốn trả phí API
- Cần tích hợp nhanh vào Node.js/Electron

### ✅ Dùng Piper khi:
- Cần binary đơn giản, không cần cài npm
- Hệ thống nhúng / Raspberry Pi
- Cần license MIT hoàn toàn tự do thương mại

### ✅ Dùng Cloud TTS (Google/FPT) khi:
- Chất lượng cực cao là ưu tiên 1
- Có kết nối internet ổn định
- Ngân sách cho phép

---

## Lịch sử tích hợp

### Lần 1: Piper TTS (2025-06)
- Dùng Piper binary CLI (spawn process)
- Model: `vi_VN-vais1000-medium.onnx` — giọng nữ
- Vấn đề: chỉ có 1 giọng chất lượng ổn, giọng nam nghe như trẻ con
- Sample rate: 22050Hz

### Lần 2: Valtec ONNX (2025-06)
- Dùng `onnxruntime-node` — inference trực tiếp trong Node.js
- 5 giọng: NF, SF, NM1, NM2, SM
- Chất lượng vượt trội Piper
- Sample rate: 24000Hz
- Giữ lại Piper `vais1000` để so sánh

---

## Architecture tổng quát

```
User Text
    ↓
Vietnamese G2P (Grapheme-to-Phoneme)
    ↓
Phoneme IDs + Tone IDs + Language IDs
    ↓
Text Encoder (ONNX)
    ↓
Duration Predictor (ONNX)
    ↓
Length Regulation (CPU)
    ↓
Flow Model / Normalizing Flow (ONNX)
    ↓
HiFiGAN Decoder (ONNX)
    ↓
Audio Waveform (PCM 24kHz)
    ↓
Web Audio API / WAV file
```

Chi tiết từng bước: xem [`02-valtec-pipeline.md`](02-valtec-pipeline.md)
