import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@state/auth-context';
import { AuthPage } from '@ui/auth/AuthPage';
import { api } from '@api/client';

vi.mock('@api/client', () => ({
  api: {
    setToken: vi.fn(),
    getToken: vi.fn(() => null),
    auth: {
      requestOtp: vi.fn(() => Promise.resolve({ sent: true })),
      verifyOtp: vi.fn(() => Promise.resolve({
        token: 'test-token',
        user: { id: 'u1', email: 'test@example.com', name: 'Test', plan: 'free' },
      })),
      me: vi.fn(() => Promise.resolve(null)),
    },
    projects: {
      list: vi.fn(() => Promise.resolve([])),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      share: vi.fn(),
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
    user: null,
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

describe('E2E: Auth Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render auth page with email input', () => {
    renderWithProviders(<AuthPage />);
    expect(screen.getByText('Sign in / Sign up')).toBeTruthy();
    expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy();
  });

  it('should proceed to OTP verification step', async () => {
    renderWithProviders(<AuthPage />);

    const emailInput = screen.getByPlaceholderText('you@example.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Enter login code')).toBeTruthy();
    });
    expect(api.auth.requestOtp).toHaveBeenCalledWith('test@example.com');
  });

  it('should verify OTP and complete login', async () => {
    renderWithProviders(<AuthPage />);

    const emailInput = screen.getByPlaceholderText('you@example.com');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Enter login code')).toBeTruthy();
    });

    const codeInput = screen.getByPlaceholderText('6-digit code') as HTMLInputElement;
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify & Sign In'));

    await waitFor(() => {
      expect(api.auth.verifyOtp).toHaveBeenCalledWith('test@example.com', '123456', undefined);
    });
  });
});
