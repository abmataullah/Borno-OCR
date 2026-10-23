import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@state/auth-context';
import { DashboardPage } from '@ui/dashboard/DashboardPage';
import { api } from '@api/client';

vi.mock('@api/client', () => ({
  api: {
    setToken: vi.fn(),
    getToken: vi.fn(() => 'existing-token'),
    auth: {
      requestOtp: vi.fn(),
      verifyOtp: vi.fn(),
      me: vi.fn(() => Promise.resolve({
        id: 'u1', email: 'test@example.com', name: 'Test User', plan: 'free',
        storageQuotaMb: 100, storageUsedMb: 15,
      })),
    },
    projects: {
      list: vi.fn(() => Promise.resolve([
        { id: 'p1', userId: 'u1', name: 'My First PDF', pageCount: 5, fileSizeKb: 1200, isShared: false, shareToken: null, originalPdfKey: null, projectData: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'p2', userId: 'u1', name: 'Invoice Sample', pageCount: 2, fileSizeKb: 800, isShared: true, shareToken: 'tok-abc', originalPdfKey: null, projectData: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ])),
      get: vi.fn(),
      create: vi.fn(() => Promise.resolve({
        id: 'p3', userId: 'u1', name: 'Untitled Project', pageCount: 0, fileSizeKb: 0, isShared: false, shareToken: null, originalPdfKey: null, projectData: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      })),
      update: vi.fn(),
      delete: vi.fn(() => Promise.resolve()),
      share: vi.fn(() => Promise.resolve({ shareToken: 'tok-new', isShared: true })),
    },
    billing: {
      plans: vi.fn(),
      subscription: vi.fn(),
      history: vi.fn(),
      createPayment: vi.fn(),
    },
  },
}));

vi.mock('@state/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@example.com', name: 'Test User', plan: 'free', storageQuotaMb: 100, storageUsedMb: 15 },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

describe('E2E: Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dashboard with user info and projects', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText('My First PDF')).toBeTruthy();
      expect(screen.getByText('Invoice Sample')).toBeTruthy();
    });
  });

  it('should show storage usage', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/15/)).toBeTruthy();
      expect(screen.getByText(/100 MB/)).toBeTruthy();
    });
  });

  it('should filter projects by search', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('My First PDF')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText('Search projects...') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Invoice' } });

    await waitFor(() => {
      expect(screen.getByText('Invoice Sample')).toBeTruthy();
      expect(screen.queryByText('My First PDF')).toBeNull();
    });
  });

  it('should create a new project on button click', async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('New Project'));

    await waitFor(() => {
      expect(api.projects.create).toHaveBeenCalledWith({ name: 'Untitled Project' });
    });
  });
});
