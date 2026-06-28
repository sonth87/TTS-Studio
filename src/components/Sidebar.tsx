import { Settings, Wrench } from 'lucide-react';
import { ALL_VOICES, TtsSettings } from '../types';

interface SidebarProps {
  settings: TtsSettings;
  onChange: (s: Partial<TtsSettings>) => void;
  onOpenFile: () => void;
  onClear: () => void;
}

export function Sidebar({ settings, onChange, onOpenFile, onClear }: SidebarProps) {
  return (
    <aside className="w-[250px] flex-shrink-0 bg-surface-sidebar border-r border-surface-border flex flex-col gap-4 p-3 overflow-y-auto">
      {/* ── Cài đặt giọng đọc ── */}
      <section>
        <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Settings size={11} />
          Cài đặt Giọng đọc
        </div>

        {/* Voice selector */}
        <div className="mb-3">
          <label className="text-xs text-slate-500 mb-1 block">Giọng đọc</label>
          <select
            value={settings.voiceId}
            onChange={(e) => onChange({ voiceId: e.target.value as TtsSettings['voiceId'] })}
            className="w-full bg-surface-card border border-surface-border rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accent cursor-pointer"
          >
            {ALL_VOICES.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Speed */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-500 flex items-center gap-1">
              <span>⚡</span> Tốc độ
            </label>
            <span className="text-xs font-mono text-accent font-semibold">
              {settings.speed.toFixed(2)}x
            </span>
          </div>
          <input
            type="range" min="0.5" max="2.0" step="0.05"
            value={settings.speed}
            onChange={(e) => onChange({ speed: parseFloat(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-slate-600">0.5x</span>
            <span className="text-[10px] text-slate-600">2.0x</span>
          </div>
        </div>

        {/* Per-line toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange({ perLine: !settings.perLine })}
            className={`toggle-switch no-drag ${settings.perLine ? 'on' : ''}`}
            title="Xử lý từng dòng riêng biệt"
          />
          <span className="text-[11px] text-slate-400 leading-tight">
            ≡ Xử lý từng dòng riêng biệt
          </span>
        </div>
      </section>

      <div className="border-t border-surface-border" />

      {/* ── Công cụ ── */}
      <section>
        <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Wrench size={11} />
          Công cụ
        </div>

        <button
          onClick={onOpenFile}
          className="no-drag w-full flex items-center gap-2 bg-surface-card hover:bg-surface-hover border border-surface-border rounded px-3 py-2 text-xs text-slate-300 transition-colors mb-2"
        >
          <span>📄</span> Mở File (.txt/.srt)
        </button>

        <button
          onClick={onClear}
          className="no-drag w-full flex items-center gap-2 bg-surface-card hover:bg-surface-hover border border-surface-border rounded px-3 py-2 text-xs text-slate-400 transition-colors"
        >
          <span>✕</span> Xóa Nội Dung
        </button>
      </section>

      {/* spacer */}
      <div className="flex-1" />

      {/* Footer info */}
      <div className="text-[10px] text-slate-600 leading-relaxed">
        <p>Engine: Valtec ONNX</p>
        <p>24kHz • Offline</p>
      </div>
    </aside>
  );
}
