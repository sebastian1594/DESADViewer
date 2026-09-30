/**
 * Sammelt ALLE Datumsangaben einer Nachricht – egal wo sie stehen (Kopf, unter Referenzen,
 * bei Beteiligten, Transport, Packstücken oder Positionen) – und fasst sie je Datumsart zusammen.
 * Grundlage für die Datumszeilen in der Übersicht.
 */
import { NUMBER_RULES, SUMMARY_RULES, matchesAny } from '../knowledge';
import type { DateEntry, DesadvMessage, PackageNode, ReferenceEntry } from '../parser';

export interface DateRow {
  /** Klartext, z. B. „Lieferscheindatum“ */
  label: string;
  /** Code der Datumsart, z. B. "124" */
  code?: string;
  /** Umgewandelte Werte ohne Doppelte, in Reihenfolge des Vorkommens */
  values: string[];
  /** Position des ersten Vorkommens in der Datei (für die Sortierung) */
  firstSegment: number;
}

function isOrderReference(ref: ReferenceEntry): boolean {
  return (ref.qualifier !== undefined && SUMMARY_RULES.orderReference.includes(ref.qualifier.code)) || (ref.value !== '' && matchesAny(ref.value, NUMBER_RULES.orderNumber));
}

function displayOf(d: DateEntry): string {
  return d.formatted.valid ? d.formatted.display : `${d.value} (ungültig)`;
}

export function collectDateRows(m: DesadvMessage): DateRow[] {
  /** Datum + Kennzeichen, ob es direkt unter einer Bestellnummer steht */
  const found: { date: DateEntry; underOrder: boolean }[] = [];
  const add = (dates: DateEntry[], underOrder = false) => dates.forEach((date) => found.push({ date, underOrder }));
  const addRefs = (refs: ReferenceEntry[]) => refs.forEach((r) => add(r.dates, isOrderReference(r)));

  add(m.dates);
  addRefs(m.references);
  for (const p of m.parties) {
    addRefs(p.references);
    p.locations.forEach((l) => add(l.dates));
  }
  for (const t of m.transports) {
    addRefs(t.references);
    t.locations.forEach((l) => add(l.dates));
  }
  const walk = (node: PackageNode) => {
    for (const pack of node.packs) {
      add(pack.dates);
      addRefs(pack.references);
      pack.markings.forEach((mk) => add(mk.dates));
    }
    node.children.forEach(walk);
  };
  m.packages.forEach(walk);
  for (const item of m.lineItems) {
    add(item.dates);
    addRefs(item.references);
    item.locations.forEach((l) => add(l.dates));
    item.markings.forEach((mk) => add(mk.dates));
  }

  // Je Datumsart zusammenfassen; ein Referenzdatum unter der Bestellnummer gilt als Bestelldatum
  const rows = new Map<string, DateRow>();
  const seen = new Set<number>();
  for (const { date, underOrder } of found) {
    if (seen.has(date.segmentIndex)) continue;
    seen.add(date.segmentIndex);
    const code = date.qualifier?.code;
    const asOrderDate = underOrder && code !== undefined && SUMMARY_RULES.orderReferenceDate.includes(code);
    const key = asOrderDate ? `order:${code}` : `code:${code ?? '?'}`;
    const label = asOrderDate ? 'Bestelldatum' : date.qualifier?.known && date.qualifier.label ? date.qualifier.label : 'Datum';
    const row = rows.get(key) ?? { label, code, values: [], firstSegment: date.segmentIndex };
    const value = displayOf(date);
    if (!row.values.includes(value)) row.values.push(value);
    row.firstSegment = Math.min(row.firstSegment, date.segmentIndex);
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.firstSegment - b.firstSegment);
}
