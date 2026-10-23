import { useState, useCallback } from 'react';
import { Upload, ScanLine } from 'lucide-react';
import { useEditorStore } from '@state/editor-store';
import { loadPdf } from '@engine/pdf-renderer';
import { importPdfToElements } from '@engine/pdf-to-elements';
import { saveProjectData, isProjectDeleted } from '@engine/project-service';
import { SCHEMA_VERSION } from '../../types/document-model';
import type { DocFlowProject } from '../../types/document-model';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface PdfState {
  pdfDocument: PDFDocumentProxy | null;
}

const pdfState: PdfState = {
  pdfDocument: null,
};

export function getPdfDocument(): PDFDocumentProxy | null {
  return pdfState.pdfDocument;
}

export function setPdfDocument(doc: PDFDocumentProxy | null): void {
  pdfState.pdfDocument = doc;
}

export function UploadDropzone({ cloudProjectId }: { cloudProjectId?: string | null }) {
  const { setProject, setCloudProjectId, markDirty } = useEditorStore();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [fileName, setFileName] = useState('');

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
        setError('File too large. Maximum 50 MB for Phase 0.');
        setIsLoading(false);
        return;
      }

      try {
        const result = await loadPdf(file);
        pdfState.pdfDocument = result.document;
        setFileName(file.name);

        // OCR the entire PDF and create editable TextBlock elements
        const { pages } = await importPdfToElements(result.document, (status, pct) => {
          setProgressMsg(status);
          setProgressPct(pct);
        });

        const totalElements = pages.reduce((sum, p) => sum + p.elements.length, 0);
        const hasScanned = pages.some((p) => p.pageType === 'scanned');

        // Replace existing project pages with freshly-imported PDF (no appending stale content)
        const existingProject = useEditorStore.getState().project;
        const projectId = (existingProject && !isProjectDeleted(existingProject.id))
          ? existingProject.id
          : cloudProjectId ?? crypto.randomUUID();
        const now = new Date().toISOString();
        const reindexed = pages.map((p, i) => ({ ...p, index: i }));

        const project: DocFlowProject = {
          id: projectId,
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
            totalElements,
            languages: ['en'],
            hasTables: false,
            hasForms: false,
            hasScannedPages: hasScanned,
          },
        };

        setProject(project);
        if (cloudProjectId) {
          setCloudProjectId(cloudProjectId);
        }
        markDirty();
        try {
          await saveProjectData(project);
        } catch (e) {
          console.error('Failed to save project:', e);
        }
        setIsLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to load PDF: ${message}`);
        setIsLoading(false);
      }
    },
    [setProject, setCloudProjectId, markDirty, cloudProjectId]
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

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-app-bg">
      <div className="w-full max-w-xl px-8">
        {!isLoading && (
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gold">BornoOCR</h1>
          </div>
        )}

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-12 border-2 border-dashed transition-colors ${
            isLoading
              ? 'border-app-border bg-app-panel cursor-wait'
              : isDragging
                ? 'border-gold bg-gold-muted'
                : 'border-app-border bg-app-panel hover:border-text-tertiary'
          } ${isLoading ? 'p-12' : 'p-16'}`}
        >
          <input
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

              {/* Progress bar */}
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
                Reading every page with OCR (Bangla + English). This may take a few seconds per page.
              </p>
            </div>
          ) : (
            <>
              <Upload size={48} className="mb-4 text-gold" />
              <p className="text-lg font-medium text-text-primary">
                Import PDF
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
    </div>
  );
}
