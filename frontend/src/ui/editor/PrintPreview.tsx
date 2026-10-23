import { useEffect } from 'react';
import { useEditorStore } from '@state/editor-store';
import { fontIdToFamily, listMarker } from '@engine/rich-text-utils';
import type { TextBlock, TableElement, ImageElement, Page } from '@model/document-model';
import { X, Printer } from 'lucide-react';

interface PrintPreviewProps {
  onClose: () => void;
}

function PrintPageContent({ page }: { page: Page }) {
  const margins = page.margins ?? { top: 72, bottom: 72, left: 72, right: 72 };

  return (
    <div
      className="print-page-break relative bg-white shadow-lg mx-auto mb-4"
      style={{
        width: `${page.width}px`,
        minHeight: `${page.height}px`,
        padding: `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`,
        boxSizing: 'border-box',
      }}
    >
      {page.header && (
        <div className="absolute left-0 right-0 text-[10px] text-gray-500 border-b border-gray-200"
          style={{ top: `${margins.top * 0.5}px`, left: `${margins.left}px`, right: `${margins.right}px`, padding: '2px 0' }}>
          <div className="flex justify-between items-center">
            <span>{page.header}</span>
            {page.showPageNumber !== false && <span>{page.index + 1}</span>}
          </div>
        </div>
      )}

      {page.elements.map(el => {
        if (el.type === 'text') {
          const block = el as TextBlock;
          return (
            <div key={el.id} style={{ marginBottom: '8px' }}>
              {block.paragraphs.map((p, pi) => (
                <div
                  key={p.id}
                  style={{
                    margin: `0 0 ${p.spaceAfter}px 0`,
                    textAlign: p.alignment,
                    lineHeight: p.lineHeight,
                    marginLeft: p.indent ? `${p.indent}px` : undefined,
                  }}
                >
                  {p.listType && p.listType !== 'none' && (
                    <span style={{ color: '#888', marginRight: '4px' }}>
                      {listMarker(p.listType, pi)}
                    </span>
                  )}
                  {p.runs.map((run, ri) => {
                    const css: React.CSSProperties = {
                      fontFamily: fontIdToFamily(run.style.fontId),
                      fontSize: `${run.style.fontSize}pt`,
                      fontWeight: run.style.fontWeight,
                      fontStyle: run.style.fontStyle,
                      textDecoration: [
                        run.style.underline ? 'underline' : '',
                        run.style.strikethrough ? 'line-through' : '',
                      ].filter(Boolean).join(' ') || 'none',
                      color: run.style.color,
                    };
                    return <span key={ri} style={css}>{run.text}</span>;
                  })}
                </div>
              ))}
            </div>
          );
        }
        if (el.type === 'table') {
          const table = el as TableElement;
          return (
            <div key={el.id} style={{ overflowX: 'auto', margin: '8px 0' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11pt' }}>
                <tbody>
                  {Array.from({ length: table.rows.length }).map((_, ri) => (
                    <tr key={ri} style={{ height: `${table.rows[ri]?.height ?? 24}px` }}>
                      {Array.from({ length: table.columns.length }).map((_, ci) => {
                        const cell = table.cells.find(c => c.rowIndex === ri && c.colIndex === ci);
                        return (
                          <td key={ci} style={{
                            border: '1px solid #ccc', padding: '4px 8px',
                            fontFamily: fontIdToFamily(cell?.style.fontFamily ?? 'inter-regular'),
                            fontSize: `${cell?.style.fontSize ?? 11}pt`,
                            fontWeight: cell?.style.fontWeight ?? 400,
                            color: cell?.style.color ?? '#000',
                            textAlign: cell?.style.alignment ?? 'left',
                            backgroundColor: cell?.style.fill ?? 'transparent',
                          }}>
                            {cell?.value ?? ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (el.type === 'image') {
          const img = el as ImageElement;
          return (
            <div key={el.id} style={{ textAlign: 'center', margin: '8px 0' }}>
              <img src={img.src} alt="" style={{ maxWidth: '100%', opacity: img.opacity }} />
            </div>
          );
        }
        return null;
      })}

      {page.footer && (
        <div className="absolute left-0 right-0 text-[10px] text-gray-500 border-t border-gray-200"
          style={{ bottom: `${margins.bottom * 0.5}px`, left: `${margins.left}px`, right: `${margins.right}px`, padding: '2px 0' }}>
          {page.footer}
        </div>
      )}
    </div>
  );
}

export function PrintPreview({ onClose }: PrintPreviewProps) {
  const { project } = useEditorStore();

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'print-preview-style';
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        .print-preview-container * { visibility: visible; }
        .print-preview-container { position: absolute; left: 0; top: 0; width: 100%; }
        .print-page-break { page-break-after: always; box-shadow: none !important; margin: 0 !important; }
        .print-page-break:last-child { page-break-after: auto; }
        .no-print { display: none !important; }
      }
    `;
    if (!document.getElementById('print-preview-style')) {
      document.head.appendChild(style);
    }
    return () => {
      const s = document.getElementById('print-preview-style');
      if (s) s.remove();
    };
  }, []);

  if (!project) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-app-bg overflow-auto flex flex-col">
      <div className="no-print flex items-center justify-between px-4 py-2 border-b border-app-border bg-app-panel">
        <span className="text-sm font-medium text-gold">Print Preview — {project.name}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs bg-gold text-text-on-gold px-3 py-1.5 rounded"
          >
            <Printer size={14} /> Print
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:bg-app-hover px-3 py-1.5 rounded"
          >
            <X size={14} /> Close
          </button>
        </div>
      </div>

      <div className="print-preview-container flex-1 overflow-auto py-6 px-4">
        {project.pages.map(page => (
          <PrintPageContent key={page.id} page={page} />
        ))}
      </div>
    </div>
  );
}
