import { useAuth } from '@state/auth-context';
import { requestUpgrade } from '../../lib/upgrade';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditorStore } from '@state/editor-store';
import { CollaboraEditor } from './CollaboraEditor';
import { StatusBar } from './StatusBar';
import { UploadDropzone } from './UploadDropzone';
import { ProjectStartScreen } from './ProjectStartScreen';
import { OcrCorrectionPanel } from './OcrCorrectionPanel';
import { AnnotationsPanel } from './AnnotationsPanel';
import { TrackChangesPanel } from './TrackChangesPanel';
import { CommentsPanel } from './CommentsPanel';
import { PrintPreview } from './PrintPreview';
import { importDocx } from '@engine/import-docx';
import { loadPdf } from '@engine/pdf-renderer';
import { importPdfToElements } from '@engine/pdf-to-elements';
import { downloadProjectDocx } from '@engine/docx-exporter';
import { setPdfDocument } from './UploadDropzone';
import { saveProjectData, loadProjectData, isProjectDeleted, renameProjectData } from '@engine/project-service';
import {
  ArrowLeft, Save, Loader2, Upload, Share, Crown, FileDown, FileText,
  Check, Languages, MessageSquare, Clock, Printer, FileUp, FileImage, ScanLine,
  Pencil, X,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { api } from '../../api/client';
import type { TextBlock, PageElement, DocFlowProject } from '@model/document-model';
import { SCHEMA_VERSION } from '@model/document-model';

interface OcrWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  elementId: string;
  runIndex: number;
  paragraphIndex: number;
}

function extractOcrWords(elements: PageElement[]): OcrWord[] {
  const words: OcrWord[] = [];
  for (const el of elements) {
    if (el.type !== 'text') continue;
    const textBlock = el as TextBlock;
    if (textBlock.sourceType !== 'ocr') continue;
    const conf = textBlock.confidence ?? 0;
    textBlock.paragraphs.forEach((para, pIdx) => {
      para.runs.forEach((run, rIdx) => {
        const runText = run.text;
        if (!runText.trim()) return;
        const wordsInRun = runText.split(/\s+/);
        let charOffset = 0;
        const blockX = textBlock.bbox.x;
        const blockY = textBlock.bbox.y;
        const blockW = textBlock.bbox.width;
        const approxCharW = blockW / Math.max(runText.length, 1);
        for (const w of wordsInRun) {
          if (!w) {
            charOffset += 1;
            continue;
          }
          const wordStart = runText.indexOf(w, charOffset);
          const wordWidth = w.length * approxCharW;
          words.push({
            text: w,
            x: blockX + wordStart * approxCharW,
            y: blockY + (pIdx * 20),
            width: wordWidth,
            height: textBlock.bbox.height / Math.max(textBlock.paragraphs.length, 1),
            confidence: conf,
            elementId: textBlock.id,
            runIndex: rIdx,
            paragraphIndex: pIdx,
          });
          charOffset = wordStart + w.length;
        }
      });
    });
  }
  return words;
}

export function EditorPage() {
  const { isEmbed } = useAuth();
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const { locale, toggleLocale } = useTranslation();
  const project = useEditorStore((s) => s.project);
  const cloudProjectId = useEditorStore((s) => s.cloudProjectId);
  const updateElement = useEditorStore((s) => s.updateElement);
  const markDirty = useEditorStore((s) => s.markDirty);
  const { undo, redo, saveToCloud, deleteElement, currentPageIndex, selectedElementIds, isDirty, isSaving, isExporting, exportPdf } = useEditorStore();
  const saveToStorage = useEditorStore((s) => s.saveToStorage);

  // Auto-save to local IndexedDB when project is dirty (debounced 3s)
  useEffect(() => {
    if (!isDirty || !project) return;
    if (isProjectDeleted(project.id)) {
      console.log('[editor] skipping auto-save for deleted project:', project.id);
      return;
    }
    const timer = setTimeout(() => {
      saveToStorage();
    }, 3000);
    return () => clearTimeout(timer);
  }, [isDirty, project, saveToStorage]);

  // Save to local IndexedDB before page unload
  useEffect(() => {
    if (!project) return;
    const handler = () => {
      const currentProject = useEditorStore.getState().project;
      if (currentProject && !isProjectDeleted(currentProject.id)) {
        saveProjectData(currentProject).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [project]);

  const [showStartScreen, setShowStartScreen] = useState(true);
  const [showOcrPanel, setShowOcrPanel] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showAnnotationsPanel, setShowAnnotationsPanel] = useState(false);
  const [showTrackChanges, setShowTrackChanges] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importPct, setImportPct] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [ocrCorrections, setOcrCorrections] = useState<Record<string, { pIdx: number; rIdx: number; newText: string }>>({});

  useEffect(() => {
    if (projectId && project?.id !== projectId) {
      // URL points to a different project than what's in the store —
      // clear the stale project and load the requested one.
      if (project) {
        useEditorStore.getState().setProject(null);
        useEditorStore.setState({ currentPageIndex: 0, selectedElementIds: [], selectedElementId: null });
      }
      loadProjectData(projectId).then((loaded) => {
        // Guard against race: only apply if URL still points to this project
        if (loaded && loaded.id === projectId) {
          useEditorStore.getState().setProject(loaded);
          useEditorStore.setState({ isDirty: false });
        }
      });
    }
    // Reset start screen when project ID changes
    if (projectId) {
      setShowStartScreen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const handler = () => setShowOcrPanel(prev => !prev);
    window.addEventListener('toggle-ocr-panel', handler);
    return () => window.removeEventListener('toggle-ocr-panel', handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowAnnotationsPanel(prev => !prev);
    window.addEventListener('toggle-annotations-panel', handler);
    return () => window.removeEventListener('toggle-annotations-panel', handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowTrackChanges(prev => !prev);
    window.addEventListener('toggle-track-changes', handler);
    return () => window.removeEventListener('toggle-track-changes', handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowComments(prev => !prev);
    window.addEventListener('toggle-comments', handler);
    return () => window.removeEventListener('toggle-comments', handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowPrintPreview(prev => !prev);
    window.addEventListener('toggle-print-preview', handler);
    return () => window.removeEventListener('toggle-print-preview', handler);
  }, []);

  const ocrWords = useMemo(() => {
    if (!project) return [];
    const page = project.pages[currentPageIndex];
    if (!page) return [];
    return extractOcrWords(page.elements);
  }, [project, currentPageIndex]);

  const handleCorrectWord = useCallback((index: number, newText: string) => {
    const word = ocrWords[index];
    if (!word) return;
    setOcrCorrections((prev) => ({
      ...prev,
      [`${word.elementId}:${word.paragraphIndex}:${word.runIndex}`]: {
        pIdx: word.paragraphIndex,
        rIdx: word.runIndex,
        newText,
      },
    }));
  }, [ocrWords]);

  const handleApplyCorrections = useCallback(() => {
    const elementIds = new Set<string>();
    for (const key of Object.keys(ocrCorrections)) {
      elementIds.add(key.split(':')[0]);
    }
    for (const elementId of elementIds) {
      if (!project) break;
      const page = project.pages[currentPageIndex];
      if (!page) continue;
      const el = page.elements.find((e) => e.id === elementId);
      if (!el || el.type !== 'text') continue;
      const textBlock = el as TextBlock;
      const newParagraphs = textBlock.paragraphs.map((para, pIdx) => {
        const newRuns = para.runs.map((run, rIdx) => {
          const correction = ocrCorrections[`${elementId}:${pIdx}:${rIdx}`];
          if (correction) {
            const words = run.text.split(/\s+/);
            const wordIdx = ocrWords.findIndex(
              (w) => w.elementId === elementId && w.paragraphIndex === pIdx && w.runIndex === rIdx
            );
            if (wordIdx >= 0) {
              words[0] = correction.newText;
              return { ...run, text: words.join(' ') };
            }
          }
          return run;
        });
        return { ...para, runs: newRuns };
      });
      updateElement(currentPageIndex, elementId, { paragraphs: newParagraphs } as Partial<TextBlock>);
    }
    setOcrCorrections({});
    markDirty();
    setShowOcrPanel(false);
  }, [ocrCorrections, project, currentPageIndex, ocrWords, updateElement, markDirty]);

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
    if (!project) return;
    try {
      await downloadProjectDocx(project);
    } catch (err) {
      console.error('DOCX export failed:', err);
      alert('Failed to export DOCX. Please try again.');
    }
    setShowExportMenu(false);
  };

  const handleImportPdf = async (file: File) => {
    setImporting(true);
    setShowImportMenu(false);
    setImportProgress('Starting OCR…');
    setImportPct(0);
    try {
      const result = await loadPdf(file);
      setPdfDocument(result.document);
      const { pages } = await importPdfToElements(result.document, (status, pct) => {
        setImportProgress(status);
        setImportPct(pct);
      });
      const { project, setProject } = useEditorStore.getState();
      const totalElements = pages.reduce((sum, p) => sum + p.elements.length, 0);
      const now = new Date().toISOString();
      const reindexed = pages.map((p, i) => ({ ...p, index: i }));
      const newProject: DocFlowProject = {
        id: project && !isProjectDeleted(project.id) ? project.id : crypto.randomUUID(),
        schemaVersion: SCHEMA_VERSION,
        name: project?.name ?? file.name,
        locale: project?.locale ?? 'en',
        createdAt: project?.createdAt ?? now,
        updatedAt: now,
        originalPdfRef: file.name,
        pageRenderRefs: [],
        pages: reindexed,
        fonts: project?.fonts ?? [],
        history: [],
        metadata: {
          pageCount: reindexed.length,
          totalElements,
          languages: ['en'],
          hasTables: false,
          hasForms: false,
          hasScannedPages: reindexed.some((p) => p.pageType === 'scanned'),
        },
      };
      setProject(newProject);
      markDirty();
      await saveProjectData(newProject);
    } catch (err) {
      console.error('PDF import failed:', err);
      alert('Failed to import PDF. Please ensure it is a valid PDF file.');
    } finally {
      setImporting(false);
    }
  };

  const handleImportDocx = async (file: File) => {
    setImporting(true);
    setShowImportMenu(false);
    try {
      const imported = await importDocx(file);
      const { appendPagesToProject, project, setProject } = useEditorStore.getState();
      if (project && !isProjectDeleted(project.id) && imported.pages) {
        appendPagesToProject(imported.pages);
        markDirty();
        const updated = useEditorStore.getState().project;
        if (updated) await saveProjectData(updated);
      } else {
        const newProject = {
          id: crypto.randomUUID(),
          schemaVersion: 1 as const,
          name: imported.name ?? file.name,
          locale: 'en',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          originalPdfRef: '',
          pageRenderRefs: [],
          pages: imported.pages ?? [],
          fonts: [],
          history: [],
          metadata: imported.metadata ?? {
            pageCount: 1, totalElements: 1, languages: ['en'],
            hasTables: false, hasForms: false, hasScannedPages: false,
          },
          trackChanges: [],
          comments: [],
        };
        setProject(newProject);
        await saveProjectData(newProject);
      }
    } catch (err) {
      console.error('DOCX import failed:', err);
      alert('Failed to import .docx file. Please ensure it is a valid Word document.');
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
        else if (e.key === 's') { e.preventDefault(); if (isDirty) saveToCloud(); }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementIds.length > 0 && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target as HTMLElement).isContentEditable) {
          e.preventDefault();
          selectedElementIds.forEach(id => deleteElement(currentPageIndex, id));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, saveToCloud, deleteElement, currentPageIndex, selectedElementIds, isDirty]);

  function handleStartRename() {
    setRenameValue(project?.name ?? '');
    setIsRenaming(true);
  }

  async function handleConfirmRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || !project) {
      setIsRenaming(false);
      setRenameValue('');
      return;
    }
    useEditorStore.setState({ project: { ...project, name: trimmed } });
    await renameProjectData(project.id, trimmed);
    setIsRenaming(false);
    setRenameValue('');
  }

  if (!project) {
    return <UploadDropzone cloudProjectId={projectId ?? cloudProjectId} />;
  }

  // Show project start screen: lists existing PDFs + upload option
  if (showStartScreen) {
    return (
      <ProjectStartScreen
        project={project}
        onEnterEditor={() => setShowStartScreen(false)}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-app-bg">
      {/* Title bar */}
      <header className="flex h-12 items-center justify-between border-b border-app-border bg-app-panel px-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-1.5 text-text-tertiary hover:bg-app-hover rounded"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-base font-bold text-gold">BornoOCR</span>
          {isRenaming ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmRename();
                  if (e.key === 'Escape') { setIsRenaming(false); setRenameValue(''); }
                }}
                className="bg-app-elevated border border-gold/40 rounded px-2 py-0.5 text-sm text-text-primary focus:outline-none focus:border-gold w-48"
              />
              <button onClick={handleConfirmRename} className="p-1 text-status-success hover:bg-app-hover rounded" title="Confirm">
                <Check size={14} />
              </button>
              <button onClick={() => { setIsRenaming(false); setRenameValue(''); }} className="p-1 text-text-tertiary hover:bg-app-hover rounded" title="Cancel">
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
          <span className={`text-xs ${isDirty ? 'text-status-warning' : 'text-status-success'}`}>
            {isSaving ? '● Saving...' : isDirty ? '● Unsaved' : '● Saved'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleLocale}
            className="p-1.5 text-text-tertiary hover:bg-app-hover rounded"
            title={locale === 'en' ? 'বাংলা' : 'English'}
          >
            <Languages size={16} />
          </button>
          <button
            onClick={() => setShowAnnotationsPanel(!showAnnotationsPanel)}
            className={`p-1.5 rounded ${showAnnotationsPanel ? 'text-gold bg-gold/15' : 'text-text-tertiary hover:bg-app-hover'}`}
            title="Annotations"
          >
            <MessageSquare size={16} />
          </button>
          <button
            onClick={() => setShowTrackChanges(!showTrackChanges)}
            className={`p-1.5 rounded ${showTrackChanges ? 'text-gold bg-gold/15' : 'text-text-tertiary hover:bg-app-hover'}`}
            title="Track Changes"
          >
            <Clock size={16} />
          </button>
          <button
            onClick={() => setShowComments(!showComments)}
            className={`p-1.5 rounded ${showComments ? 'text-gold bg-gold/15' : 'text-text-tertiary hover:bg-app-hover'}`}
            title="Comments"
          >
            <MessageSquare size={16} />
          </button>
          <button
            onClick={() => setShowPrintPreview(true)}
            className="p-1.5 text-text-tertiary hover:bg-app-hover rounded"
            title="Print Preview"
          >
            <Printer size={16} />
          </button>
          <div className="mx-1 h-5 w-px bg-app-border" />
          <button
            onClick={saveToCloud}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-app-hover rounded disabled:opacity-40"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-on-gold bg-gold hover:bg-gold-hover rounded disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Export
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-app-border bg-app-panel shadow-xl">
                  <button
                    onClick={() => { exportPdf(); setShowExportMenu(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-text-primary hover:bg-app-hover"
                  >
                    <FileDown size={14} /> Export PDF
                  </button>
                  <button
                    onClick={handleExportDocx}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-text-primary hover:bg-app-hover border-t border-app-border"
                  >
                    <FileText size={14} /> Export DOCX
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowImportMenu(!showImportMenu)}
              disabled={importing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-app-hover rounded disabled:opacity-50"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
              Import
            </button>
            {showImportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowImportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-app-border bg-app-panel shadow-xl">
                  <label className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-text-primary hover:bg-app-hover cursor-pointer">
                    <FileImage size={14} /> Import PDF
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportPdf(file);
                      }}
                    />
                  </label>
                  <label className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-text-primary hover:bg-app-hover cursor-pointer border-t border-app-border">
                    <FileText size={14} /> Import .docx
                    <input
                      type="file"
                      accept=".docx"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportDocx(file);
                      }}
                    />
                  </label>
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <button
              onClick={handleShare}
              disabled={shareLoading || !cloudProjectId}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-app-hover rounded disabled:opacity-50"
            >
              {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Share size={14} />}
              Share
            </button>
            {shareUrl && (
              <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-lg border border-app-border bg-app-panel shadow-xl p-3">
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
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                  className="w-full mt-2 text-xs bg-gold text-text-on-gold font-medium py-1.5 rounded"
                >
                  Copy Link
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => (isEmbed ? requestUpgrade() : navigate('/pricing'))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gold hover:bg-gold/15 rounded"
          >
            <Crown size={14} /> Upgrade
          </button>
        </div>
      </header>

      {/* Main editing area — Collabora Online (LibreOffice in browser) */}
      <div className="flex flex-1 overflow-hidden">
        <CollaboraEditor />
        {showOcrPanel && (
          <OcrCorrectionPanel
            ocrWords={ocrWords}
            onCorrectWord={handleCorrectWord}
            onApplyCorrections={handleApplyCorrections}
            onClose={() => setShowOcrPanel(false)}
          />
        )}
        {showAnnotationsPanel && cloudProjectId && (
          <AnnotationsPanel
            projectId={cloudProjectId}
            pageIndex={currentPageIndex}
            onClose={() => setShowAnnotationsPanel(false)}
          />
        )}
        {showTrackChanges && (
          <TrackChangesPanel onClose={() => setShowTrackChanges(false)} />
        )}
        {showComments && (
          <CommentsPanel onClose={() => setShowComments(false)} />
        )}
      </div>

      {/* Print preview overlay */}
      {showPrintPreview && (
        <PrintPreview onClose={() => setShowPrintPreview(false)} />
      )}

      {/* OCR import progress overlay */}
      {importing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-app-border bg-app-panel p-8 text-center shadow-2xl">
            <ScanLine size={40} className="mx-auto mb-4 text-gold animate-pulse" />
            <p className="text-base font-medium text-text-primary mb-1">OCR Processing</p>
            <p className="text-sm text-text-secondary mb-4">{importProgress}</p>
            <div className="h-2 rounded-full bg-app-border overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-gold transition-all duration-300"
                style={{ width: `${importPct}%` }}
              />
            </div>
            <p className="text-xs text-text-tertiary">{importPct}%</p>
            <p className="text-xs text-text-tertiary mt-4">
              Reading every page with OCR (Bangla + English).
            </p>
          </div>
        </div>
      )}

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
