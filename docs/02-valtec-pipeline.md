# 02 — Valtec ONNX Inference Pipeline

## Kiến trúc tổng quan

Valtec TTS là biến thể của **MeloTTS / VITS** được export sang ONNX.  
Nó dùng 4 model ONNX liên kết nhau để chuyển text → audio.

```
Text (Vietnamese)
    │
    ▼
┌─────────────────────────────────────────────────┐
│  BƯỚC 1: G2P (Grapheme-to-Phoneme)              │
│  vietnamese_g2p.ts                               │
│  "xin chào" → [k, ʂ, i, n, tʃ, a, w]           │
│  + tone IDs + language IDs (VI=7)                │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  BƯỚC 2: Text Encoder ONNX                       │
│  Input:  phone_ids  [1, seq_len]  int64          │
│          tone_ids   [1, seq_len]  int64          │
│          language_ids [1, seq_len] int64         │
│          bert       [1, 1024, seq_len] float32   │  ← zeros cho VI
│          ja_bert    [1, 768, seq_len]  float32   │  ← zeros cho VI
│          speaker_id [1]           int64          │  ← 0..4
│  Output: x_encoded  [1, 192, seq_len]            │
│          m_p        [1, 192, seq_len]            │  ← mean
│          logs_p     [1, 192, seq_len]            │  ← log variance
│          x_mask     [1, 1, seq_len]              │
│          g          [1, 256, 1]                  │  ← speaker embedding
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  BƯỚC 3: Duration Predictor ONNX                 │
│  Input:  x      = x_encoded                      │
│          x_mask = x_mask                         │
│          g      = speaker embedding              │
│  Output: logw   [1, 1, seq_len]  float32        │  ← log(duration)
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  BƯỚC 4: Length Regulation (CPU, không phải ONNX)│
│  durations[i] = ceil(exp(logw[i]) * (1/speed))  │
│  y_len = sum(durations)                          │
│  m_p_exp [1, 192, y_len] = expand(m_p, durations)│
│  logs_p_exp [1, 192, y_len] = expand(logs_p,...) │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  BƯỚC 5: Sample from prior (CPU)                 │
│  noise_scale = 0.667                             │
│  z_p = m_p_exp + exp(logs_p_exp) * noise * N(0,1)│
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  BƯỚC 6: Flow ONNX (Normalizing Flow, reverse)  │
│  Input:  z_p    [1, 192, y_len]  float32        │
│          y_mask [1, 1, y_len]    float32        │  ← all ones
│          g      [1, 256, 1]      float32        │  ← speaker emb
│  Output: z      [1, 192, y_len]  float32        │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  BƯỚC 7: Decoder ONNX (HiFiGAN Vocoder)          │
│  Input:  z  [1, 192, y_len]  float32            │
│          g  [1, 256, 1]      float32            │
│  Output: audio [1, 1, samples] float32          │  ← 24000Hz
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
            PCM 16-bit 24kHz WAV
```

---

## Chi tiết từng bước

### Bước 1: G2P — Chuyển text → phoneme IDs

File: `electron/valtec-tts.ts` → hàm `textToPhonemes()` + `addBlanks()`

**Quy trình:**
1. Tách text thành words theo khoảng trắng
2. Mỗi word → `trans(word)` → `{ons, nuc, cod, ton}` (onset, nucleus, coda, tone)
3. Tạo IPA string từ ons+nuc+cod
4. Map từng char IPA → index trong `symbol_to_id` của `tts_config.json`
5. Tone: viphoneme (1-6) → internal (0-5) → + 16 (VI_TONE_OFFSET)
6. `addBlanks()`: chèn blank token (id=0) giữa mỗi phoneme

**Ví dụ:**
```
"xin chào" 
→ "xin" → ons="s", nuc="i", cod="n", ton=1 → "sin" → IDs: [108, 67, 93] + tones: [16, 16, 16]
→ "chào" → ons="c", nuc="a", cod="j", ton=2 → "caj" → IDs: [47, 33, 84] + tones: [18, 18, 18]
→ addBlanks → [0, 108, 0, 67, 0, 93, 0, 47, 0, 33, 0, 84, 0]
```

**Tone mapping:**
```
viphoneme → internal → +16(VI offset)
1 (ngang)  → 0       → 16
2 (huyền)  → 2       → 18
3 (ngã)    → 3       → 19
4 (hỏi)    → 4       → 20
5 (sắc)    → 1       → 17
6 (nặng)   → 5       → 21
```

---

### Bước 2: Text Encoder

**Các tensor input quan trọng:**
- `phone_ids`: phoneme indices từ G2P
- `tone_ids`: tone indices (có VI offset = 16)
- `language_ids`: tất cả = 7 (VI)
- `speaker_id`: 0=NF, 1=SF, 2=NM1, 3=SM, 4=NM2
- `bert` và `ja_bert`: **zeros** (không dùng cho VI)

**Output quan trọng:**
- `g`: speaker embedding `[1, 256, 1]` — được tính từ speaker_id trong embedding table
- `m_p`, `logs_p`: mean/log-var của prior distribution
- `x_mask`: mask chỉ vị trí hợp lệ

---

### Bước 3: Duration Predictor

Dự đoán bao nhiêu frame (mel spectrogram) mỗi phoneme cần.

**Output `logw`:** log của duration, shape `[1, 1, seq_len]`

**Chuyển thành integer durations:**
```typescript
const dur = Math.max(1, Math.ceil(Math.exp(logw[i]) * xMaskData[i] * (1/speed)));
```

Tham số `speed`:
- `speed > 1.0` → nói nhanh hơn (duration ngắn hơn)
- `speed < 1.0` → nói chậm hơn

---

### Bước 4: Length Regulation

Mở rộng `m_p` và `logs_p` từ `[1, 192, seq_len]` → `[1, 192, y_len]`.

Mỗi frame trong output tương ứng với 1 phoneme, lặp lại theo `duration`:

```typescript
function lengthRegulate(src, durations, hiddenDim, srcLen, yLen) {
  let yPos = 0;
  for (let t = 0; t < srcLen; t++) {
    for (let d = 0; d < durations[t]; d++) {
      for (let h = 0; h < hiddenDim; h++) {
        dst[h * yLen + yPos] = src[h * srcLen + t];
      }
      yPos++;
    }
  }
}
```

---

### Bước 5: Prior Sampling

```typescript
const NOISE_SCALE = 0.667; // giá trị từ training config
for (let i = 0; i < zP.length; i++) {
  zP[i] = mPExp[i] + Math.exp(logsPExp[i]) * NOISE_SCALE * randn();
}
```

`NOISE_SCALE` ảnh hưởng đến:
- **0.0**: deterministic, không có variation
- **0.667**: default, natural variation
- **1.0+**: noisy, kém tự nhiên

---

### Bước 6: Flow (Normalizing Flow Reverse)

Giải mã `z_p` (trong latent space chuẩn hóa) → `z` (trong raw latent space).

`y_mask`: all 1s, shape `[1, 1, y_len]`

---

### Bước 7: HiFiGAN Decoder

Chuyển latent `z` → waveform audio.

Output `audio`: float32, range `[-1, 1]`, sample rate 24000Hz

**Chuyển sang Int16 PCM:**
```typescript
const int16 = new Int16Array(audioData.length);
for (let i = 0; i < audioData.length; i++) {
  int16[i] = Math.max(-32768, Math.min(32767, Math.round(audioData[i] * 32767)));
}
```

---

## Performance

Trên **MacBook M-series (CPU)**:
| Text length | Thời gian inference |
|-------------|---------------------|
| 1 từ | ~1.5s |
| 10 từ | ~3-4s |
| 50 từ | ~8-12s |

Lần đầu chạy (load model): +5-10s  
Các lần sau (model cached): nhanh hơn đáng kể

**Tối ưu:**
- Lazy load sessions (chỉ load khi cần)
- Cache sessions giữa các lần gọi
- Warmup khi app khởi động: `warmupValtec('NF', modelDir)`

---

## Troubleshooting

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| `Session not found` | Model files chưa tải | Chạy script tải model |
| `onnxruntime-node not found` | Chưa cài / chưa build | `pnpm install && pnpm approve-builds` |
| `Shape mismatch` | Sai tensor shape | Kiểm tra lại dims trong error message |
| Audio không có âm | PCM format sai | Đảm bảo Int16 + đúng sample rate |
| App đóng gói lỗi | asar không unpack native | Thêm `asarUnpack: ['node_modules/onnxruntime-node/**']` |
