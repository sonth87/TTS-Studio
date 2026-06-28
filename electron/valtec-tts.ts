/**
 * Valtec TTS ONNX inference pipeline — chạy hoàn toàn offline trong Electron main process.
 *
 * Pipeline:
 *   text → G2P → text_encoder → duration_predictor → [length_regulate] → flow → decoder → audio
 *
 * Model I/O (kiểm tra từ onnxruntime-node):
 *   text_encoder:       phone_ids, phone_lengths, tone_ids, language_ids, bert, ja_bert, speaker_id → x_encoded, m_p, logs_p, x_mask, g
 *   duration_predictor: x, x_mask, g → logw
 *   flow:               z_p, y_mask, g → z
 *   decoder:            z, g → audio (float32, 24kHz)
 */

import * as ort from 'onnxruntime-node';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhonemeResult {
  phonemes: number[];
  tones: number[];
  languages: number[];
}

interface TtsConfig {
  symbol_to_id: Record<string, number>;
  language_id_map: Record<string, number>;
  speakers: Record<string, number>;
  sample_rate: number;
}

// ─── Session cache (lazy load, tái sử dụng giữa các lần gọi) ─────────────────

let textEncoderSession: ort.InferenceSession | null = null;
let durPredSession: ort.InferenceSession | null = null;
let flowSession: ort.InferenceSession | null = null;
let decoderSession: ort.InferenceSession | null = null;
let cachedConfig: TtsConfig | null = null;
let cachedModelDir: string | null = null;

async function getSessions(modelDir: string) {
  if (
    textEncoderSession &&
    durPredSession &&
    flowSession &&
    decoderSession &&
    cachedModelDir === modelDir
  ) {
    return { textEncoderSession, durPredSession, flowSession, decoderSession };
  }

  console.log('[Valtec] Loading ONNX sessions from', modelDir);
  
  // Xác định hệ điều hành để bật nhà cung cấp GPU tối ưu
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';
  
  const providers: string[] = [];
  if (isMac) {
    providers.push('coreml');
  } else if (isWin) {
    providers.push('directml');
  }
  providers.push('cpu');

  async function createSessionSafely(modelPath: string): Promise<ort.InferenceSession> {
    try {
      console.log(`[Valtec] Trying to load ${modelPath} with providers: ${providers.join(', ')}`);
      return await ort.InferenceSession.create(modelPath, {
        executionProviders: providers,
      });
    } catch (err) {
      console.warn(`[Valtec] Failed to create session with providers ${providers.join(',')}, falling back to cpu:`, err);
      return await ort.InferenceSession.create(modelPath, {
        executionProviders: ['cpu'],
      });
    }
  }

  textEncoderSession = await createSessionSafely(join(modelDir, 'text_encoder.onnx'));
  durPredSession = await createSessionSafely(join(modelDir, 'duration_predictor.onnx'));
  flowSession = await createSessionSafely(join(modelDir, 'flow.onnx'));
  decoderSession = await createSessionSafely(join(modelDir, 'decoder.onnx'));
  cachedModelDir = modelDir;

  console.log('[Valtec] All sessions loaded.');
  return { textEncoderSession, durPredSession, flowSession, decoderSession };
}

function getConfig(modelDir: string): TtsConfig {
  if (cachedConfig && cachedModelDir === modelDir) return cachedConfig;
  cachedConfig = JSON.parse(readFileSync(join(modelDir, 'tts_config.json'), 'utf-8')) as TtsConfig;
  return cachedConfig;
}

// ─── Vietnamese G2P (ported from vietnamese_g2p.js) ──────────────────────────

const Cus_onsets: Record<string, string> = {
  b:'b', t:'t', th:'tʰ', đ:'d', ch:'c', kh:'x', g:'ɣ', l:'l', m:'m', n:'n',
  ngh:'ŋ', nh:'ɲ', ng:'ŋ', ph:'f', v:'v', x:'s', d:'z', h:'h', p:'p', qu:'kw',
  gi:'j', tr:'ʈ', k:'k', c:'k', gh:'ɣ', r:'ʐ', s:'ʂ',
};

const Cus_nuclei: Record<string, string> = {
  a:'a',á:'a',à:'a',ả:'a',ã:'a',ạ:'a',
  â:'ɤ̆',ấ:'ɤ̆',ầ:'ɤ̆',ẩ:'ɤ̆',ẫ:'ɤ̆',ậ:'ɤ̆',
  ă:'ă',ắ:'ă',ằ:'ă',ẳ:'ă',ẵ:'ă',ặ:'ă',
  e:'ɛ',é:'ɛ',è:'ɛ',ẻ:'ɛ',ẽ:'ɛ',ẹ:'ɛ',
  ê:'e',ế:'e',ề:'e',ể:'e',ễ:'e',ệ:'e',
  i:'i',í:'i',ì:'i',ỉ:'i',ĩ:'i',ị:'i',
  o:'ɔ',ó:'ɔ',ò:'ɔ',ỏ:'ɔ',õ:'ɔ',ọ:'ɔ',
  ô:'o',ố:'o',ồ:'o',ổ:'o',ỗ:'o',ộ:'o',
  ơ:'ɤ',ớ:'ɤ',ờ:'ɤ',ở:'ɤ',ỡ:'ɤ',ợ:'ɤ',
  u:'u',ú:'u',ù:'u',ủ:'u',ũ:'u',ụ:'u',
  ư:'ɯ',ứ:'ɯ',ừ:'ɯ',ử:'ɯ',ữ:'ɯ',ự:'ɯ',
  y:'i',ý:'i',ỳ:'i',ỷ:'i',ỹ:'i',ỵ:'i',
  // Diphthongs
  eo:'eo',ia:'iə',iê:'iə',ua:'uə',uô:'uə',ưa:'ɯə',ươ:'ɯə',yê:'iɛ',
};

const Cus_offglides: Record<string, string> = {
  ai:'aj',ay:'ăj',ao:'aw',au:'ăw',ây:'ɤ̆j',âu:'ɤ̆w',
  eo:'ew',iu:'iw',oi:'ɔj',ôi:'oj',ui:'uj',uy:'ʷi',
  ơi:'ɤj',ưi:'ɯj',ưu:'ɯw',
  iêu:'iəw',yêu:'iəw',uôi:'uəj',ươi:'ɯəj',ươu:'ɯəw',
};

const Cus_onglides: Record<string, string> = {
  oa:'ʷa',oă:'ʷă',oe:'ʷɛ',ua:'ʷa',uă:'ʷă',uâ:'ʷɤ̆',
  ue:'ʷɛ',uê:'ʷe',uơ:'ʷɤ',uy:'ʷi',uya:'ʷiə',uyê:'ʷiə',
};

const Cus_onoffglides: Record<string, string> = {
  oai:'aj',oay:'ăj',oao:'aw',oeo:'ew',
  uai:'aj',uay:'ăj',uây:'ɤ̆j',
};

const Cus_codas: Record<string, string> = {
  p:'p',t:'t',c:'k',m:'m',n:'n',ng:'ŋ',nh:'ɲ',ch:'tʃ',
};

const Cus_tones_p: Record<string, number> = {
  á:5,à:2,ả:4,ã:3,ạ:6,ấ:5,ầ:2,ẩ:4,ẫ:3,ậ:6,
  ắ:5,ằ:2,ẳ:4,ẵ:3,ặ:6,é:5,è:2,ẻ:4,ẽ:3,ẹ:6,
  ế:5,ề:2,ể:4,ễ:3,ệ:6,í:5,ì:2,ỉ:4,ĩ:3,ị:6,
  ó:5,ò:2,ỏ:4,õ:3,ọ:6,ố:5,ồ:2,ổ:4,ỗ:3,ộ:6,
  ớ:5,ờ:2,ở:4,ỡ:3,ợ:6,ú:5,ù:2,ủ:4,ũ:3,ụ:6,
  ứ:5,ừ:2,ử:4,ữ:3,ự:6,ý:5,ỳ:2,ỷ:4,ỹ:3,ỵ:6,
};

const Cus_gi: Record<string, string> = {
  gi:'zi',gí:'zi',gì:'zi',gỉ:'zi',gĩ:'zi',gị:'zi',
};

function trans(word: string): { ons: string; nuc: string; cod: string; ton: number; isOOV?: boolean } {
  word = word.toLowerCase();
  let ons = '', nuc = '', cod = '', ton = 1;
  let oOffset = 0, cOffset = 0;
  const l = word.length;
  if (l === 0) return { ons, nuc, cod, ton };

  if (word.substring(0, 3) in Cus_onsets) { ons = Cus_onsets[word.substring(0, 3)]; oOffset = 3; }
  else if (word.substring(0, 2) in Cus_onsets) { ons = Cus_onsets[word.substring(0, 2)]; oOffset = 2; }
  else if (word[0] in Cus_onsets) { ons = Cus_onsets[word[0]]; oOffset = 1; }

  if (word.substring(l - 2) in Cus_codas) { cod = Cus_codas[word.substring(l - 2)]; cOffset = 2; }
  else if (word[l - 1] in Cus_codas) { cod = Cus_codas[word[l - 1]]; cOffset = 1; }

  let nucl = word.substring(oOffset, l - cOffset);

  const iVariants = 'iíìĩị';
  if (word[0] === 'g' && word.length === 3 && iVariants.includes(word[1]) && cod) {
    nucl = 'i'; ons = 'z';
  }

  if (nucl in Cus_nuclei) {
    nuc = Cus_nuclei[nucl];
  } else if (nucl in Cus_onglides && ons !== 'kw') {
    nuc = Cus_onglides[nucl];
    ons = ons ? ons + 'w' : 'w';
  } else if (nucl in Cus_onglides && ons === 'kw') {
    nuc = Cus_onglides[nucl];
  } else if (nucl in Cus_onoffglides) {
    const glide = Cus_onoffglides[nucl];
    cod = glide[glide.length - 1];
    nuc = glide.substring(0, glide.length - 1);
    if (ons !== 'kw') ons = ons ? ons + 'w' : 'w';
  } else if (nucl in Cus_offglides) {
    const glide = Cus_offglides[nucl];
    cod = glide[glide.length - 1];
    nuc = glide.substring(0, glide.length - 1);
  } else if (word in Cus_gi) {
    ons = Cus_gi[word][0]; nuc = Cus_gi[word][1];
  } else {
    return { ons: '', nuc: word, cod: '', ton: 1, isOOV: true };
  }

  for (let i = 0; i < l; i++) {
    if (word[i] in Cus_tones_p) { ton = Cus_tones_p[word[i]]; break; }
  }

  if (nuc === 'a' && cod === 'ɲ') nuc = 'ɛ';
  if (nuc === 'a' && cod === 'k' && cOffset === 2) nuc = 'ɛ';
  if (['u','o','ɔ'].includes(nuc)) {
    if (cod === 'ŋ') cod = 'ŋ͡m';
    if (cod === 'k') cod = 'k͡p';
  }

  return { ons, nuc, cod, ton };
}

function isCombiningMark(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 0x0300 && code <= 0x036F) ||
    (code >= 0x1AB0 && code <= 0x1AFF) ||
    (code >= 0x1DC0 && code <= 0x1DFF) ||
    (code >= 0x20D0 && code <= 0x20FF) ||
    (code >= 0xFE20 && code <= 0xFE2F);
}

function textToPhonemes(text: string, symbolToId: Record<string, number>, viLangId: number): PhonemeResult {
  const VIPHONEME_TONE_MAP: Record<number, number> = { 1:0, 2:2, 3:3, 4:4, 5:1, 6:5 };
  const VI_TONE_OFFSET = 16;
  const phonemes: number[] = [];
  const tones: number[] = [];
  const languages: number[] = [];

  const words = text.split(/\s+/);
  for (const word of words) {
    if (!word) continue;
    let cleanWord = word;
    const trailingPunct: string[] = [];
    while (cleanWord && /[,.!?;:'"()\[\]{}]/.test(cleanWord[cleanWord.length - 1])) {
      trailingPunct.unshift(cleanWord[cleanWord.length - 1]);
      cleanWord = cleanWord.substring(0, cleanWord.length - 1);
    }

    if (cleanWord) {
      const { ons, nuc, cod, ton, isOOV } = trans(cleanWord);
      if (isOOV) {
        const id = symbolToId['UNK'] ?? 305;
        phonemes.push(id); tones.push(0); languages.push(viLangId);
      } else {
        const ipaStr = [ons, nuc, cod].filter(x => x).join('');
        const internalTone = VIPHONEME_TONE_MAP[ton] ?? 0;
        const syllablePhones: string[] = [];
        let i = 0;
        while (i < ipaStr.length) {
          const char = ipaStr[i];
          if (isCombiningMark(char)) { i++; continue; }
          if (char === 'ʷ' || char === 'ʰ' || char === 'ː') {
            if (syllablePhones.length > 0) syllablePhones[syllablePhones.length - 1] += char;
            i++; continue;
          }
          if (char === '\u0361' || char === '\u035c') { i++; continue; }
          syllablePhones.push(char); i++;
        }
        for (const ph of syllablePhones) {
          phonemes.push(symbolToId[ph] ?? symbolToId['UNK'] ?? 305);
          tones.push(internalTone + VI_TONE_OFFSET);
          languages.push(viLangId);
        }
      }
    }

    for (const p of trailingPunct) {
      phonemes.push(symbolToId[p] !== undefined ? symbolToId[p] : symbolToId['UNK'] ?? 305);
      tones.push(VI_TONE_OFFSET); // tone 0 + offset
      languages.push(viLangId);
    }
  }

  const boundaryId = symbolToId['_'] ?? 0;
  phonemes.unshift(boundaryId); phonemes.push(boundaryId);
  tones.unshift(VI_TONE_OFFSET); tones.push(VI_TONE_OFFSET);
  languages.unshift(viLangId); languages.push(viLangId);

  return { phonemes, tones, languages };
}

function addBlanks(input: PhonemeResult, viLangId: number): PhonemeResult {
  const withBlanks: number[] = [];
  const tonesWithBlanks: number[] = [];
  const langsWithBlanks: number[] = [];
  const VI_TONE_OFFSET = 16;

  for (let i = 0; i < input.phonemes.length; i++) {
    withBlanks.push(0); tonesWithBlanks.push(VI_TONE_OFFSET); langsWithBlanks.push(viLangId);
    withBlanks.push(input.phonemes[i]); tonesWithBlanks.push(input.tones[i]); langsWithBlanks.push(input.languages[i]);
  }
  withBlanks.push(0); tonesWithBlanks.push(VI_TONE_OFFSET); langsWithBlanks.push(viLangId);

  return { phonemes: withBlanks, tones: tonesWithBlanks, languages: langsWithBlanks };
}

// ─── Length Regulation ────────────────────────────────────────────────────────

function lengthRegulate(
  src: Float32Array,  // [hiddenDim * srcLen] (squeezed [1, H, T])
  durations: number[],
  hiddenDim: number,
  srcLen: number,
  yLen: number,
): Float32Array {
  const dst = new Float32Array(hiddenDim * yLen);
  let yPos = 0;
  for (let t = 0; t < srcLen; t++) {
    const dur = durations[t];
    for (let d = 0; d < dur; d++) {
      for (let h = 0; h < hiddenDim; h++) {
        dst[h * yLen + yPos] = src[h * srcLen + t];
      }
      yPos++;
    }
  }
  return dst;
}

// ─── Box-Muller randn ─────────────────────────────────────────────────────────

function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runValtec(
  text: string,
  speakerId: string,   // 'NF' | 'SF' | 'NM1' | 'SM' | 'NM2'
  speed: number,
  modelDir: string,
): Promise<{ ok: boolean; buffer?: Buffer; sampleRate?: number; error?: string }> {
  try {
    if (!existsSync(join(modelDir, 'text_encoder.onnx'))) {
      return { ok: false, error: `Không tìm thấy Valtec model tại: ${modelDir}` };
    }

    const config = getConfig(modelDir);
    const symbolToId = config.symbol_to_id;
    const viLangId = config.language_id_map['VI'] ?? 7;
    const speakerIdx = config.speakers[speakerId] ?? 0;
    const sampleRate = config.sample_rate ?? 24000;

    // 1. Chuẩn hóa văn bản và chạy G2P
    const normalizedText = normalizeText(text);
    console.log('[Valtec] Normalized text:', normalizedText);
    const raw = textToPhonemes(normalizedText, symbolToId, viLangId);
    const { phonemes, tones, languages } = addBlanks(raw, viLangId);
    const seqLen = phonemes.length;

    // 2. Load sessions
    const sessions = await getSessions(modelDir);

    // 3. Text encoder
    const bertDim = 1024;
    const jaBertDim = 768;
    const bertData = new Float32Array(bertDim * seqLen); // zeros
    const jaBertData = new Float32Array(jaBertDim * seqLen); // zeros

    const encOut = await sessions.textEncoderSession!.run({
      phone_ids:    new ort.Tensor('int64', BigInt64Array.from(phonemes.map(BigInt)), [1, seqLen]),
      phone_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(seqLen)]), [1]),
      tone_ids:     new ort.Tensor('int64', BigInt64Array.from(tones.map(BigInt)), [1, seqLen]),
      language_ids: new ort.Tensor('int64', BigInt64Array.from(languages.map(BigInt)), [1, seqLen]),
      bert:         new ort.Tensor('float32', bertData, [1, bertDim, seqLen]),
      ja_bert:      new ort.Tensor('float32', jaBertData, [1, jaBertDim, seqLen]),
      speaker_id:   new ort.Tensor('int64', BigInt64Array.from([BigInt(speakerIdx)]), [1]),
    });

    const xEncoded = encOut['x_encoded'] as ort.Tensor;
    const mP       = encOut['m_p']       as ort.Tensor;
    const logsP    = encOut['logs_p']    as ort.Tensor;
    const xMask    = encOut['x_mask']    as ort.Tensor;
    const g        = encOut['g']         as ort.Tensor;

    // 4. Duration predictor
    const durOut = await sessions.durPredSession!.run({
      x:      xEncoded,
      x_mask: xMask,
      g,
    });

    const logw    = durOut['logw'].data as Float32Array;
    const xMaskD  = xMask.data as Float32Array;
    const lengthScale = 1.0 / Math.max(speed, 0.1);

    const durations: number[] = [];
    let yLen = 0;
    for (let i = 0; i < seqLen; i++) {
      const dur = Math.max(1, Math.ceil(Math.exp(logw[i]) * xMaskD[i] * lengthScale));
      durations.push(dur);
      yLen += dur;
    }

    // 5. Hidden dim từ m_p shape [1, H, T]
    const hiddenDim = mP.dims[1];
    const mPData    = mP.data    as Float32Array;
    const logsPData = logsP.data as Float32Array;

    // 6. Length regulate
    const mPExp    = lengthRegulate(mPData,    durations, hiddenDim, seqLen, yLen);
    const logsPExp = lengthRegulate(logsPData, durations, hiddenDim, seqLen, yLen);

    // 7. Sample z_p = m_p + exp(logs_p) * noise_scale * randn
    const NOISE_SCALE = 0.667;
    const zP = new Float32Array(hiddenDim * yLen);
    for (let i = 0; i < zP.length; i++) {
      zP[i] = mPExp[i] + Math.exp(logsPExp[i]) * NOISE_SCALE * randn();
    }

    // 8. y_mask (all ones, shape [1, 1, yLen])
    const yMaskData = new Float32Array(yLen).fill(1.0);

    // 9. Flow
    const flowOut = await sessions.flowSession!.run({
      z_p:    new ort.Tensor('float32', zP, [1, hiddenDim, yLen]),
      y_mask: new ort.Tensor('float32', yMaskData, [1, 1, yLen]),
      g,
    });

    const z = flowOut['z'] as ort.Tensor;

    // 10. Decoder
    const decOut = await sessions.decoderSession!.run({ z, g });
    const audioData = decOut['audio'].data as Float32Array;

    // 11. Convert float32 → int16 PCM Buffer (giống Piper output format)
    const int16 = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, Math.round(audioData[i] * 32767)));
    }

    return {
      ok: true,
      buffer: Buffer.from(int16.buffer),
      sampleRate,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Valtec] Error:', msg);
    return { ok: false, error: msg };
  }
}

export async function warmupValtec(speakerId: string, modelDir: string): Promise<void> {
  if (!existsSync(join(modelDir, 'text_encoder.onnx'))) return;
  try {
    await runValtec('xin chào', speakerId, 1.0, modelDir);
    console.log('[Valtec] Warmup OK');
  } catch (err) {
    console.warn('[Valtec] Warmup failed:', err);
  }
}

// ─── Text Normalizer Helpers ──────────────────────────────────────────────────

export function normalizeText(text: string): string {
  if (!text) return '';
  let normalized = text.toLowerCase();

  // 1. Chuẩn hóa ngày tháng (Ví dụ: 28/06/2026 hoặc 28/06)
  normalized = normalizeDates(normalized);

  // 2. Chuẩn hóa từ viết tắt
  const abbrevs: Record<string, string> = {
    'dnu': 'đại học đại nam',
    'tts': 'tê tê ét',
    'onnx': 'o en en ích',
    'cpu': 'xê pê u',
    'gpu': 'gê pê u',
    'tp.': 'thành phố',
    'tp': 'thành phố',
    'hcm': 'hồ chí minh',
    'đh': 'đại học',
    'ths': 'thạc sĩ',
    'ts': 'tiến sĩ',
    'sv': 'sinh viên',
    'đ/c': 'địa chỉ',
    'v/v': 'về việc',
    'usd': 'đô la',
    'vnd': 'việt nam đồng',
  };

  normalized = normalized.split(/\s+/).map(word => {
    const cleanWord = word.replace(/[,.!?;:'"()]/g, '');
    const replacement = abbrevs[cleanWord];
    if (replacement) {
      return word.replace(cleanWord, replacement);
    }
    return word;
  }).join(' ');

  // 3. Chuẩn hóa các số tự nhiên
  normalized = normalized.replace(/\b\d+\b/g, (match) => {
    return numberToVietnameseText(match);
  });

  return normalized;
}

function normalizeDates(text: string): string {
  return text
    .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (_, d, m, y) => {
      return `ngày ${numberToVietnameseText(d)} tháng ${numberToVietnameseText(m)} năm ${numberToVietnameseText(y)}`;
    })
    .replace(/(\d{1,2})\/(\d{1,2})/g, (_, d, m) => {
      return `ngày ${numberToVietnameseText(d)} tháng ${numberToVietnameseText(m)}`;
    });
}

function numberToVietnameseText(numStr: string): string {
  const num = parseInt(numStr, 10);
  if (isNaN(num)) return numStr;
  if (num === 0) return 'không';

  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  
  function convertGroup(n: number): string {
    let out = '';
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    const ten = Math.floor(remainder / 10);
    const unit = remainder % 10;

    if (hundred > 0) {
      out += units[hundred] + ' trăm ';
      if (ten === 0 && unit > 0) {
        out += 'lẻ ';
      }
    }

    if (ten > 0) {
      if (ten === 1) {
        out += 'mười ';
      } else {
        out += units[ten] + ' mươi ';
      }
    }

    if (unit > 0) {
      if (unit === 1 && ten > 1) {
        out += 'mốt';
      } else if (unit === 5 && ten > 0) {
        out += 'lăm';
      } else if (unit === 4 && ten > 1) {
        out += 'tư';
      } else {
        out += units[unit];
      }
    }
    return out.trim();
  }

  let n = num;
  let result = '';
  const divisions = [
    { label: 'tỷ', value: 1000000000 },
    { label: 'triệu', value: 1000000 },
    { label: 'nghìn', value: 1000 },
  ];

  for (const div of divisions) {
    if (n >= div.value) {
      const group = Math.floor(n / div.value);
      result += convertGroup(group) + ' ' + div.label + ' ';
      n %= div.value;
    }
  }

  if (n > 0 || result === '') {
    result += convertGroup(n);
  }

  return result.trim().replace(/\s+/g, ' ');
}

