import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@state/editor-store';
import { exportProjectToDocx } from '@engine/docx-exporter';
import { importDocx } from '@engine/import-docx';
import { api } from '../../api/client';
import {
  Loader2, AlertCircle, FileText, Edit3, Check, RefreshCw, Download,
} from 'lucide-react';

type EditorState = 'loading' | 'editing' | 'saving' | 'saved' | 'error' | 'unavailable';

export function CollaboraEditor() {
  const { project, setProject, markDirty } = useEditorStore();
  const [state, setState] = useState<EditorState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [wopiFileId, setWopiFileId] = useState<string | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initKey = useRef<string | null>(null);

  // The WOPISrc URL must be reachable by the Collabora container.
  // host.docker.internal resolves to the host machine from inside Docker.
  const WOPI_HOST = window.location.hostname === 'localhost'
    ? 'http://host.docker.internal:3001'
    : window.location.origin;

  // Check Collabora availability and initialize editor
  const initEditor = useCallback(async () => {
    if (!project) return;
    // Re-init if project changed or pages were added (e.g., after OCR)
    const key = `${project.id}:${project.pages.length}`;
    if (initKey.current === key) return;
    initKey.current = key;

    setState('loading');
    setErrorMsg('');

    try {
      // 1. Check if Collabora CODE is running
      const status = await api.wopi.checkStatus();
      if (!status.available) {
        setState('unavailable');
        return;
      }

      // 2. Export project to DOCX blob
      const docxBlob = await exportProjectToDocx(project);
      const filename = project.name.replace(/\.pdf$/i, '') + '.docx';

      // 3. Upload DOCX to backend WOPI store
      const session = await api.wopi.createSession(docxBlob, filename);
      setWopiFileId(session.fileId);

      // 4. Build Collabora editor URL using the discovery-provided editorUrl
      if (!status.editorUrl) {
        throw new Error('Collabora discovery did not return an editor URL for DOCX');
      }
      const wopiSrc = encodeURIComponent(`${WOPI_HOST}/wopi/files/${session.fileId}`);
      const accessToken = encodeURIComponent(session.accessToken);
      const editorUrl = `${status.editorUrl}WOPISrc=${wopiSrc}&access_token=${accessToken}&title=${encodeURIComponent(filename)}&closebutton=1&revisionhistory=0`;

      setIframeSrc(editorUrl);
      setState('editing');
    } catch (err) {
      console.error('Collabora init failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start editor');
      setState('error');
    }
  }, [project, WOPI_HOST]);

  useEffect(() => {
    initEditor();
  }, [initEditor]);

  // Listen for PostMessage events from Collabora (save, close, etc.)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== 'string') return;

      try {
        const msg = JSON.parse(data);
        // Collabora sends messages like { MessageId: 'App_LoadingStatus', Values: { Status: 'Document_Loaded' } }
        if (msg.MessageId === 'App_LoadingStatus') {
          if (msg.Values?.Status === 'Document_Loaded') {
            setState('editing');
          }
        }
        if (msg.MessageId === 'Action_Save' || msg.MessageId === 'Doc_ModifiedStatus') {
          if (msg.Values?.modified === false) {
            setState('saved');
          }
        }
        if (msg.MessageId === 'UI_Close') {
          setState('saved');
        }
      } catch {
        // Not JSON, ignore
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Request save from Collabora via PostMessage
  const requestSave = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    setState('saving');
    const msg = JSON.stringify({ MessageId: 'Action_Save', Values: { DontSaveIfUnmodified: true } });
    iframeRef.current.contentWindow.postMessage(msg, '*');
  }, []);

  // Import the edited DOCX back into the project
  const importEditedDocx = useCallback(async () => {
    if (!wopiFileId || !project) return;
    setState('saving');
    try {
      const blob = await api.wopi.downloadEdited(wopiFileId);
      const file = new File([blob], 'edited.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const imported = await importDocx(file);
      if (imported.pages && imported.pages.length > 0) {
        const updatedProject = {
          ...project,
          pages: imported.pages,
          name: project.name,
        };
        setProject(updatedProject);
        markDirty();
        setState('saved');
      }
    } catch (err) {
      console.error('Import failed:', err);
      setErrorMsg('Failed to import edited document');
      setState('error');
    }
  }, [wopiFileId, project, setProject, markDirty]);

  // Reload editor (re-export and re-init)
  const handleReload = useCallback(() => {
    initKey.current = null;
    setIframeSrc(null);
    setWopiFileId(null);
    initEditor();
  }, [initEditor]);

  if (!project) return null;

  // --- Collabora not available ---
  if (state === 'unavailable') {
    return (
      <div className="flex flex-1 items-center justify-center bg-app-bg p-8">
        <div className="max-w-lg rounded-xl border border-app-border bg-app-panel p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
            <AlertCircle size={32} className="text-gold" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-text-primary">Online Editor Not Running</h2>
          <p className="mb-4 text-sm text-text-secondary">
            To edit documents in the browser, start the editor container:
          </p>
          <div className="mb-4 rounded-lg bg-app-bg p-4 text-left">
            <p className="mb-2 text-xs font-medium text-text-tertiary">If you have Docker installed:</p>
            <code className="block rounded bg-black/80 px-3 py-2 text-xs text-green-400 overflow-x-auto">
              docker-compose -f docker-compose.dev.yml up -d collabora
            </code>
          </div>
          <div className="mb-4 rounded-lg bg-app-bg p-4 text-left">
            <p className="mb-2 text-xs font-medium text-text-tertiary">Or run all services:</p>
            <code className="block rounded bg-black/80 px-3 py-2 text-xs text-green-400 overflow-x-auto">
              docker-compose -f docker-compose.dev.yml up -d
            </code>
          </div>
          <p className="mb-4 text-xs text-text-tertiary">
            The online editor provides a full document editor in your browser — no downloads needed.
          </p>
          <button
            onClick={handleReload}
            className="flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-text-on-gold hover:bg-gold-hover mx-auto"
          >
            <RefreshCw size={14} /> Check Again
          </button>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (state === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center bg-app-bg p-8">
        <div className="max-w-lg rounded-xl border border-status-error/30 bg-app-panel p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-error/10">
            <AlertCircle size={32} className="text-status-error" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-text-primary">Editor Error</h2>
          <p className="mb-4 text-sm text-text-secondary">{errorMsg}</p>
          <button
            onClick={handleReload}
            className="flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-text-on-gold hover:bg-gold-hover mx-auto"
          >
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  // --- Main editor view ---
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-app-bg">
      {/* Editor toolbar */}
      <div className="flex items-center gap-2 border-b border-app-border bg-app-panel px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <FileText size={16} className="text-gold" />
          {project.name}
        </div>

        {/* Status indicator */}
        <div className="ml-2 flex items-center gap-1.5 text-xs">
          {state === 'loading' && (
            <span className="flex items-center gap-1 text-text-tertiary">
              <Loader2 size={12} className="animate-spin" /> Loading editor...
            </span>
          )}
          {state === 'editing' && (
            <span className="flex items-center gap-1 text-status-success">
              <Edit3 size={12} /> Editing
            </span>
          )}
          {state === 'saving' && (
            <span className="flex items-center gap-1 text-gold">
              <Loader2 size={12} className="animate-spin" /> Saving...
            </span>
          )}
          {state === 'saved' && (
            <span className="flex items-center gap-1 text-status-success">
              <Check size={12} /> Saved
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={requestSave}
            disabled={state !== 'editing'}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-app-hover disabled:opacity-40"
            title="Save in Editor"
          >
            <Download size={14} /> Save in Editor
          </button>
          <button
            onClick={importEditedDocx}
            disabled={!wopiFileId || state === 'saving'}
            className="flex items-center gap-1.5 rounded bg-gold px-3 py-1.5 text-xs font-medium text-text-on-gold hover:bg-gold-hover disabled:opacity-50"
            title="Import edited document back into project"
          >
            {state === 'saving' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Apply to Project
          </button>
          <button
            onClick={handleReload}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-text-tertiary hover:bg-app-hover"
            title="Reload editor"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Collabora iframe */}
      <div className="relative flex-1 overflow-hidden">
        {state === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-app-bg">
            <div className="text-center">
              <Loader2 size={40} className="mx-auto mb-3 animate-spin text-gold" />
              <p className="text-sm text-text-secondary">Starting online editor...</p>
              <p className="mt-1 text-xs text-text-tertiary">Loading document into editor</p>
            </div>
          </div>
        )}
        {iframeSrc && (
          <iframe
            key={iframeSrc}
            ref={iframeRef}
            src={iframeSrc}
            className="h-full w-full border-0"
            title="BornoOCR Online Editor"
            allow="fullscreen"
            style={{ display: state === 'loading' ? 'none' : 'block' }}
          />
        )}
      </div>
    </div>
  );
}
