import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useTranslation } from '../hooks/useTranslation';
import { setLocale, initLocale } from '../lib/i18n';

function TestComponent() {
  const { t, locale, toggleLocale } = useTranslation();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="translated">{t('common.save')}</span>
      <span data-testid="editor-save">{t('editor.save')}</span>
      <span data-testid="dashboard-title">{t('dashboard.title')}</span>
      <button data-testid="toggle" onClick={toggleLocale}>Toggle</button>
    </div>
  );
}

describe('i18n System', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      setLocale('en');
      initLocale();
    });
  });

  it('should default to English', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('translated').textContent).toBe('Save');
  });

  it('should toggle to Bangla', () => {
    render(<TestComponent />);
    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('locale').textContent).toBe('bn');
    expect(screen.getByTestId('translated').textContent).toBe('সংরক্ষণ');
  });

  it('should translate dashboard title to Bangla', () => {
    render(<TestComponent />);
    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('dashboard-title').textContent).toBe('আমার প্রজেক্ট');
  });

  it('should translate editor save to Bangla', () => {
    render(<TestComponent />);
    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('editor-save').textContent).toBe('প্রজেক্ট সংরক্ষণ');
  });

  it('should toggle back to English', () => {
    render(<TestComponent />);
    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('locale').textContent).toBe('bn');
    fireEvent.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('translated').textContent).toBe('Save');
  });

  it('should persist locale to localStorage', () => {
    render(<TestComponent />);
    fireEvent.click(screen.getByTestId('toggle'));
    expect(localStorage.getItem('docflow_locale')).toBe('bn');
  });
});
