// ─── Giọng đọc Valtec ──────────────────────────────────────────────────────
export const VALTEC_VOICES = [
  { id: 'valtec-NF',  label: 'NF — Nữ Bắc',   engine: 'valtec' as const, speakerId: 'NF'  },
  { id: 'valtec-SF',  label: 'SF — Nữ Nam',    engine: 'valtec' as const, speakerId: 'SF'  },
  { id: 'valtec-NM1', label: 'NM1 — Nam Bắc 1', engine: 'valtec' as const, speakerId: 'NM1' },
  { id: 'valtec-NM2', label: 'NM2 — Nam Bắc 2', engine: 'valtec' as const, speakerId: 'NM2' },
  { id: 'valtec-SM',  label: 'SM — Nam Nam',   engine: 'valtec' as const, speakerId: 'SM'  },
] as const;

// ─── Giọng đọc Piper (fallback) ────────────────────────────────────────────
export const PIPER_VOICES = [
  { id: 'piper-vais1000', label: 'Piper — Nữ vais1000', engine: 'piper' as const, model: 'vi_VN-vais1000-medium.onnx' },
] as const;

export const ALL_VOICES = [...VALTEC_VOICES, ...PIPER_VOICES];

export type VoiceId = typeof ALL_VOICES[number]['id'];

// ─── Audio Item ─────────────────────────────────────────────────────────────
export interface AudioItem {
  id:        string;
  text:      string;
  voiceId:   VoiceId;
  voiceLabel:string;
  speed:     number;
  duration:  number;       // giây
  sampleRate:number;
  blob:      Blob;
  url:       string;
  createdAt: Date;
  status:    'done' | 'error';
  error?:    string;
}

// ─── Log entry ──────────────────────────────────────────────────────────────
export type LogLevel = 'info' | 'success' | 'warn' | 'error';
export interface LogEntry {
  id:       string;
  level:    LogLevel;
  message:  string;
  time:     Date;
}

// ─── TTS Settings ────────────────────────────────────────────────────────────
export interface TtsSettings {
  voiceId:     VoiceId;
  speed:       number;
  perLine:     boolean;   // Xử lý từng dòng riêng biệt
}

export const DEFAULT_SETTINGS: TtsSettings = {
  voiceId: 'valtec-NF',
  speed:   1.0,
  perLine: false,
};
