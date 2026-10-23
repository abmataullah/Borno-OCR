import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { api } from '@api/client';
import type { DocFlowProject } from '@model/document-model';

export function SharedProjectPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [project, setProject] = useState<DocFlowProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (!shareToken) return;
    (async () => {
      try {
        const result = await api.public.getSharedProject(shareToken);
        if (result.projectData) {
          setProject(result.projectData as unknown as DocFlowProject);
        } else {
          setError('No project data available');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shared project');
      } finally {
        setLoading(false);
      }
    })();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 gap-4">
        <FileText className="w-12 h-12 text-zinc-600" />
        <p className="text-zinc-400">{error}</p>
        <Link to="/" className="text-gold-500 hover:text-gold-400 text-sm">
          Go to homepage
        </Link>
      </div>
    );
  }

  if (!project) return null;

  const page = project.pages[currentPage];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-zinc-500 hover:text-zinc-300">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-sm font-semibold text-zinc-100">{project.name}</h1>
          <span className="text-xs text-zinc-500 px-2 py-0.5 rounded bg-zinc-800">Shared</span>
        </div>
        <a
          href={api.public.downloadSharedProject(shareToken!)}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-black font-medium text-sm px-4 py-2 rounded transition-colors"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </a>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-32 border-r border-zinc-800 bg-zinc-900 overflow-y-auto py-2">
          {project.pages.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => setCurrentPage(idx)}
              className={`w-full flex flex-col items-center gap-1 px-2 py-2 transition-colors ${
                idx === currentPage ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
              }`}
            >
              <div className="w-20 h-28 bg-zinc-800 rounded border border-zinc-700 flex items-center justify-center">
                <FileText className="w-6 h-6 text-zinc-600" />
              </div>
              <span className="text-[10px] text-zinc-500">Page {idx + 1}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          {page && (
            <div
              className="bg-white shadow-2xl relative"
              style={{
                width: `${page.width * 0.8}px`,
                height: `${page.height * 0.8}px`,
              }}
            >
              {page.elements.map((el) => {
                if (el.type === 'text') {
                  const textBlock = el as { paragraphs: { runs: { text: string }[] }[] };
                  const text = (textBlock.paragraphs || [])
                    .map((p) => (p.runs || []).map((r) => r.text).join(''))
                    .join('\n');
                  return (
                    <div
                      key={el.id}
                      className="absolute text-black whitespace-pre-wrap"
                      style={{
                        left: `${el.bbox.x * 0.8}px`,
                        top: `${el.bbox.y * 0.8}px`,
                        width: `${el.bbox.width * 0.8}px`,
                        fontSize: '12px',
                      }}
                    >
                      {text}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      </div>

      <footer className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 bg-zinc-900 text-xs text-zinc-500">
        <span>
          Page {currentPage + 1} of {project.pages.length}
        </span>
        <span>{project.metadata.languages.join(', ')}</span>
      </footer>
    </div>
  );
}
