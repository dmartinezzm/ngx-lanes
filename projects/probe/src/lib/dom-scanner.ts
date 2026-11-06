import { LargeList } from './probe-store';

export const PROBE_PANEL_ATTR = 'data-probe-panel';

/** Elementos con muchos hijos directos: señal de una lista renderizada entera, sin virtualizar. */
export function findLargeLists(root: Element, threshold: number, limit = 10): LargeList[] {
  const found: LargeList[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      (node as Element).hasAttribute(PROBE_PANEL_ATTR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walker.currentNode as Element | null; node; node = walker.nextNode() as Element | null) {
    if (node.childElementCount >= threshold) {
      found.push({ selector: selectorFor(node), children: node.childElementCount });
    }
  }
  return found.sort((a, b) => b.children - a.children).slice(0, limit);
}

/** Selector legible de hasta 3 niveles, p. ej. "app-orders > div.table > tbody". */
export function selectorFor(el: Element): string {
  const parts: string[] = [];
  for (let node: Element | null = el, i = 0; node && i < 3 && node.tagName !== 'BODY'; node = node.parentElement, i++) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift(`${part}#${node.id}`);
      break;
    }
    const cls = [...node.classList].filter((c) => !c.startsWith('ng-')).slice(0, 2);
    if (cls.length) part += `.${cls.join('.')}`;
    parts.unshift(part);
  }
  return parts.join(' > ');
}
