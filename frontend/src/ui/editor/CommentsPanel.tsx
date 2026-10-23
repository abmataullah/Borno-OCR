import { useState } from 'react';
import { useEditorStore } from '@state/editor-store';
import { X, MessageSquare, Check, Send, Trash2, Reply } from 'lucide-react';

interface CommentsPanelProps {
  onClose: () => void;
}

export function CommentsPanel({ onClose }: CommentsPanelProps) {
  const { project, addComment, resolveComment, addCommentReply, deleteComment, selectedElementId, currentPageIndex } = useEditorStore();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  if (!project) return null;

  const comments = (project.comments ?? []).filter(c => c.pageIndex === currentPageIndex);

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedElementId) return;
    const sel = window.getSelection();
    let selectedText = '';
    if (sel && sel.rangeCount > 0) {
      selectedText = sel.toString();
    }
    addComment({
      pageIndex: currentPageIndex,
      elementId: selectedElementId,
      paraIdx: 0,
      startOffset: 0,
      endOffset: selectedText.length,
      selectedText,
      content: newComment,
      author: 'You',
    });
    setNewComment('');
  };

  const handleReply = (commentId: string) => {
    if (!replyText.trim()) return;
    addCommentReply(commentId, 'You', replyText);
    setReplyText('');
    setReplyingTo(null);
  };

  return (
    <div className="w-72 border-l border-app-border bg-app-panel flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-app-border">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-gold" />
          <span className="text-sm font-medium text-text-primary">Comments</span>
          {comments.length > 0 && (
            <span className="text-[10px] bg-gold/20 text-gold px-1.5 rounded-full">{comments.length}</span>
          )}
        </div>
        <button onClick={onClose} className="p-1 text-text-tertiary hover:bg-app-hover rounded">
          <X size={14} />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-app-border">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={selectedElementId ? "Write a comment..." : "Select text first..."}
          disabled={!selectedElementId}
          rows={3}
          className="w-full bg-app-bg text-xs text-text-primary px-2 py-1.5 rounded border border-app-border resize-none disabled:opacity-40"
        />
        <button
          onClick={handleAddComment}
          disabled={!newComment.trim() || !selectedElementId}
          className="w-full mt-1.5 flex items-center justify-center gap-1.5 text-xs bg-gold text-text-on-gold py-1.5 rounded disabled:opacity-40"
        >
          <Send size={12} /> Add Comment
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
            <MessageSquare size={24} />
            <span className="text-xs">No comments on this page</span>
          </div>
        ) : (
          comments.map(c => (
            <div
              key={c.id}
              className={`px-3 py-2 border-b border-app-border/50 ${c.resolved ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-text-secondary">{c.author}</span>
                <span className="text-[9px] text-text-tertiary">
                  {new Date(c.timestamp).toLocaleDateString()}
                </span>
              </div>
              {c.selectedText && (
                <div className="text-[10px] text-text-tertiary bg-app-bg rounded px-1.5 py-1 mb-1 italic border-l-2 border-gold/40">
                  "{c.selectedText.slice(0, 60)}{c.selectedText.length > 60 ? '...' : ''}"
                </div>
              )}
              <p className="text-xs text-text-primary mb-1.5">{c.content}</p>

              {c.replies && c.replies.length > 0 && (
                <div className="ml-3 mb-1.5 space-y-1">
                  {c.replies.map(r => (
                    <div key={r.id} className="text-[11px]">
                      <span className="font-medium text-text-secondary">{r.author}: </span>
                      <span className="text-text-primary">{r.content}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => resolveComment(c.id)}
                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                    c.resolved ? 'text-status-success bg-status-success/15' : 'text-text-tertiary hover:bg-app-hover'
                  }`}
                >
                  <Check size={12} /> {c.resolved ? 'Resolved' : 'Resolve'}
                </button>
                <button
                  onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                  className="flex items-center gap-1 text-[10px] text-text-tertiary hover:bg-app-hover px-1.5 py-0.5 rounded"
                >
                  <Reply size={12} /> Reply
                </button>
                <button
                  onClick={() => deleteComment(c.id)}
                  className="flex items-center gap-1 text-[10px] text-status-error hover:bg-status-error/10 px-1.5 py-0.5 rounded"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {replyingTo === c.id && (
                <div className="mt-1.5 flex gap-1">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply..."
                    className="flex-1 bg-app-bg text-xs text-text-primary px-2 py-1 rounded border border-app-border"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleReply(c.id);
                    }}
                  />
                  <button
                    onClick={() => handleReply(c.id)}
                    className="text-xs bg-gold text-text-on-gold px-2 rounded"
                  >
                    <Send size={12} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
