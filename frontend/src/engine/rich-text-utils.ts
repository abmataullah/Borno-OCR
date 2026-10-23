import type { TextRun, TextStyle, Paragraph, ListType, HeadingLevel } from '@model/document-model';

export function defaultStyle(): TextStyle {
  return {
    fontId: 'inter-regular',
    fontSize: 12,
    fontWeight: 400,
    fontStyle: 'normal',
    color: '#1a1a1a',
    opacity: 1,
    underline: false,
    strikethrough: false,
    alignment: 'left',
    direction: 'ltr',
    lineHeight: 1.5,
    letterSpacing: 0,
    language: 'en',
  };
}

export function fontIdToFamily(fontId: string): string {
  if (fontId.includes('bengali')) return '"Noto Sans Bengali", sans-serif';
  if (fontId.includes('serif-bengali')) return '"Noto Serif Bengali", serif';
  if (fontId.includes('siyam')) return '"Siyam Rupali", sans-serif';
  if (fontId.includes('kalpurush')) return '"Kalpurush", serif';
  if (fontId.includes('solaiman')) return '"SolaimanLipi", sans-serif';
  return '"Inter", "Calibri", sans-serif';
}

export function styleToCss(style: TextStyle): React.CSSProperties {
  return {
    fontFamily: fontIdToFamily(style.fontId),
    fontSize: `${style.fontSize}pt`,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    textDecoration: [
      style.underline ? 'underline' : '',
      style.strikethrough ? 'line-through' : '',
    ].filter(Boolean).join(' ') || 'none',
    color: style.color,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
  };
}

export function headingFontSize(level: HeadingLevel): number {
  switch (level) {
    case 'h1': return 24;
    case 'h2': return 20;
    case 'h3': return 16;
    default: return 12;
  }
}

export function headingFontWeight(level: HeadingLevel): number {
  switch (level) {
    case 'h1': return 700;
    case 'h2': return 700;
    case 'h3': return 600;
    default: return 400;
  }
}

/** Render a paragraph's runs as HTML string with styled spans */
export function paragraphToHtml(para: Paragraph): string {
  const runsHtml = para.runs.map(run => {
    const css = styleToCss(run.style);
    const styleStr = Object.entries(css)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`)
      .join(';');
    return `<span style="${styleStr}">${escapeHtml(run.text)}</span>`;
  }).join('');
  return runsHtml;
}

/** Parse a contentEditable DOM back into runs */
export function domToRuns(container: HTMLElement, baseStyle: TextStyle): TextRun[] {
  const runs: TextRun[] = [];

  function walk(node: Node, inheritedStyle: TextStyle) {
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? '';
        if (text) {
          runs.push({ text, style: { ...inheritedStyle } });
        }
        return;
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const style = { ...inheritedStyle };
        const tag = el.tagName.toLowerCase();

        if (tag === 'b' || tag === 'strong') style.fontWeight = 700;
        else if (tag === 'i' || tag === 'em') style.fontStyle = 'italic';
        else if (tag === 'u') style.underline = true;
        else if (tag === 's' || tag === 'strike' || tag === 'del') style.strikethrough = true;

        const computed = window.getComputedStyle(el);
        if (computed.fontWeight === '700' || computed.fontWeight === 'bold') style.fontWeight = 700;
        if (computed.fontStyle === 'italic') style.fontStyle = 'italic';
        if (computed.textDecoration.includes('underline')) style.underline = true;
        if (computed.textDecoration.includes('line-through')) style.strikethrough = true;
        if (computed.color && computed.color !== 'rgb(0, 0, 0)') {
          const rgb = computed.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (rgb) {
            style.color = `#${parseInt(rgb[1]).toString(16).padStart(2, '0')}${parseInt(rgb[2]).toString(16).padStart(2, '0')}${parseInt(rgb[3]).toString(16).padStart(2, '0')}`;
          }
        }
        const fontSize = computed.fontSize;
        if (fontSize && fontSize.endsWith('px')) {
          style.fontSize = Math.round(parseFloat(fontSize) * 0.75);
        }

        walk(el, style);
      }
    });
  }

  walk(container, baseStyle);

  if (runs.length === 0) {
    runs.push({ text: '', style: { ...baseStyle } });
  }

  // Merge adjacent runs with same style
  const merged: TextRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && JSON.stringify(last.style) === JSON.stringify(run.style)) {
      last.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }

  return merged;
}

/** Get the selection offsets within a contentEditable element */
export function getSelectionOffsets(container: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;

  function getOffset(node: Node, target: Node, targetOffset: number): number {
    let offset = 0;
    function walk(n: Node): boolean {
      if (n === target) {
        offset += targetOffset;
        return true;
      }
      if (n.nodeType === Node.TEXT_NODE) {
        offset += (n.textContent ?? '').length;
      } else {
        for (const child of Array.from(n.childNodes)) {
          if (walk(child)) return true;
        }
      }
      return false;
    }
    walk(node);
    return offset;
  }

  const start = getOffset(container, range.startContainer, range.startOffset);
  const end = getOffset(container, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

/** Parse contentEditable into paragraphs */
export function domToParagraphs(container: HTMLElement, baseParas: Paragraph[]): Paragraph[] {
  const pElements = Array.from(container.querySelectorAll('p, div'));
  const containers = pElements.length > 0 ? pElements as HTMLElement[] : [container];

  return containers.map((pEl, pIdx) => {
    const existing = baseParas[pIdx];
    const baseStyle = existing?.runs[0]?.style ?? defaultStyle();
    const runs = domToRuns(pEl, baseStyle);
    return {
      id: existing?.id ?? crypto.randomUUID(),
      runs,
      alignment: existing?.alignment ?? 'left',
      direction: existing?.direction ?? 'ltr',
      lineHeight: existing?.lineHeight ?? 1.5,
      spaceBefore: existing?.spaceBefore ?? 0,
      spaceAfter: existing?.spaceAfter ?? 8,
      indent: existing?.indent ?? 0,
      listType: existing?.listType ?? 'none',
      headingLevel: existing?.headingLevel ?? 'none',
    };
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** List CSS helpers */
export function listMarker(listType: ListType, index: number): string {
  if (listType === 'bullet') return '• ';
  if (listType === 'numbered') return `${index + 1}. `;
  return '';
}
