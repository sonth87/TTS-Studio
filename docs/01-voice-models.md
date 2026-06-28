# 01 — Tất cả nguồn giọng đọc tiếng Việt

## 🔵 Valtec TTS (ONNX) — KHUYẾN NGHỊ

**Repo chính:** https://huggingface.co/valtecAI-team/valtec-tts-onnx  
**Web demo:** https://huggingface.co/spaces/valtecAI-team/valtec-vietnamese-tts-web  
**License:** CC BY-NC 4.0 (phi thương mại)

### Danh sách file ONNX:

| File | Size | Link tải trực tiếp |
|------|------|-------------------|
| `text_encoder.onnx` | ~27MB | https://huggingface.co/valtecAI-team/valtec-tts-onnx/resolve/main/text_encoder.onnx |
| `duration_predictor.onnx` | ~2MB | https://huggingface.co/valtecAI-team/valtec-tts-onnx/resolve/main/duration_predictor.onnx |
| `flow.onnx` | ~83MB | https://huggingface.co/valtecAI-team/valtec-tts-onnx/resolve/main/flow.onnx |
| `decoder.onnx` | ~57MB | https://huggingface.co/valtecAI-team/valtec-tts-onnx/resolve/main/decoder.onnx |
| `phoneme_dict.json` | ~8KB | https://huggingface.co/valtecAI-team/valtec-tts-onnx/resolve/main/phoneme_dict.json |
| `precomputed_latents.json` | ~1.7MB | https://huggingface.co/valtecAI-team/valtec-tts-onnx/resolve/main/precomputed_latents.json |
| `tts_config.json` | ~10KB | https://huggingface.co/valtecAI-team/valtec-tts-onnx/resolve/main/tts_config.json |

**Tổng: ~170MB**

### Script tải tất cả:
```bash
BASE="https://huggingface.co/valtecAI-team/valtec-tts-onnx/resolve/main"
for f in phoneme_dict.json tts_config.json precomputed_latents.json \
          text_encoder.onnx duration_predictor.onnx flow.onnx decoder.onnx; do
  echo "Downloading $f..."
  curl -L --progress-bar -o "$f" "$BASE/$f"
done
echo "Done!"
```

### 5 giọng đọc:

| Speaker ID | Giọng | Mô tả | Chất lượng |
|------------|-------|-------|-----------|
| `NF` | Nữ Bắc (Northern Female) | Giọng nữ chuẩn Hà Nội | ★★★★★ |
| `SF` | Nữ Nam (Southern Female) | Giọng nữ Sài Gòn | ★★★★★ |
| `NM1` | Nam Bắc 1 (Northern Male 1) | Giọng nam Hà Nội, tone cao | ★★★★☆ |
| `NM2` | Nam Bắc 2 (Northern Male 2) | Giọng nam Hà Nội, tone khác | ★★★★☆ |
| `SM` | Nam Nam (Southern Male) | Giọng nam miền Nam | ★★★★☆ |

### Config quan trọng từ `tts_config.json`:
```json
{
  "sample_rate": 24000,
  "language_id_map": { "VI": 7 },
  "speakers": { "NF": 0, "SF": 1, "NM1": 2, "SM": 3, "NM2": 4 }
}
```

---

## 🟠 Piper TTS (CLI Binary)

**Repo:** https://github.com/rhasspy/piper  
**Releases:** https://github.com/rhasspy/piper/releases  
**License:** MIT ✅ Tự do thương mại

### Tải binary:
```bash
# macOS ARM64:
curl -LO https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_aarch64.tar.gz
tar xzf piper_macos_aarch64.tar.gz

# macOS x64:
curl -LO https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_x64.tar.gz

# Windows x64:
curl -LO https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip
```

### Model tiếng Việt tốt nhất:

| File | Size | Chất lượng | Link |
|------|------|-----------|------|
| `vi_VN-vais1000-medium.onnx` | ~63MB | ★★★★☆ | https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vais1000/medium/vi_VN-vais1000-medium.onnx |
| `vi_VN-vais1000-medium.onnx.json` | ~3KB | (config) | https://huggingface.co/rhasspy/piper-voices/resolve/main/vi/vi_VN/vais1000/medium/vi_VN-vais1000-medium.onnx.json |

**Dùng cơ bản:**
```bash
echo "Xin chào Việt Nam" | ./piper --model vi_VN-vais1000-medium.onnx --output_raw | aplay -r 22050 -f S16_LE -c 1
```

**Trong Node.js:**
```javascript
const proc = spawn('./piper', ['--model', modelPath, '--output_raw']);
proc.stdin.write(text);
proc.stdin.end();
// Collect chunks from proc.stdout → PCM 16-bit 22050Hz
```

### Tất cả model Piper tiếng Việt:
- Tìm tại: https://huggingface.co/rhasspy/piper-voices/tree/main/vi

---

## 🟡 VietTTS

**Repo:** https://github.com/NTT123/vietTTS  
**License:** Apache 2.0  
**Note:** Cần Python + JAX, khó tích hợp vào Electron

---

## 🟡 Kokoro TTS (Multilingual, có tiếng Việt)

**Repo:** https://github.com/hexgrad/kokoro  
**HuggingFace:** https://huggingface.co/hexgrad/Kokoro-82M  
**License:** Apache 2.0 ✅  
**Note:** ONNX export có sẵn, 82M params, chất lượng tốt

---

## 🔴 Cloud TTS (cần internet)

| Service | Link | Ghi chú |
|---------|------|---------|
| Google TTS | https://cloud.google.com/text-to-speech | Neural2 voices, rất tốt |
| FPT.AI TTS | https://console.fpt.ai/tts | Tiếng Việt chất lượng cao |
| Zalo AI TTS | https://zalo.ai/products/voice | Free tier có hạn |
| OpenAI TTS | https://platform.openai.com/docs/guides/text-to-speech | Không có tiếng Việt native |
| ElevenLabs | https://elevenlabs.io | Clone giọng, rất đắt |

---

## Quy tắc lựa chọn

```
Cần offline? 
  ├─ Có → Valtec ONNX (chất lượng cao) hoặc Piper (đơn giản, MIT)
  └─ Không → Cloud TTS (FPT.AI nếu tiếng Việt, Google nếu đa ngôn ngữ)

Cần tích hợp Electron/Node.js?
  ├─ Có → Valtec (onnxruntime-node) hoặc Piper (spawn process)
  └─ Web browser → onnxruntime-web (phức tạp hơn)

License thương mại?
  ├─ Có → Piper (MIT), Kokoro (Apache 2.0)
  └─ Phi thương mại OK → Valtec (CC BY-NC 4.0)
```
