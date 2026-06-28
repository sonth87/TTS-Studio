import { useState, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { TextInput } from './components/TextInput';
import { AudioList } from './components/AudioList';
import { SystemLog } from './components/SystemLog';
import { synthesize } from './tts-bridge';
import {
  ALL_VOICES, DEFAULT_SETTINGS,
  AudioItem, LogEntry, TtsSettings,
} from './types';

type Tab = 'audio' | 'log';

let idCounter = 0;
const uid = () => `id-${++idCounter}-${Date.now()}`;

export default function App() {
  const [text, setText] = useState('');
  const [settings, setSettings] = useState<TtsSettings>(DEFAULT_SETTINGS);
  const [audioItems, setAudioItems] = useState<AudioItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('audio');
  const isElectron = !!(window as any).__tts;

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev, { id: uid(), level, message, time: new Date() }]);
  }, []);

  // Log trạng thái khởi động
  useState(() => {
    // Chạy 1 lần khi render đầu tiên
    setTimeout(() => {
      if (isElectron) {
        addLog('success', 'Hệ thống đã khởi chạy trong Electron Desktop App. Engine ONNX cục bộ sẵn sàng.');
      } else {
        addLog('warn', '⚠️ [Lưu ý Web Mode] Trình duyệt không thể chạy trực tiếp mô hình ONNX offline (đòi hỏi Electron node native).');
        addLog('info', '💡 Hệ thống tự động giả lập bằng cách gọi giọng đọc mặc định của trình duyệt và thay đổi cao độ (pitch: trầm cho giọng Nam, bổng cho giọng Nữ).');
      }
    }, 100);
  });

  const handleSettings = (patch: Partial<TtsSettings>) =>
    setSettings(prev => ({ ...prev, ...patch }));

  const handleOpenFile = async () => {
    if (!(window as any).__tts?.openFile) {
      addLog('warn', 'Mở file chỉ khả dụng trong Electron app.');
      return;
    }
    const content = await (window as any).__tts.openFile();
    if (content) { setText(content); addLog('info', 'Đã mở file thành công.'); }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setLoading(true);

    const voice = ALL_VOICES.find(v => v.id === settings.voiceId)!;
    const lines = settings.perLine
      ? text.split('\n').map(l => l.trim()).filter(Boolean)
      : [text.trim()];

    addLog('info', `Bắt đầu tạo ${lines.length} audio — giọng ${voice.label} — tốc độ ${settings.speed.toFixed(2)}x`);
    if (!isElectron) {
      addLog('info', `🧪 [Web Mode] Giả lập giọng đọc "${voice.label}" bằng cách đổi cao độ Web Speech API (Pitch: ${voice.id.includes('NM') || voice.id.includes('SM') ? '0.70' : '1.25'})`);
    }

    for (const line of lines) {
      addLog('info', `Đang xử lý: "${line.substring(0, 40)}${line.length > 40 ? '…' : ''}"`);
      const t0 = Date.now();
      const res = await synthesize(line, settings.voiceId, settings.speed);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

      if (res.ok && res.blob) {
        const item: AudioItem = {
          id: uid(),
          text: line,
          voiceId: settings.voiceId,
          voiceLabel: voice.label,
          speed: settings.speed,
          duration: res.duration ?? 0,
          sampleRate: res.sampleRate ?? 24000,
          blob: res.blob,
          url: URL.createObjectURL(res.blob),
          createdAt: new Date(),
          status: 'done',
        };
        setAudioItems(prev => [...prev, item]);
        addLog('success', `Tạo xong (${elapsed}s) — ${item.duration.toFixed(1)}s audio`);
        setTab('audio');
      } else {
        const errItem: AudioItem = {
          id: uid(), text: line, voiceId: settings.voiceId,
          voiceLabel: voice.label, speed: settings.speed,
          duration: 0, sampleRate: 24000, blob: new Blob(),
          url: '', createdAt: new Date(), status: 'error', error: res.error,
        };
        setAudioItems(prev => [...prev, errItem]);
        addLog('error', `Lỗi: ${res.error}`);
        setTab('log');
      }
    }

    setLoading(false);
  };

  const handleDelete = (id: string) => {
    setAudioItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.url) URL.revokeObjectURL(item.url);
      return prev.filter(i => i.id !== id);
    });
  };

  const doneCount = audioItems.filter(i => i.status === 'done').length;

  return (
    <div className="flex flex-col h-screen bg-surface select-none">
      {/* ── Titlebar ── */}
      <header className="drag-region flex items-center justify-between h-10 px-4 bg-surface-card border-b border-surface-border flex-shrink-0">
        <div className="no-drag flex items-center gap-2">
          <span className="text-base">🎙</span>
          <span className="font-semibold text-sm text-slate-200">Valtec TTS</span>
          <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-mono">v1.0</span>
        </div>
        <div className="no-drag flex items-center gap-1.5 text-xs text-success">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          {isElectron ? 'Sẵn sàng' : 'Web Mode'}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          settings={settings}
          onChange={handleSettings}
          onOpenFile={handleOpenFile}
          onClear={() => { setText(''); addLog('info', 'Đã xóa nội dung.'); }}
        />

        {/* ── Main content ── */}
        <main className="flex-1 flex flex-col gap-3 p-3 overflow-hidden">
          {/* Text input area */}
          <TextInput
            value={text}
            onChange={setText}
            loading={loading}
            onGenerate={handleGenerate}
          />

          {/* Bottom panel: audio list + logs */}
          <div className="flex-1 bg-surface-card rounded-lg border border-surface-border flex flex-col min-h-0">
            {/* Tabs */}
            <div className="flex items-center gap-1 px-3 pt-2 border-b border-surface-border flex-shrink-0">
              <TabBtn active={tab === 'audio'} onClick={() => setTab('audio')}>
                🎵 Danh sách Audio
                {doneCount > 0 && (
                  <span className="ml-1.5 bg-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                    {doneCount}
                  </span>
                )}
              </TabBtn>
              <TabBtn active={tab === 'log'} onClick={() => setTab('log')}>
                📋 Log Hệ thống
                {logs.some(l => l.level === 'error') && (
                  <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                )}
              </TabBtn>
            </div>

            {/* Panel content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {tab === 'audio' ? (
                <AudioList items={audioItems} onDelete={handleDelete} />
              ) : (
                <SystemLog entries={logs} onClear={() => setLogs([])} />
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Status bar ── */}
      <footer className="h-6 flex items-center px-4 bg-surface-card border-t border-surface-border flex-shrink-0">
        <span className="text-[10px] text-slate-600">
          {doneCount} Audio đã tạo
          {loading && <span className="ml-2 text-accent">• Đang xử lý...</span>}
        </span>
      </footer>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-t font-medium transition-colors border-b-2 -mb-px
        ${active
          ? 'text-accent border-accent bg-accent/5'
          : 'text-slate-500 border-transparent hover:text-slate-300'}`}
    >
      {children}
    </button>
  );
}
