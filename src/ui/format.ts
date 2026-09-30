/**
 * Kleine Hilfsfunktionen für die Anzeige (Zahlen, Einheiten, Adressen) im deutschen Format.
 */
import type { CodedValue, Measurement, Party, Quantity } from '../parser';

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 });

export function fmtNumber(n: number | undefined): string {
  return n === undefined ? '–' : numberFormat.format(n);
}

/** Klartext eines Codes (Bezeichnung, sonst Rohcode) – für einfache Textstellen */
export function codeText(c: CodedValue | undefined): string {
  if (!c) return '';
  return c.known && c.label ? c.label : c.code;
}

/** Einheit kurz: bekannte Einheiten als Wort, sonst Rohcode */
export function unitText(unit: CodedValue | undefined): string {
  return unit ? codeText(unit) : '';
}

export function quantityText(q: Quantity | undefined): string {
  if (!q) return '–';
  const value = q.value !== undefined ? fmtNumber(q.value) : q.rawValue || '–';
  return `${value} ${unitText(q.unit)}`.trim();
}

export function measurementText(m: Measurement | undefined): string {
  if (!m) return '–';
  const value = m.value !== undefined ? fmtNumber(m.value) : m.rawValue ?? '–';
  return `${value} ${unitText(m.unit)}`.trim();
}

export function partyTitle(p: Party): string {
  return p.name.join(' ') || p.nameAndAddress[0] || p.id || '(ohne Namen)';
}

export function addressLines(p: Party): string[] {
  const lines: string[] = [];
  if (p.name.length === 0 && p.nameAndAddress.length > 1) lines.push(...p.nameAndAddress.slice(1));
  lines.push(...p.street);
  const cityLine = [p.postalCode, p.city].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (p.region) lines.push(p.region);
  if (p.country) lines.push(codeText(p.country));
  return lines;
}
