import { useState, useEffect } from 'react';
import { Menu, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useEditorStore } from '@state/editor-store';

export function MobileEditorControls() {
  const [showMenu, setShowMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { project, currentPageIndex, setCurrentPage, zoom, setZoom } = useEditorStore();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!isMobile || !project) return null;

  const totalPages = project.pages.length;

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => setCurrentPage(Math.max(0, currentPageIndex - 1))}
          disabled={currentPageIndex === 0}
          className="p-2 text-zinc-400 disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <span className="text-xs text-zinc-400">
          {currentPageIndex + 1} / {totalPages}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(zoom - 0.1)}
            className="p-2 text-zinc-400"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-xs text-zinc-500 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(zoom + 0.1)}
            className="p-2 text-zinc-400"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPageIndex + 1))}
          disabled={currentPageIndex === totalPages - 1}
          className="p-2 text-zinc-400 disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowMenu(true)}
          className="p-2 text-gold-500"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {showMenu && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setShowMenu(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-64 bg-zinc-900 border-l border-zinc-800 p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-100">Pages</h3>
              <button onClick={() => setShowMenu(false)} className="text-zinc-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1">
              {project.pages.map((page, idx) => (
                <button
                  key={page.id}
                  onClick={() => {
                    setCurrentPage(idx);
                    setShowMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    idx === currentPageIndex
                      ? 'bg-gold-500/20 text-gold-400 border border-gold-600/30'
                      : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  Page {idx + 1}
                  {page.pageType === 'scanned' && (
                    <span className="ml-2 text-[10px] text-amber-500">OCR</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="md:hidden h-12" />
    </>
  );
}
