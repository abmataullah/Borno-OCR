import { useAuth } from '@state/auth-context';
import { requestUpgrade } from '../../lib/upgrade';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from '@state/editor-store';
import { useTranslation } from '../../hooks/useTranslation';
import { api } from '../../api/client';
import { Undo2, Redo2, Share, Upload, Crown, Save, Loader2, ArrowLeft, FileDown, FileText, MessageSquare, Languages, Check } from 'lucide-react';
import type { EditorMode } from '../../types/document-model';

const MODE_LABELS: Record<EditorMode, string> = {
  'pdf-layout': 'PDF Layout',
  'document': 'Document',
  'table': 'Table',
};

interface EditorHeaderProps {
  showOcrPanel: boolean;
  setShowOcrPanel: (show: boolean) => void;
  showAnnotationsPanel: boolean;
  setShowAnnotationsPanel: (show: boolean) => void;
}

export function EditorHeader({ showOcrPanel, setShowOcrPanel, showAnnotationsPanel, setShowAnnotationsPanel }: EditorHeaderProps) {
  const { isEmbed } = useAuth();
  const navigate = useNavigate();
  const { t, locale, toggleLocale } = useTranslation();
  const { project, cloudProjectId, mode, isDirty, isSaving, isExporting, setMode, undo, redo, canUndo, canRedo, saveToCloud, exportPdf } = useEditorStore();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const handleShare = async () => {
    if (!cloudProjectId) return;
    setShareLoading(true);
    try {
      const result = await api.projects.share(cloudProjectId, true);
      if (result.shareToken) {
        setShareUrl(`${window.location.origin}/share/${result.shareToken}`);
      }
    } catch (err) {
      console.error('Share failed:', err);
    } finally {
      setShareLoading(false);
    }
  };

  const handleExportDocx = async () => {
    if (!cloudProjectId) return;
    try {
      const job = await api.projects.convert(cloudProjectId, 'docx');
      navigate('/dashboard');
      console.log('DOCX conversion started:', job.id);
    } catch (err) {
      console.error('DOCX export failed:', err);
    }
    setShowExportMenu(false);
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-app-border bg-app-panel px-4">
      {/* Left: Back + Logo + project name + save status */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="icon-btn"
          title="Back to Dashboard"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-base font-bold text-gold">BornoOCR</span>
        <span className="text-sm text-text-secondary">
          {project?.name ?? 'Untitled Document'}
        </span>
        <span className={`text-xs ${isDirty ? 'text-status-warning' : 'text-status-success'}`}>
          {isSaving ? '● Saving...' : isDirty ? '● Unsaved' : '● Saved'}
        </span>
      </div>

      {/* Center: Mode switcher */}
      <div className="flex items-center gap-1 rounded-8 bg-app-elevated p-1">
        {(Object.keys(MODE_LABELS) as EditorMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-4 px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === m
                ? 'bg-gold text-text-on-gold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowOcrPanel(!showOcrPanel)}
          className={`icon-btn ${showOcrPanel ? 'text-gold' : ''}`}
          title={t('editor.ocrCorrection')}
        >
          <FileText size={18} />
        </button>
        <button
          onClick={() => setShowAnnotationsPanel(!showAnnotationsPanel)}
          className={`icon-btn ${showAnnotationsPanel ? 'text-gold' : ''}`}
          title="Annotations"
        >
          <MessageSquare size={18} />
        </button>
        <button
          onClick={toggleLocale}
          className="icon-btn"
          title={locale === 'en' ? 'বাংলা' : 'English'}
        >
          <Languages size={18} />
        </button>
        <div className="mx-2 h-6 w-px bg-app-border" />
        <button
          onClick={undo}
          disabled={!canUndo()}
          className="icon-btn disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('editor.undo')}
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo()}
          className="icon-btn disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('editor.redo')}
        >
          <Redo2 size={18} />
        </button>
        <div className="mx-2 h-6 w-px bg-app-border" />
        <button
          onClick={saveToCloud}
          disabled={!isDirty || isSaving}
          className="btn-ghost flex items-center gap-1.5 disabled:opacity-50"
          title={t('editor.save')}
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {t('common.save')}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting}
            className="btn-gold flex items-center gap-1.5 disabled:opacity-50"
            title={t('common.export')}
          >
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {t('common.export')}
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-8 border border-app-border bg-app-panel shadow-xl">
                <button
                  onClick={() => { exportPdf(); setShowExportMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-text-primary hover:bg-app-hover transition"
                >
                  <FileDown size={14} />
                  {t('editor.exportPdf')}
                </button>
                <button
                  onClick={handleExportDocx}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-text-primary hover:bg-app-hover transition border-t border-app-border"
                >
                  <FileText size={14} />
                  {t('editor.exportDocx')}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="relative">
          <button
            onClick={handleShare}
            disabled={shareLoading || !cloudProjectId}
            className="btn-ghost flex items-center gap-1.5 disabled:opacity-50"
            title={t('editor.share')}
          >
            {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Share size={14} />}
            {t('common.share')}
          </button>
          {shareUrl && (
            <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-8 border border-app-border bg-app-panel shadow-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Check size={14} className="text-status-success" />
                <span className="text-xs font-medium text-text-primary">Share link created</span>
              </div>
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full bg-app-bg text-xs text-text-secondary px-2 py-1.5 rounded border border-app-border"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                }}
                className="w-full mt-2 text-xs bg-gold text-text-on-gold font-medium py-1.5 rounded"
              >
                Copy Link
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => (isEmbed ? requestUpgrade() : navigate('/pricing'))}
          className="btn-outline-gold flex items-center gap-1.5"
          title="Upgrade your plan"
        >
          <Crown size={14} />
          Upgrade
        </button>
      </div>
    </header>
  );
}
