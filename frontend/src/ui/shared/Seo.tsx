import { useEffect } from 'react';

const SITE_URL = 'https://pdf.banglai.cloud';
const SITE_NAME = 'BornoOCR';
const DEFAULT_DESCRIPTION =
  'Edit PDFs like Word and Excel directly in your browser. High-accuracy Bangla & English OCR, editable tables, scanned document conversion.';

interface SeoProps {
  /** Page title — will be suffixed with site name */
  title?: string;
  /** Meta description for this page */
  description?: string;
  /** Path for canonical URL, e.g. '/pricing' */
  path?: string;
  /** Set noindex for private pages (dashboard, editor, admin) */
  noIndex?: boolean;
  /** Optional JSON-LD structured data for this page */
  jsonLd?: Record<string, unknown>;
}

/**
 * Per-page SEO manager for the SPA.
 * Updates document title, meta description, canonical, robots, and OG tags
 * on route changes. Cleans up page-specific JSON-LD on unmount.
 */
export function Seo({ title, description, path, noIndex, jsonLd }: SeoProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Edit PDFs Like Word & Excel Online`;
    const desc = description ?? DEFAULT_DESCRIPTION;
    const url = `${SITE_URL}${path ?? ''}`;

    document.title = fullTitle;

    setMeta('name', 'description', desc);
    setMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);

    setCanonical(url);

    // Page-specific JSON-LD
    let ldScript: HTMLScriptElement | null = null;
    if (jsonLd) {
      ldScript = document.createElement('script');
      ldScript.type = 'application/ld+json';
      ldScript.setAttribute('data-page-ld', 'true');
      ldScript.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(ldScript);
    }

    return () => {
      if (ldScript) ldScript.remove();
    };
  }, [title, description, path, noIndex, jsonLd]);

  return null;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}
