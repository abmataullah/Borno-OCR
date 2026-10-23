import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from '@state/editor-store';
import { loadPdf } from '@engine/pdf-renderer';
import { importPdfToElements } from '@engine/pdf-to-elements';
import { saveProjectData, isProjectDeleted, renameProjectData } from '@engine/project-service';
import { setPdfDocument } from './UploadDropzone';
import { SCHEMA_VERSION } from '../../types/document-model';
import type { DocFlowProject } from '../../types/document-model';
import {
  ArrowLeft, Upload, FileText, ScanLine, FileImage, Plus, Edit3,
  Pencil, Check, X,
} from 'lucide-react';

export function ProjectStartScreen({
  project,
  onEnterEditor,
}: {
  project: DocFlowProject;
  onEnterEditor: () => void;
}) {
  const navigate = useNavigate();
  const { setProject, markDirty } = useEditorStore();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const hasContent = project.pages.length > 0;
  const pageCount = project.pages.length;
  const totalElements = project.pages.reduce((sum, p) => sum + p.elements.length, 0);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsLoading(true);

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('Please upload a PDF file.');
        setIsLoading(false);
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        setError('File too large. Maximum 50 MB.');
        setIsLoading(false);
        return;
      }

      try {
        const result = await loadPdf(file);
        setPdfDocument(result.document);
        setFileName(file.name);

        const { pages } = await importPdfToElements(result.document, (status, pct) => {
          setProgressMsg(status);
          setProgressPct(pct);
        });

        // Replace the current project's pages with the freshly-imported PDF.
        // This keeps the SAME project id (no duplicate) and discards any
        // stale/garbled content so old text never mixes with new OCR output.
        const existingProject = useEditorStore.getState().project;
        const now = new Date().toISOString();
        const reindexed = pages.map((p, i) => ({ ...p, index: i }));
        const rebuiltProject: DocFlowProject = {
          id: existingProject && !isProjectDeleted(existingProject.id)
            ? existingProject.id
            : crypto.randomUUID(),
          schemaVersion: SCHEMA_VERSION,
          name: existingProject?.name ?? file.name,
          locale: existingProject?.locale ?? 'en',
          createdAt: existingProject?.createdAt ?? now,
          updatedAt: now,
          originalPdfRef: file.name,
          pageRenderRefs: [],
          pages: reindexed,
          fonts: existingProject?.fonts ?? [],
          history: [],
          metadata: {
            pageCount: reindexed.length,
            totalElements: reindexed.reduce((s, p) => s + p.elements.length, 0),
            languages: ['en'],
            hasTables: reindexed.some((p) => p.elements.some((e) => e.type === 'table')),
            hasForms: false,
            hasScannedPages: reindexed.some((p) => p.pageType === 'scanned'),
          },
          trackChanges: [],
          comments: [],
        };
        setProject(rebuiltProject);
        markDirty();
        try {
          await saveProjectData(rebuiltProject);
        } catch (e) {
          console.error('Failed to save project:', e);
        }

        setIsLoading(false);
        onEnterEditor();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load PDF: ${message}`);
        setIsLoading(false);
      }
    },
    [setProject, markDirty, onEnterEditor]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  function handleStartRename() {
    setRenameValue(project.name);
    setIsRenaming(true);
  }

  async function handleConfirmRename() {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setIsRenaming(false);
      setRenameValue('');
      return;
    }
    useEditorStore.setState({ project: { ...project, name: trimmed } });
    await renameProjectData(project.id, trimmed);
    setIsRenaming(false);
    setRenameValue('');
  }

  function handleCancelRename() {
    setIsRenaming(false);
    setRenameValue('');
  }

  // Group pages by their originalPdfRef to show "PDFs worked with"
  // Since pages don't store their source PDF name individually,
  // we show page thumbnails grouped in chunks (heuristic: by pageType changes or just all together)
  const pdfName = project.originalPdfRef || project.name;

  return (
    <div className="min-h-screen bg-app-bg text-text-primary relative">
      {/* Background ambient gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-gold/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-app-bg/70 border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-1.5 text-text-tertiary hover:bg-app-hover rounded"
              title="Back to Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="relative">
              <div className="absolute inset-0 bg-gold blur-md opacity-50" />
              <FileText className="h-5 w-5 text-gold relative" />
            </div>
            <span className="text-base font-bold text-shimmer">BornoOCR</span>
          </div>
          {isRenaming ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmRename();
                  if (e.key === 'Escape') handleCancelRename();
                }}
                className="bg-app-elevated border border-gold/40 rounded px-2 py-0.5 text-sm text-text-primary focus:outline-none focus:border-gold w-48"
              />
              <button onClick={handleConfirmRename} className="p-1 text-status-success hover:bg-app-hover rounded" title="Confirm">
                <Check size={14} />
              </button>
              <button onClick={handleCancelRename} className="p-1 text-text-tertiary hover:bg-app-hover rounded" title="Cancel">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartRename}
              className="group flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
              title="Click to rename"
            >
              <span className="truncate max-w-[200px]">{project.name}</span>
              <Pencil size={12} className="opacity-0 group-hover:opacity-100 text-text-tertiary" />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 relative">
        {/* Project title */}
        <div className="mb-8">
          {isRenaming ? (
            <div className="flex items-center gap-2 mb-1">
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmRename();
                  if (e.key === 'Escape') handleCancelRename();
                }}
                className="bg-app-elevated border border-gold/40 rounded-lg px-3 py-1.5 text-2xl md:text-3xl font-extrabold text-text-primary focus:outline-none focus:border-gold"
              />
              <button onClick={handleConfirmRename} className="p-2 text-status-success hover:bg-app-hover rounded-lg" title="Confirm">
                <Check className="h-5 w-5" />
              </button>
              <button onClick={handleCancelRename} className="p-2 text-text-tertiary hover:bg-app-hover rounded-lg" title="Cancel">
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <h1 className="text-2xl md:text-3xl font-extrabold mb-1 flex items-center gap-2 group cursor-text" onClick={handleStartRename}>
              {project.name}
              <Pencil className="h-4 w-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
            </h1>
          )}
          <p className="text-text-secondary text-sm">
            {pageCount > 0
              ? `${pageCount} pages · ${totalElements} elements`
              : 'No PDFs uploaded yet. Upload one to start editing.'}
          </p>
        </div>

        {/* Existing content */}
        {hasContent && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileImage className="h-5 w-5 text-gold" />
                Your Document
              </h2>
              <button
                onClick={onEnterEditor}
                className="flex items-center gap-2 px-4 py-2 rounded-8 bg-gold text-text-on-gold font-semibold text-sm hover:bg-gold-hover transition-colors"
              >
                <Edit3 className="h-4 w-4" />
                Open in Editor
              </button>
            </div>

            {/* Page thumbnails grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {project.pages.slice(0, 16).map((page, idx) => (
                <button
                  key={page.id}
                  onClick={onEnterEditor}
                  className="group relative aspect-[3/4] rounded-8 bg-gradient-to-br from-app-elevated to-app-canvas border border-white/[0.06] hover:border-gold/40 transition-all hover:-translate-y-0.5 flex flex-col items-center justify-center"
                >
                  <FileText className="h-6 w-6 text-gold/40 group-hover:text-gold/70 transition-colors" />
                  <span className="absolute bottom-1.5 right-1.5 text-[10px] text-text-tertiary font-medium">
                    {idx + 1}
                  </span>
                </button>
              ))}
              {project.pages.length > 16 && (
                <div className="aspect-[3/4] rounded-8 bg-app-panel border border-white/[0.06] flex items-center justify-center">
                  <span className="text-xs text-text-tertiary">+{project.pages.length - 16}</span>
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-text-tertiary">
              Source: {pdfName}
            </div>
          </div>
        )}

        {/* Upload section */}
        <div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-gold" />
            {hasContent ? 'Upload More PDFs' : 'Upload a PDF to Start'}
          </h2>

          <label
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-12 border-2 border-dashed transition-colors ${
              isLoading
                ? 'border-app-border bg-app-panel cursor-wait p-12'
                : isDragging
                  ? 'border-gold bg-gold-muted p-16'
                  : 'border-app-border bg-app-panel hover:border-text-tertiary p-16'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={onFileInput}
              disabled={isLoading}
            />
            {isLoading ? (
              <div className="w-full text-center">
                <ScanLine size={40} className="mx-auto mb-4 text-gold animate-pulse" />
                <p className="text-base font-medium text-text-primary mb-1">OCR Processing</p>
                <p className="text-sm text-text-secondary mb-4 truncate max-w-sm mx-auto">{fileName}</p>
                <div className="w-full max-w-sm mx-auto mb-3">
                  <div className="h-2 rounded-full bg-app-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gold transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm text-text-secondary">{progressMsg}</p>
                <p className="text-xs text-text-tertiary mt-2">{progressPct}%</p>
                <p className="text-xs text-text-tertiary mt-6 max-w-xs mx-auto">
                  Reading every page with OCR (Bangla + English).
                </p>
              </div>
            ) : (
              <>
                <Upload size={48} className="mb-4 text-gold" />
                <p className="text-lg font-medium text-text-primary">
                  {hasContent ? 'Import another PDF' : 'Import PDF'}
                </p>
                <p className="mt-2 text-sm text-text-tertiary">
                  Click to select or drag & drop
                </p>
              </>
            )}
          </label>

          {error && (
            <p className="mt-4 text-center text-sm text-status-danger">{error}</p>
          )}
        </div>
      </main>
    </div>
  );
}
