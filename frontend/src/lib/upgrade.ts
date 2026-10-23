/**
 * Request an upgrade to BornoOCR Pro.
 * In embed mode (inside Banglai Cloud iframe), dispatches a postMessage
 * to trigger the native Banglai Cloud central paywall.
 * Otherwise, navigates to the pricing route.
 */
export function requestUpgrade(): void {
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'BORNOOCR_UPGRADE' }, '*');
  } else if (typeof window !== 'undefined') {
    window.location.href = '/pricing';
  }
}
