import { useSyncExternalStore, useCallback } from 'react';
import { getLocale, setLocale, t as translate, initLocale } from '../lib/i18n';
import type { Locale } from '../lib/i18n';

initLocale();

function subscribe(callback: () => void): () => void {
  window.addEventListener('localechange', callback);
  return () => window.removeEventListener('localechange', callback);
}

function getSnapshot(): string {
  return getLocale();
}

export function useTranslation() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getSnapshot) as Locale;

  const t = useCallback((key: string) => translate(key), []);

  const toggleLocale = useCallback(() => {
    setLocale(getLocale() === 'en' ? 'bn' : 'en');
  }, []);

  return { t, locale, toggleLocale, setLocale };
}
