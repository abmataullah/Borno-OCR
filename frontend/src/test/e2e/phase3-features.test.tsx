import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SharedProjectPage } from '../../ui/shared/SharedProjectPage';

vi.mock('../../api/client', () => ({
  api: {
    public: {
      getSharedProject: vi.fn(),
      downloadSharedProject: vi.fn(() => 'http://localhost:3001/api/public/projects/token/download'),
    },
  },
}));

import { api } from '../../api/client';

function renderWithRouter(component: React.ReactNode, path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/share/:shareToken" element={component} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Shared Project Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    vi.mocked(api.public.getSharedProject).mockReturnValue(new Promise(() => {}));
    renderWithRouter(<SharedProjectPage />, '/share/test-token');
    expect(screen.getByRole('status', { hidden: true }) || document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('should show error when project not found', async () => {
    vi.mocked(api.public.getSharedProject).mockRejectedValue(new Error('Not found'));
    renderWithRouter(<SharedProjectPage />, '/share/invalid-token');
    await waitFor(() => {
      expect(screen.getByText('Not found')).toBeInTheDocument();
    });
  });

  it('should display project name and download button', async () => {
    vi.mocked(api.public.getSharedProject).mockResolvedValue({
      id: 'proj-1',
      name: 'Test Document',
      pageCount: 3,
      projectData: {
        schemaVersion: 1,
        pages: [
          {
            id: 'page-0',
            index: 0,
            width: 612,
            height: 792,
            rotation: 0,
            pageType: 'digital',
            elements: [],
            confidence: 0.9,
          },
        ],
        fonts: [],
        metadata: { pageCount: 1, totalElements: 0, languages: ['en'], hasTables: false, hasForms: false, hasScannedPages: false },
      } as never,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    renderWithRouter(<SharedProjectPage />, '/share/test-token');

    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument();
      expect(screen.getByText('Download PDF')).toBeInTheDocument();
    });
  });
});
