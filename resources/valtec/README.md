# resources/valtec/

## Thư mục này chứa các file model Valtec TTS ONNX

### Cần tải về:
- `text_encoder.onnx` (~27MB) 
- `duration_predictor.onnx` (~2MB)
- `flow.onnx` (~83MB)
- `decoder.onnx` (~57MB)
- `phoneme_dict.json` (~8KB)
- `precomputed_latents.json` (~1.7MB)
- `tts_config.json` (~10KB)

### Link tải:
```
https://huggingface.co/valtecAI-team/valtec-tts-onnx/tree/main
```

### Tải tất cả cùng lúc:
```bash
cd resources/valtec
BASE="https://huggingface.co/valtecAI-team/valtec-tts-onnx/resolve/main"
curl -LO "$BASE/phoneme_dict.json"
curl -LO "$BASE/tts_config.json"
curl -LO "$BASE/precomputed_latents.json"
curl -LO "$BASE/text_encoder.onnx"
curl -LO "$BASE/duration_predictor.onnx"
curl -LO "$BASE/flow.onnx"
curl -LO "$BASE/decoder.onnx"
```

Xem thêm: `../docs/01-voice-models.md`
