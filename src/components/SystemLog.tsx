import { LogEntry, LogLevel } from '../types';

interface SystemLogProps {
  entries: LogEntry[];
  onClear: () => void;
}

const LEVEL_STYLE: Record<LogLevel, string> = {
  info:    'text-slate-400',
  success: 'text-green-400',
  warn:    'text-yellow-400',
  error:   'text-red-400',
};
const LEVEL_PREFIX: Record<LogLevel, string> = {
  info:    'ℹ',
  success: '✓',
  warn:    '⚠',
  error:   '✕',
};

export function SystemLog({ entries, onClear }: SystemLogProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-surface-border">
        <span className="text-xs text-slate-500">{entries.length} mục</span>
        {entries.length > 0 && (
          <button
            onClick={onClear}
            className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            Xóa log
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
        {entries.length === 0 ? (
          <p className="text-slate-600">Chưa có log nào.</p>
        ) : (
          [...entries].reverse().map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 mb-1">
              <span className="text-slate-600 flex-shrink-0">
                {entry.time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`flex-shrink-0 ${LEVEL_STYLE[entry.level]}`}>
                {LEVEL_PREFIX[entry.level]}
              </span>
              <span className={LEVEL_STYLE[entry.level]}>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
