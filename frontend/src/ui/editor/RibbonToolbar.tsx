import { useState } from 'react';
import { useEditorStore } from '@state/editor-store';
import {
  Table as TableIcon, Image as ImageIcon,
  Undo2, Redo2, ZoomIn, ZoomOut, FileText, MessageSquare, Eye,
  Type as TypeIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TextBlock } from '@model/document-model';

type RibbonTab = 'insert' | 'layout' | 'review';

interface RibbonButtonProps {
  icon: LucideIcon;
  label?: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function RibbonButton({ icon: Icon, label, onClick, active, disabled, size = 'md' }: RibbonButtonProps) {
  const pad = size === 'sm' ? 'px-1.5 py-1' : size === 'lg' ? 'px-3 py-2' : 'px-2 py-1.5';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 rounded ${pad} text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? 'bg-gold/15 text-gold' : 'text-text-secondary hover:bg-app-hover hover:text-text-primary'
      }`}
      title={label}
    >
      <Icon size={size === 'lg' ? 20 : 16} />
      {label && size === 'lg' && <span>{label}</span>}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-12 w-px bg-app-border" />;
}

export function RibbonToolbar() {
  const [activeTab, setActiveTab] = useState<RibbonTab>('insert');
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const {
    project, currentPageIndex, zoom, setZoom,
    undo, redo, canUndo, canRedo,
    addTextBlockAtEnd, selectElement, addPage,
    setPageMargins, setPageHeader, setPageFooter, togglePageNumber,
  } = useEditorStore();

  const page = project?.pages[currentPageIndex];

  const handleNewText = () => {
    const id = addTextBlockAtEnd(currentPageIndex, '');
    selectElement(id);
  };

  const tabs: { id: RibbonTab; label: string }[] = [
    { id: 'insert', label: 'Insert' },
    { id: 'layout', label: 'Layout' },
    { id: 'review', label: 'Review' },
  ];

  return (
    <div className="flex flex-col border-b border-app-border bg-app-panel">
      {/* Tab strip */}
      <div className="flex items-center gap-0 px-2 pt-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-gold text-gold'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 pr-2">
          <button onClick={undo} disabled={!canUndo()} className="p-1 text-text-tertiary hover:bg-app-hover rounded disabled:opacity-30" title="Undo">
            <Undo2 size={16} />
          </button>
          <button onClick={redo} disabled={!canRedo()} className="p-1 text-text-tertiary hover:bg-app-hover rounded disabled:opacity-30" title="Redo">
            <Redo2 size={16} />
          </button>
        </div>
      </div>

      {/* Ribbon content */}
      <div className="flex items-start gap-1 px-2 py-1.5 min-h-[72px]">
        {activeTab === 'insert' && (
          <>
            <RibbonButton icon={TypeIcon} label="Text Box" onClick={handleNewText} size="lg" />
            <Divider />
            <RibbonButton icon={TableIcon} label="Table" onClick={() => setShowTableModal(true)} size="lg" />
            <RibbonButton icon={ImageIcon} label="Picture" onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = () => {
                const file = input.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const src = reader.result as string;
                  const img = new Image();
                  img.onload = () => {
                    const maxW = (page?.width ?? 595) - 144;
                    const scale = Math.min(1, maxW / img.naturalWidth);
                    const el = {
                      id: crypto.randomUUID(),
                      type: 'image' as const,
                      bbox: { x: 72, y: 72, width: img.naturalWidth * scale, height: img.naturalHeight * scale },
                      transform: { rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 },
                      zIndex: page?.elements.length ?? 0,
                      locked: false, visible: true, sourceType: 'added' as const, confidence: null,
                      src, format: file.type.split('/')[1], naturalWidth: img.naturalWidth,
                      naturalHeight: img.naturalHeight, opacity: 1,
                    };
                    useEditorStore.getState().addElement(currentPageIndex, el);
                    selectElement(el.id);
                  };
                  img.src = src;
                };
                reader.readAsDataURL(file);
              };
              input.click();
            }} size="lg" />
            <Divider />
            <RibbonButton icon={FileText} label="Page Break" onClick={() => addPage()} size="lg" />
          </>
        )}

        {activeTab === 'layout' && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-text-tertiary">Page Setup</span>
              <div className="flex items-center gap-1">
                <select
                  value={page?.width ?? 595}
                  onChange={(e) => {
                    if (!project) return;
                    const w = Number(e.target.value);
                    const h = w === 595 ? 841 : w === 842 ? 595 : 841;
                    useEditorStore.setState(s => ({
                      project: s.project ? {
                        ...s.project,
                        pages: s.project.pages.map((p, i) =>
                          i === currentPageIndex ? { ...p, width: w, height: h } : p
                        ),
                      } : s.project,
                      isDirty: true,
                    }));
                  }}
                  className="h-7 rounded border border-app-border bg-app-elevated px-1 text-xs text-text-primary"
                >
                  <option value={595}>A4 Portrait</option>
                  <option value={842}>A4 Landscape</option>
                  <option value={612}>Letter Portrait</option>
                  <option value={792}>Letter Landscape</option>
                </select>
              </div>
            </div>
            <Divider />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-text-tertiary">Margins</span>
              <select
                value={page?.margins?.top ?? 72}
                onChange={(e) => {
                  const preset = e.target.value;
                  const margins = preset === '48' ? { top: 48, bottom: 48, left: 48, right: 48 }
                    : preset === '72' ? { top: 72, bottom: 72, left: 72, right: 72 }
                    : { top: 108, bottom: 108, left: 108, right: 108 };
                  setPageMargins(currentPageIndex, margins);
                }}
                className="h-7 rounded border border-app-border bg-app-elevated px-1 text-xs text-text-primary"
              >
                <option value={72}>Normal</option>
                <option value={48}>Narrow</option>
                <option value={108}>Wide</option>
              </select>
            </div>
            <Divider />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-text-tertiary">Header / Footer</span>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Header..."
                  value={page?.header ?? ''}
                  onChange={(e) => setPageHeader(currentPageIndex, e.target.value)}
                  className="h-7 w-24 rounded border border-app-border bg-app-elevated px-1 text-xs text-text-primary"
                />
                <input
                  type="text"
                  placeholder="Footer..."
                  value={page?.footer ?? ''}
                  onChange={(e) => setPageFooter(currentPageIndex, e.target.value)}
                  className="h-7 w-24 rounded border border-app-border bg-app-elevated px-1 text-xs text-text-primary"
                />
                <button
                  onClick={() => togglePageNumber(currentPageIndex, !(page?.showPageNumber ?? false))}
                  className={`h-7 px-2 rounded border border-app-border text-xs ${page?.showPageNumber ? 'bg-gold/15 text-gold' : 'bg-app-elevated text-text-secondary'}`}
                >#</button>
              </div>
            </div>
            <Divider />
            <div className="flex items-center gap-0.5">
              <RibbonButton icon={ZoomOut} onClick={() => setZoom(zoom - 0.1)} size="sm" />
              <span className="w-12 text-center text-[11px] text-text-secondary">{Math.round(zoom * 100)}%</span>
              <RibbonButton icon={ZoomIn} onClick={() => setZoom(zoom + 0.1)} size="sm" />
            </div>
          </>
        )}

        {activeTab === 'review' && (
          <>
            <RibbonButton icon={Eye} label="Word Count" onClick={() => {
              if (!project) return;
              let words = 0;
              project.pages.forEach(p => {
                p.elements.forEach(el => {
                  if (el.type === 'text') {
                    (el as TextBlock).paragraphs.forEach(para => {
                      para.runs.forEach(run => {
                        words += run.text.split(/\s+/).filter(Boolean).length;
                      });
                    });
                  }
                });
              });
              alert(`Words: ${words}\nPages: ${project.pages.length}`);
            }} size="lg" />
            <Divider />
            <RibbonButton icon={FileText} label="OCR" onClick={() => {
              const event = new CustomEvent('toggle-ocr-panel');
              window.dispatchEvent(event);
            }} size="lg" />
            <Divider />
            <RibbonButton icon={Eye} label="Track Changes" onClick={() => {
              const event = new CustomEvent('toggle-track-changes');
              window.dispatchEvent(event);
            }} size="lg" />
            <RibbonButton icon={MessageSquare} label="Comments" onClick={() => {
              const event = new CustomEvent('toggle-comments');
              window.dispatchEvent(event);
            }} size="lg" />
            <Divider />
            <RibbonButton icon={FileText} label="Print Preview" onClick={() => {
              const event = new CustomEvent('toggle-print-preview');
              window.dispatchEvent(event);
            }} size="lg" />
          </>
        )}
      </div>

      {/* Table size modal */}
      {showTableModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowTableModal(false)}
        >
          <div
            className="bg-app-panel rounded-lg border border-app-border p-6 shadow-xl"
            style={{ minWidth: 280 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-text-primary mb-4">Insert Table</h3>
            <div className="flex items-center gap-4 mb-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary">Rows</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.max(1, Math.min(20, Number(e.target.value))))}
                  className="h-8 w-20 rounded border border-app-border bg-app-elevated px-2 text-sm text-text-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary">Columns</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={tableCols}
                  onChange={(e) => setTableCols(Math.max(1, Math.min(10, Number(e.target.value))))}
                  className="h-8 w-20 rounded border border-app-border bg-app-elevated px-2 text-sm text-text-primary"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowTableModal(false)}
                className="px-3 py-1.5 text-xs rounded border border-app-border text-text-secondary hover:bg-app-hover"
              >Cancel</button>
              <button
                onClick={() => {
                  setShowTableModal(false);
                  import('@engine/table-utils').then(({ createTableElement }) => {
                    const el = createTableElement(72, 72, tableRows, tableCols);
                    useEditorStore.getState().addElement(currentPageIndex, el);
                    selectElement(el.id);
                  });
                }}
                className="px-3 py-1.5 text-xs rounded bg-gold text-black font-medium hover:bg-gold/90"
              >Insert</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
