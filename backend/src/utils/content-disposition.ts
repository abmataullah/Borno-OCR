/**
 * Build a safe `Content-Disposition: attachment` header value.
 *
 * SECURITY: filenames come from user input (project names, uploaded file
 * names). Quotes, backslashes and control characters are stripped from the
 * plain `filename=` fallback so they can't break out of the quoted string, and
 * the real name is carried in RFC 5987 `filename*=` (percent-encoded UTF-8),
 * which keeps Bangla names intact.
 */
export function contentDisposition(filename: string, fallback = 'download'): string {
  const name = filename.replace(/[\x00-\x1f\x7f]/g, '').trim() || fallback;
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
