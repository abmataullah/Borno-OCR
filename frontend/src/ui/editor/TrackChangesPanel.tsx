import { useState } from 'react';
import { useEditorStore } from '@state/editor-store';
import { Check, X, Clock, FileText } from 'lucide-react';

interface TrackChangesPanelProps {
  onClose: () => void;
}

export function TrackChangesPanel({ onClose }: TrackChangesPanelProps) {
  const { project, acceptTrackChange, rejectTrackChange } = useEditorStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');

  if (!project) return null;

  const changes = project.trackChanges ?? [];
  const filtered = changes.filter(tc => {
    if (filter === 'pending') return !tc.accepted && !tc.rejected;
    if (filter === 'accepted') return tc.accepted;
    if (filter === 'rejected') return tc.rejected;
    return true;
  });

  const pendingCount = changes.filter(tc => !tc.accepted && !tc.rejected).length;

  const handleAcceptAll = () => {
    changes.forEach(tc => {
      if (!tc.accepted && !tc.rejected) acceptTrackChange(tc.id);
    });
  };

  const handleRejectAll = () => {
    changes.forEach(tc => {
      if (!tc.accepted && !tc.rejected) rejectTrackChange(tc.id);
    });
  };

  return (
    <div className="w-72 border-l border-app-border bg-app-panel flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-app-border">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-gold" />
          <span className="text-sm font-medium text-text-primary">Track Changes</span>
          {pendingCount > 0 && (
            <span className="text-[10px] bg-gold/20 text-gold px-1.5 rounded-full">{pendingCount}</span>
          )}
        </div>
        <button onClick={onClose} className="p-1 text-text-tertiary hover:bg-app-hover rounded">
          <X size={14} />
        </button>
      </div>

      <div className="flex gap-1 px-2 py-1.5 border-b border-app-border">
        {(['pending', 'accepted', 'rejected', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] px-2 py-1 rounded capitalize ${
              filter === f ? 'bg-gold/15 text-gold' : 'text-text-tertiary hover:bg-app-hover'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {pendingCount > 0 && filter === 'pending' && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-app-border">
          <button
            onClick={handleAcceptAll}
            className="flex-1 text-[10px] bg-status-success/15 text-status-success py-1 rounded hover:bg-status-success/25"
          >
            Accept All
          </button>
          <button
            onClick={handleRejectAll}
            className="flex-1 text-[10px] bg-status-error/15 text-status-error py-1 rounded hover:bg-status-error/25"
          >
            Reject All
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
            <FileText size={24} />
            <span className="text-xs">No tracked changes</span>
          </div>
        ) : (
          filtered.map(tc => (
            <div
              key={tc.id}
              className={`px-3 py-2 border-b border-app-border/50 ${
                tc.accepted ? 'opacity-50' : tc.rejected ? 'opacity-30' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-text-tertiary">
                  {tc.author} • {new Date(tc.timestamp).toLocaleDateString()}
                </span>
                <span className={`text-[9px] px-1 rounded ${
                  tc.type === 'insert' ? 'bg-status-success/15 text-status-success' :
                  tc.type === 'delete' ? 'bg-status-error/15 text-status-error' :
                  'bg-gold/15 text-gold'
                }`}>
                  {tc.type}
                </span>
              </div>
              <p className="text-xs text-text-primary mb-1 line-clamp-2">
                {tc.type === 'delete' ? <s>{tc.text}</s> : tc.text}
              </p>
              <div className="text-[10px] text-text-tertiary mb-1">
                Page {tc.pageIndex + 1} • Para {tc.paraIdx + 1}
              </div>
              {!tc.accepted && !tc.rejected && (
                <div className="flex gap-1">
                  <button
                    onClick={() => acceptTrackChange(tc.id)}
                    className="flex items-center gap-1 text-[10px] text-status-success hover:bg-status-success/15 px-1.5 py-0.5 rounded"
                  >
                    <Check size={12} /> Accept
                  </button>
                  <button
                    onClick={() => rejectTrackChange(tc.id)}
                    className="flex items-center gap-1 text-[10px] text-status-error hover:bg-status-error/15 px-1.5 py-0.5 rounded"
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              )}
              {tc.accepted && <span className="text-[10px] text-status-success">✓ Accepted</span>}
              {tc.rejected && <span className="text-[10px] text-status-error">✗ Rejected</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
