import { useEditorStore } from '@state/editor-store';

export function StatusBar() {
  const { project, currentPageIndex, zoom, selectedElementIds } = useEditorStore();

  if (!project) return null;

  const page = project.pages[currentPageIndex];

  return (
    <footer className="flex h-7 items-center gap-4 border-t border-app-border bg-app-panel px-4 text-xs text-text-tertiary">
      <span>Page {currentPageIndex + 1} of {project.pages.length}</span>
      <span>Zoom: {Math.round(zoom * 100)}%</span>
      {selectedElementIds.length > 0 && <span>Selected: {selectedElementIds.length} element{selectedElementIds.length > 1 ? 's' : ''}</span>}
      {page.confidence < 90 && (
        <span className="text-status-warning">Confidence: {page.confidence}%</span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-status-success" />
        <span>Online</span>
      </div>
    </footer>
  );
}
