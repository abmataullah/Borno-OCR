import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from '@ui/admin/AdminPage';

vi.mock('@api/client', () => ({
  api: {
    setToken: vi.fn(),
    getToken: vi.fn(() => 'admin-token'),
    admin: {
      stats: vi.fn(() => Promise.resolve({
        users: 42,
        projects: 128,
        payments: 15,
        revenue: 135000,
        planDistribution: { free: 30, pro: 10, business: 2 },
      })),
      listUsers: vi.fn(() => Promise.resolve([
        { id: 'u1', email: 'user1@test.com', name: 'User One', plan: 'free', isAdmin: false, storageQuotaMb: 100, storageUsedMb: 10, createdAt: new Date().toISOString() },
        { id: 'u2', email: 'user2@test.com', name: 'User Two', plan: 'pro', isAdmin: true, storageQuotaMb: 2048, storageUsedMb: 500, createdAt: new Date().toISOString() },
      ])),
      getUser: vi.fn(),
      updatePlan: vi.fn(() => Promise.resolve({ success: true })),
      setAdmin: vi.fn(() => Promise.resolve({ success: true })),
      deleteUser: vi.fn(() => Promise.resolve()),
      addManualPayment: vi.fn(() => Promise.resolve({ success: true })),
      listProjects: vi.fn(() => Promise.resolve([
        { id: 'p1', userId: 'u1', name: 'Project Alpha', pageCount: 10, fileSizeKb: 2000, isShared: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ])),
      listPayments: vi.fn(() => Promise.resolve([
        { id: 'pay1', userId: 'u1', amount: 90000, currency: 'BDT', provider: 'bkash', status: 'paid', metadata: {}, createdAt: new Date().toISOString() },
      ])),
    },
  },
}));

vi.mock('@state/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'admin1', email: 'admin@test.com', name: 'Admin', plan: 'business', isAdmin: true },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>
  );
}

describe('E2E: Admin Panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render admin panel with title', async () => {
    renderWithProviders(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin Panel')).toBeTruthy();
    });
  });

  it('should display stats on stats tab', async () => {
    renderWithProviders(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Users')).toBeTruthy();
      expect(screen.getByText('42')).toBeTruthy();
      expect(screen.getByText('Total Projects')).toBeTruthy();
      expect(screen.getByText('128')).toBeTruthy();
    });
  });

  it('should switch to users tab and show user list', async () => {
    renderWithProviders(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin Panel')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('users'));

    await waitFor(() => {
      expect(screen.getByText('user1@test.com')).toBeTruthy();
      expect(screen.getByText('user2@test.com')).toBeTruthy();
    });
  });

  it('should show Add Manual Payment button on users tab', async () => {
    renderWithProviders(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin Panel')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('users'));

    await waitFor(() => {
      expect(screen.getByText('Add Manual Payment')).toBeTruthy();
    });
  });

  it('should switch to projects tab and show projects', async () => {
    renderWithProviders(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin Panel')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('projects'));

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeTruthy();
    });
  });

  it('should switch to payments tab and show payments', async () => {
    renderWithProviders(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Admin Panel')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('payments'));

    await waitFor(() => {
      expect(screen.getByText('bkash')).toBeTruthy();
      expect(screen.getByText('paid')).toBeTruthy();
    });
  });
});
