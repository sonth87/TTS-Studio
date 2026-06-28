import { Mic } from 'lucide-react';

interface TextInputProps {
  value:    string;
  onChange: (v: string) => void;
  loading:  boolean;
  onGenerate: () => void;
}

export function TextInput({ value, onChange, loading, onGenerate }: TextInputProps) {
  const charCount = value.length;
  const lineCount = value.split('\n').filter(l => l.trim()).length;

  return (
    <div className="bg-surface-card rounded-lg border border-surface-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <span className="text-base">📝</span>
          Nhập văn bản
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {lineCount > 0 && <span>{lineCount} dòng</span>}
          <span>{charCount.toLocaleString()} ký tự</span>
        </div>
      </div>

      {/* Textarea */}
      <div className="relative flex-1 min-h-[180px]">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nhập văn bản tiếng Việt vào đây..."
          className="w-full h-full min-h-[180px] bg-transparent px-4 py-3 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none leading-relaxed"
          style={{ fontFamily: 'inherit' }}
        />
        {!value && (
          <p className="absolute bottom-3 left-4 text-xs text-slate-600 pointer-events-none flex items-center gap-1">
            <span>💡</span>
            Mẹo: Bật &#39;Xử lý từng dòng riêng biệt&#39; để tạo nhiều audio từ nhiều dòng văn bản cùng lúc
          </p>
        )}
      </div>

      {/* Generate button */}
      <div className="px-4 pb-4">
        <button
          onClick={onGenerate}
          disabled={loading || !value.trim()}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-all text-sm"
        >
          {loading ? (
            <>
              <span className="animate-spin">⟳</span>
              Đang tạo audio...
            </>
          ) : (
            <>
              <Mic size={15} />
              Tạo Audio
            </>
          )}
        </button>
      </div>
    </div>
  );
}
