import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Trash2, Check, X } from 'lucide-react';
import { api } from '@api/client';
import type { AnnotationData } from '@api/client';

interface AnnotationsPanelProps {
  projectId: string;
  pageIndex: number;
  onClose: () => void;
}

export function AnnotationsPanel({ projectId, pageIndex, onClose }: AnnotationsPanelProps) {
  const [annotations, setAnnotations] = useState<AnnotationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [showInput, setShowInput] = useState(false);

  const loadAnnotations = useCallback(async () => {
    try {
      const result = await api.annotations.list(projectId, pageIndex);
      setAnnotations(result);
    } catch (err) {
      console.error('Failed to load annotations:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, pageIndex]);

  useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations]);

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    try {
      const created = await api.annotations.create(projectId, {
        pageIndex,
        annotationType: 'note',
        content: newContent.trim(),
      });
      setAnnotations([...annotations, created]);
      setNewContent('');
      setShowInput(false);
    } catch (err) {
      console.error('Failed to create annotation:', err);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await api.annotations.update(id, { resolved: true });
      setAnnotations(annotations.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
    } catch (err) {
      console.error('Failed to resolve annotation:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.annotations.delete(id);
      setAnnotations(annotations.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to delete annotation:', err);
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-900 border-l border-zinc-800 w-80">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gold-500" />
          <h2 className="text-sm font-semibold text-zinc-100">Annotations</h2>
          {annotations.length > 0 && (
            <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
              {annotations.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {loading && (
          <div className="text-center text-zinc-500 text-sm py-4">Loading...</div>
        )}
        {!loading && annotations.length === 0 && !showInput && (
          <div className="text-center text-zinc-500 text-sm py-8">
            No annotations on this page.
          </div>
        )}
        {annotations.map((ann) => (
          <div
            key={ann.id}
            className={`rounded border p-3 ${
              ann.resolved
                ? 'border-zinc-800 bg-zinc-800/20 opacity-60'
                : 'border-zinc-700 bg-zinc-800/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-xs text-zinc-500">
                {new Date(ann.createdAt).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-1">
                {!ann.resolved && (
                  <button
                    onClick={() => handleResolve(ann.id)}
                    className="text-zinc-500 hover:text-emerald-400 p-1"
                    title="Resolve"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(ann.id)}
                  className="text-zinc-500 hover:text-red-400 p-1"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className={`text-sm text-zinc-200 ${ann.resolved ? 'line-through' : ''}`}>
              {ann.content}
            </p>
          </div>
        ))}

        {showInput && (
          <div className="rounded border border-gold-600/30 bg-gold-500/5 p-3">
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write a comment..."
              autoFocus
              rows={3}
              className="w-full bg-zinc-950 text-zinc-100 text-sm px-2 py-1.5 rounded border border-zinc-700 outline-none resize-none focus:border-gold-600"
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setShowInput(false);
                  setNewContent('');
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="text-xs bg-gold-500 hover:bg-gold-400 text-black font-medium px-3 py-1 rounded"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {!showInput && (
        <div className="px-3 py-3 border-t border-zinc-800">
          <button
            onClick={() => setShowInput(true)}
            className="w-full flex items-center justify-center gap-2 text-sm text-gold-500 hover:text-gold-400 border border-gold-600/30 hover:border-gold-600/50 rounded py-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Annotation
          </button>
        </div>
      )}
    </div>
  );
}
