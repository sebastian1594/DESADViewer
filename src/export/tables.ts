/**
 * Formt das Datenmodell in einfache Tabellen um.
 * Grundlage für PDF, Excel und CSV – so haben alle Exporte dieselben Spalten.
 */
import type { DateEntry, DesadvMessage, Identifier, PackageNode, PackEntry, Party, ParseResult } from '../parser';
import { addressLines, codeText, fmtNumber, measurementText, partyTitle, quantityText, unitText } from '../ui/format';

export type Cell = string | number | undefined;

export interface Column {
  key: string;
  header: string;
  /** ungefähre Spaltenbreite in Zeichen (Excel) */
  width?: number;
  numeric?: boolean;
}

export interface Table {
  name: string;
  columns: Column[];
  rows: Record<string, Cell>[];
}

export function dateText(entry: DateEntry | undefined): string {
  if (!entry) return '';
  return entry.formatted.valid ? entry.formatted.display : `${entry.value} (ungültig)`;
}

export function identifiersText(ids: Identifier[]): string {
  return ids
    .map((g) => `${codeText(g.qualifier) || 'Nr.'}: ${g.ranges.map((r) => (r.to ? `${r.from}–${r.to}` : r.from)).join(', ')}`)
    .join('; ');
}

export function packTypeText(pack: PackEntry): string {
  if (pack.type?.known) return codeText(pack.type);
  return pack.typeDescription ?? (pack.type ? `Packmittel ${pack.type.code}` : 'Packstück');
}

/** „12 × Karton“; bei ungültigen PAC-Anzahlen „? × Karton (Anzahl teilweise ungültig)“ */
export function packageCountsText(m: DesadvMessage): string {
  return m.summary.packageCounts
    .map((p) => {
      const count = p.invalidCount && p.count === 0 ? '?' : fmtNumber(p.count);
      const type = p.type?.known ? codeText(p.type) : (p.description ?? p.type?.code ?? 'Packstück');
      return `${count} × ${type}${p.invalidCount ? ' (Anzahl teilweise ungültig)' : ''}`;
    })
    .join(', ');
}

export function versionText(m: DesadvMessage): string {
  return [m.identifier.type, m.version.directory, m.version.subset && `Subset ${m.version.subset.code}`].filter(Boolean).join(' · ');
}

export function roleParty(m: DesadvMessage, role: keyof DesadvMessage['summary']['roles']): Party | undefined {
  const i = m.summary.roles[role];
  return i === undefined ? undefined : m.parties[i];
}

function interchangeOf(result: ParseResult, m: DesadvMessage) {
  return result.interchanges.find((x) => x.segmentIndex < m.segmentRange.start && (x.trailerIndex === undefined || x.trailerIndex > m.segmentRange.start));
}

/** Kopfdaten als Liste „Feld – Wert“ */
export function headerTable(result: ParseResult, m: DesadvMessage): Table {
  const s = m.summary;
  const ic = interchangeOf(result, m);
  const rows: [string, Cell][] = [
    ['Lieferscheinnr. / Dokumentnr.', s.documentNumber],
    ['Dokumentart', m.header.documentName ? codeText(m.header.documentName) : m.header.documentNameText],
    ['Nachrichtenfunktion', codeText(m.header.messageFunction)],
    ['Dokumentdatum', dateText(s.documentDate)],
    ['Versanddatum', dateText(s.despatchDate)],
    [s.arrivalDate?.qualifier?.label ?? 'Liefer-/Ankunftstermin', dateText(s.arrivalDate)],
    ['Bestellnummer(n)', s.orderNumbers.join(', ')],
    ['EDIFACT-Version', versionText(m)],
    ['Verzeichnis', m.version.directoryLabel],
    ['Nachrichtenreferenz (UNH)', m.reference],
    ['Absender (UNB)', ic?.sender?.id],
    ['Empfänger (UNB)', ic?.recipient?.id],
    ['Übertragungsreferenz (UNB)', ic?.controlRef],
    ['Übertragungsdatum (UNB)', ic?.preparedAt?.display],
    ['Anzahl Positionen', s.lineItemCount],
    ['Packstücke', packageCountsText(m)],
    ['Liefermenge gesamt', s.quantityTotals.map((t) => `${fmtNumber(t.total)} ${unitText(t.unit)}`.trim()).join(', ')],
    ['Bruttogewicht', s.grossWeight && measurementText(s.grossWeight)],
    ['Nettogewicht', s.netWeight && measurementText(s.netWeight)],
  ];
  for (const d of m.dates) {
    if (d !== s.documentDate && d !== s.despatchDate && d !== s.arrivalDate) rows.push([codeText(d.qualifier) || 'Datum', dateText(d)]);
  }
  for (const r of m.references) rows.push([codeText(r.qualifier) || 'Referenz', [r.value, r.lineNumber && `Pos. ${r.lineNumber}`].filter(Boolean).join(' / ')]);
  for (const t of m.transports) {
    rows.push([
      'Transport',
      [codeText(t.mode) || t.modeText, t.carrierName ?? t.carrierId, t.vehicleId && `Kennzeichen ${t.vehicleId}`].filter(Boolean).join(' · '),
    ]);
  }
  for (const e of m.equipment) rows.push([codeText(e.qualifier) || 'Equipment', e.id]);
  for (const term of m.deliveryTerms) rows.push(['Lieferbedingung', [codeText(term.code), term.text].filter(Boolean).join(' · ')]);
  for (const l of m.locations) rows.push([codeText(l.qualifier) || 'Ort', [l.id, l.name].filter(Boolean).join(' – ')]);
  for (const n of m.notes) rows.push([codeText(n.subject) || 'Hinweis', n.text]);

  return {
    name: 'Kopf',
    columns: [
      { key: 'field', header: 'Feld', width: 32 },
      { key: 'value', header: 'Wert', width: 70 },
    ],
    rows: rows.filter(([, v]) => v !== undefined && v !== '').map(([field, value]) => ({ field, value })),
  };
}

export function partiesTable(m: DesadvMessage): Table {
  return {
    name: 'Beteiligte',
    columns: [
      { key: 'role', header: 'Rolle', width: 26 },
      { key: 'code', header: 'Code', width: 7 },
      { key: 'name', header: 'Name', width: 36 },
      { key: 'address', header: 'Anschrift', width: 44 },
      { key: 'id', header: 'Kennung', width: 18 },
      { key: 'contact', header: 'Ansprechpartner/Kontakt', width: 36 },
    ],
    rows: m.parties.map((p) => ({
      role: codeText(p.qualifier),
      code: p.qualifier?.code,
      name: partyTitle(p),
      address: addressLines(p).join(', '),
      id: p.id,
      contact: p.contacts
        .map((c) => [c.name ?? c.departmentCode, ...c.communications.map((x) => `${codeText(x.channel)} ${x.number}`.trim())].filter(Boolean).join(', '))
        .join('; '),
    })),
  };
}

export function lineItemsTable(m: DesadvMessage): Table {
  return {
    name: 'Positionen',
    columns: [
      { key: 'pos', header: 'Pos.', width: 6 },
      { key: 'materialNumber', header: 'Materialnr.', width: 18 },
      { key: 'itemNumber', header: 'Artikelnr. (LIN)', width: 18 },
      { key: 'itemNumberType', header: 'Art der Artikelnr.', width: 22 },
      { key: 'additionalIds', header: 'Weitere Nummern', width: 28 },
      { key: 'description', header: 'Bezeichnung', width: 34 },
      { key: 'quantity', header: 'Menge', width: 10, numeric: true },
      { key: 'unit', header: 'Einheit', width: 10 },
      { key: 'unitCode', header: 'Einheit (Code)', width: 8 },
      { key: 'batch', header: 'Charge', width: 16 },
      { key: 'orderNumber', header: 'Bestellnr.', width: 14 },
      { key: 'orderLine', header: 'Bestellpos.', width: 8 },
      { key: 'package', header: 'Packstück-Ebene', width: 10 },
      { key: 'origin', header: 'Ursprungsland', width: 14 },
    ],
    rows: m.lineItems.map((item) => {
      const q = item.despatchQuantity;
      return {
        pos: item.lineNumber,
        materialNumber: item.materialNumber?.value,
        itemNumber: item.itemNumber,
        itemNumberType: codeText(item.itemNumberType),
        additionalIds: item.additionalIds.map((a) => `${codeText(a.type) || 'Nr.'}: ${a.id}`).join('; '),
        description: item.description,
        quantity: q ? (q.value ?? q.rawValue) : undefined,
        unit: unitText(q?.unit),
        unitCode: q?.unit?.code,
        batch: item.batchNumbers.join(', '),
        orderNumber: item.orderNumber?.value,
        orderLine: item.orderNumber?.line,
        package: item.packageId,
        origin: codeText(item.countryOfOrigin),
      };
    }),
  };
}

/** Packbaum als flache Tabelle (Pfad zeigt die Verschachtelung) */
export function packagesTable(m: DesadvMessage): Table {
  const rows: Record<string, Cell>[] = [];
  const walk = (node: PackageNode, depth: number, path: string[]) => {
    const here = [...path, node.id];
    const counts = node.packs.map((p) => p.count).filter((c): c is number => c !== undefined);
    rows.push({
      id: node.id,
      parent: node.parentId,
      depth,
      path: here.join(' > '),
      count: counts.length > 0 ? counts.reduce((a, b) => a + b, 0) : undefined,
      type: node.packs.map(packTypeText).join(', ') || (node.parentId === undefined ? 'Sendung' : ''),
      typeCode: node.packs.map((p) => p.type?.code).filter(Boolean).join(', '),
      numbers: identifiersText(node.packs.flatMap((p) => p.markings.flatMap((mk) => mk.identifiers))),
      perPack: node.packs.flatMap((p) => p.quantities).map((q) => `${codeText(q.qualifier)}: ${quantityText(q)}`).join('; '),
      weight: node.packs.flatMap((p) => p.measurements).map((x) => `${codeText(x.dimension)}: ${measurementText(x)}`).join('; '),
      items: node.lineItemIndices
        .map((i) => m.lineItems[i])
        .map((li) => `Pos. ${li.lineNumber ?? '?'} ${li.materialNumber?.value ?? ''} (${quantityText(li.despatchQuantity)})`.replace(/\s+/g, ' '))
        .join('; '),
    });
    node.children.forEach((c) => walk(c, depth + 1, here));
  };
  m.packages.forEach((n) => walk(n, 0, []));

  return {
    name: 'Packstücke',
    columns: [
      { key: 'path', header: 'Pfad', width: 14 },
      { key: 'id', header: 'Ebene', width: 7 },
      { key: 'parent', header: 'Übergeordnet', width: 11 },
      { key: 'depth', header: 'Tiefe', width: 6, numeric: true },
      { key: 'count', header: 'Anzahl', width: 8, numeric: true },
      { key: 'type', header: 'Packmittel', width: 18 },
      { key: 'typeCode', header: 'Packmittel (Code)', width: 10 },
      { key: 'numbers', header: 'Nummern (SSCC, Etiketten …)', width: 44 },
      { key: 'perPack', header: 'Menge je Packstück', width: 26 },
      { key: 'weight', header: 'Gewicht/Maße', width: 26 },
      { key: 'items', header: 'Enthaltene Positionen', width: 44 },
    ],
    rows,
  };
}

const SEVERITY: Record<string, string> = { error: 'Fehler', warning: 'Warnung', info: 'Hinweis' };

export function issuesTable(result: ParseResult, messageIndex?: number): Table {
  return {
    name: 'Prüfergebnis',
    columns: [
      { key: 'severity', header: 'Art', width: 10 },
      { key: 'message', header: 'Meldung', width: 90 },
      { key: 'line', header: 'Zeile', width: 7, numeric: true },
      { key: 'segment', header: 'Segment', width: 40 },
    ],
    rows: result.issues
      .filter((i) => messageIndex === undefined || i.messageIndex === undefined || i.messageIndex === messageIndex)
      .map((i) => {
        const seg = i.segmentIndex !== undefined ? result.segments[i.segmentIndex] : undefined;
        return { severity: SEVERITY[i.severity], message: i.message, line: seg?.line, segment: seg?.raw };
      }),
  };
}
