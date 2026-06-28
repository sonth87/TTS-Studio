/**
 * TTS Bridge — tự động phát hiện môi trường:
 * - Electron: gọi qua window.__tts (exposed bởi preload.ts)
 * - Web: gọi backend local hoặc hiển thị thông báo
 */

export interface TtsResult {
  ok:         boolean;
  blob?:      Blob;
  sampleRate?:number;
  duration?:  number;
  error?:     string;
}

const isElectron = (): boolean =>
  typeof window !== 'undefined' && !!(window as any).__tts;

export async function synthesize(
  text:     string,
  voiceId:  string,
  speed:    number,
): Promise<TtsResult> {
  if (isElectron()) {
    return synthesizeElectron(text, voiceId, speed);
  }

  // ─── WEB MODE FALLBACK (Simulation) ──────────────────────────────────────
  try {
    // 1. Dùng Web Speech API để đọc phát âm thanh thực tế nếu trình duyệt hỗ trợ
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed;
      
      // Giả lập giọng Nam/Nữ bằng cách thay đổi độ cao (Pitch: 0.5 - 2.0)
      if (voiceId.includes('NM') || voiceId.includes('SM')) {
        // Giọng Nam: Hạ thấp pitch
        utterance.pitch = 0.7;
      } else if (voiceId.includes('NF') || voiceId.includes('SF')) {
        // Giọng Nữ: Tăng pitch cao hơn chút
        utterance.pitch = 1.25;
      } else {
        utterance.pitch = 1.0;
      }
      
      // Tìm giọng đọc tiếng Việt trên hệ thống
      const voices = window.speechSynthesis.getVoices();
      
      // Nếu có nhiều giọng tiếng Việt (ví dụ trên macOS hoặc Chrome), cố gắng chọn giọng phù hợp
      const viVoices = voices.filter(v => v.lang.includes('vi') || v.lang.includes('VI'));
      if (viVoices.length > 0) {
        if (voiceId.includes('SM') || voiceId.includes('SF')) {
          // Ưu tiên chọn giọng đọc miền Nam nếu hệ thống có hỗ trợ giọng khác biệt
          utterance.voice = viVoices[1] || viVoices[0];
        } else {
          utterance.voice = viVoices[0];
        }
      }
      
      window.speechSynthesis.cancel(); // Dừng câu đang đọc dở để đọc câu mới ngay lập tức
      window.speechSynthesis.speak(utterance);
    }

    // 2. Tạo một file audio mock (tiếng bíp hình sin 1 giây) để test các tính năng Download/Play
    const sampleRate = 24000;
    const duration = 1.0;
    const numSamples = sampleRate * duration;
    const pcmData = new Int16Array(numSamples);

    // Sinh sóng hình sin tần số 440Hz (nốt La)
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      pcmData[i] = Math.sin(2 * Math.PI * 440 * t) * 16000; // biên độ âm lượng trung bình
    }

    const blob = pcmToWavBlob(pcmData.buffer, sampleRate);
    return {
      ok: true,
      blob,
      sampleRate,
      duration,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Lỗi Web Mode Simulation: ${String(err)}`,
    };
  }
}

async function synthesizeElectron(
  text:    string,
  voiceId: string,
  speed:   number,
): Promise<TtsResult> {
  try {
    const api = (window as any).__tts;
    const res = await api.speak(text, voiceId, speed);
    if (!res.ok || !res.buffer) {
      return { ok: false, error: res.error ?? 'Unknown error' };
    }

    const sampleRate = res.sampleRate ?? 24000;
    // Chuyển raw PCM Int16 → WAV blob để phát bằng <audio>
    const blob = pcmToWavBlob(res.buffer, sampleRate);
    const duration = (res.buffer.byteLength / 2) / sampleRate;

    return { ok: true, blob, sampleRate, duration };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Chuyển raw PCM 16-bit mono → WAV blob */
function pcmToWavBlob(pcmBuffer: ArrayBuffer | Uint8Array, sampleRate: number): Blob {
  let pcm: Int16Array;
  
  if (pcmBuffer instanceof Uint8Array || (pcmBuffer && typeof (pcmBuffer as any).buffer === 'object')) {
    const view = pcmBuffer as Uint8Array;
    // Tạo view Int16Array đúng với offset và length của buffer truyền vào
    pcm = new Int16Array(view.buffer, view.byteOffset, view.byteLength / 2);
  } else {
    pcm = new Int16Array(pcmBuffer as ArrayBuffer);
  }

  const numSamples = pcm.length;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * (bitsPerSample / 8);
  const headerSize = 44;

  const buf = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buf);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0,  'RIFF');
  view.setUint32(4,  36 + dataSize, true);
  writeStr(8,  'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const dest = new Int16Array(buf, headerSize);
  dest.set(pcm);

  return new Blob([buf], { type: 'audio/wav' });
}
