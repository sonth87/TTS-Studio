import { useRef, useState } from 'react';
import { Download, Play, Pause, Trash2, Headphones } from 'lucide-react';
import { AudioItem } from '../types';

interface AudioListProps {
  items: AudioItem[];
  onDelete: (id: string) => void;
}

export function AudioList({ items, onDelete }: AudioListProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = (item: AudioItem) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === item.id) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(item.url);
    audioRef.current = audio;
    setPlayingId(item.id);
    audio.play();
    audio.onended = () => setPlayingId(null);
  };

  const download = (item: AudioItem) => {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = `tts_${item.voiceId}_${Date.now()}.wav`;
    a.click();
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
        <Headphones size={36} strokeWidth={1} />
        <p className="text-sm">Chưa có audio nào được tạo</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 overflow-y-auto h-full">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-center gap-3 bg-surface-card border rounded-lg px-3 py-2.5 transition-colors animate-fade-in
            ${item.status === 'error' ? 'border-red-900/50' : 'border-surface-border hover:border-accent/40'}`}
        >
          {/* Play button */}
          <button
            onClick={() => play(item)}
            disabled={item.status === 'error'}
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors
              ${item.status === 'error'
                ? 'bg-red-900/30 text-red-400 cursor-not-allowed'
                : playingId === item.id
                  ? 'bg-accent text-white'
                  : 'bg-surface-hover text-slate-400 hover:bg-accent hover:text-white'}`}
          >
            {item.status === 'error' ? (
              <span className="text-xs">!</span>
            ) : playingId === item.id ? (
              <Pause size={14} />
            ) : (
              <Play size={14} />
            )}
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-300 truncate leading-snug">{item.text}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-accent font-mono">{item.voiceLabel}</span>
              {item.status === 'error' ? (
                <span className="text-[10px] text-red-400">{item.error}</span>
              ) : (
                <>
                  <span className="text-[10px] text-slate-600">•</span>
                  <span className="text-[10px] text-slate-600">{item.speed.toFixed(2)}x</span>
                  <span className="text-[10px] text-slate-600">•</span>
                  <span className="text-[10px] text-slate-600">{item.duration.toFixed(1)}s</span>
                  <span className="text-[10px] text-slate-600">•</span>
                  <span className="text-[10px] text-slate-600">{item.sampleRate / 1000}kHz</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          {item.status === 'done' && (
            <button
              onClick={() => download(item)}
              className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-accent hover:bg-accent/10 transition-colors"
              title="Tải về"
            >
              <Download size={13} />
            </button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            className="w-7 h-7 rounded flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
            title="Xóa"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
