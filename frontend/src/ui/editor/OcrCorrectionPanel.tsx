import { useState, useMemo, useCallback } from 'react';
import { Check, AlertTriangle, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface OcrWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  elementId?: string;
  runIndex?: number;
  paragraphIndex?: number;
}

interface OcrCorrectionPanelProps {
  ocrWords: OcrWord[];
  onCorrectWord: (index: number, newText: string) => void;
  onApplyCorrections: () => void;
  onClose: () => void;
}

const CONFIDENCE_THRESHOLD = 60;

function confidenceColor(conf: number): string {
  if (conf >= 80) return 'bg-emerald-500/20 border-emerald-500/40';
  if (conf >= CONFIDENCE_THRESHOLD) return 'bg-amber-500/20 border-amber-500/40';
  return 'bg-red-500/20 border-red-500/40';
}

function confidenceTextColor(conf: number): string {
  if (conf >= 80) return 'text-emerald-400';
  if (conf >= CONFIDENCE_THRESHOLD) return 'text-amber-400';
  return 'text-red-400';
}

export function OcrCorrectionPanel({
  ocrWords,
  onCorrectWord,
  onApplyCorrections,
  onClose,
}: OcrCorrectionPanelProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [filterLow, setFilterLow] = useState(false);

  const stats = useMemo(() => {
    if (!ocrWords.length) return { avg: 0, low: 0, total: 0 };
    const confs = ocrWords.map((w) => w.confidence);
    const avg = confs.reduce((a, b) => a + b, 0) / confs.length;
    const low = confs.filter((c) => c < CONFIDENCE_THRESHOLD).length;
    return { avg: Math.round(avg), low, total: ocrWords.length };
  }, [ocrWords]);

  const visibleWords = useMemo(() => {
    if (filterLow) return ocrWords.filter((w) => w.confidence < CONFIDENCE_THRESHOLD);
    return ocrWords;
  }, [ocrWords, filterLow]);

  const startEdit = useCallback((index: number, currentText: string) => {
    setEditingIndex(index);
    setEditText(currentText);
  }, []);

  const confirmEdit = useCallback(() => {
    if (editingIndex !== null && editText.trim()) {
      onCorrectWord(editingIndex, editText.trim());
    }
    setEditingIndex(null);
    setEditText('');
  }, [editingIndex, editText, onCorrectWord]);

  return (
    <div className="flex h-full flex-col bg-zinc-900 border-l border-zinc-800 w-96">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-gold-500" />
          <h2 className="text-sm font-semibold text-zinc-100">OCR Correction</h2>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-3 border-b border-zinc-800 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-zinc-800/50 rounded-md px-2 py-2">
            <div className="text-lg font-bold text-zinc-100">{stats.total}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Words</div>
          </div>
          <div className="bg-zinc-800/50 rounded-md px-2 py-2">
            <div className={`text-lg font-bold ${confidenceTextColor(stats.avg)}`}>{stats.avg}%</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Avg Conf</div>
          </div>
          <div className="bg-zinc-800/50 rounded-md px-2 py-2">
            <div className="text-lg font-bold text-red-400">{stats.low}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Low Conf</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            {showHeatmap ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Heatmap
          </button>
          <button
            onClick={() => setFilterLow(!filterLow)}
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors ${
              filterLow
                ? 'text-gold-400 border-gold-600 bg-gold-500/10'
                : 'text-zinc-400 hover:text-zinc-200 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Low only ({stats.low})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {visibleWords.length === 0 && (
          <div className="text-center text-zinc-500 text-sm py-8">
            No OCR words on this page.
          </div>
        )}
        {visibleWords.map((word) => {
          const actualIdx = ocrWords.indexOf(word);
          const isEditing = editingIndex === actualIdx;
          const isLow = word.confidence < CONFIDENCE_THRESHOLD;

          return (
            <div
              key={actualIdx}
              className={`flex items-center gap-2 px-2 py-1.5 rounded border ${
                showHeatmap ? confidenceColor(word.confidence) : 'border-zinc-800 bg-zinc-800/30'
              } ${isLow ? 'ring-1 ring-red-500/20' : ''}`}
            >
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmEdit();
                      if (e.key === 'Escape') setEditingIndex(null);
                    }}
                    autoFocus
                    className="flex-1 bg-zinc-950 text-zinc-100 text-sm px-2 py-1 rounded border border-gold-600 outline-none"
                  />
                  <button
                    onClick={confirmEdit}
                    className="text-emerald-400 hover:text-emerald-300 p-1"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-zinc-200 font-mono">
                    {word.text}
                  </span>
                  <span className={`text-xs font-mono ${confidenceTextColor(word.confidence)}`}>
                    {word.confidence}%
                  </span>
                  <button
                    onClick={() => startEdit(actualIdx, word.text)}
                    className="text-zinc-500 hover:text-gold-400 text-xs px-1.5 py-0.5 rounded border border-zinc-700 hover:border-gold-600 transition-colors"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-zinc-800 flex items-center gap-2">
        <button
          onClick={onApplyCorrections}
          className="flex-1 flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-400 text-black font-medium text-sm px-4 py-2 rounded transition-colors"
        >
          <Check className="w-4 h-4" />
          Apply Corrections
        </button>
        <button
          onClick={() => setFilterLow(false)}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm px-3 py-2 rounded border border-zinc-700 hover:border-zinc-600 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Reset
        </button>
      </div>
    </div>
  );
}

export type { OcrWord };
