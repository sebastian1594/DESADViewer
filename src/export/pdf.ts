/**
 * PDF-Export: ein lesbarer Lieferschein (A4 hochkant).
 * jsPDF und jspdf-autotable werden erst beim Export nachgeladen.
 */
import type { DesadvMessage, Party, ParseResult } from '../parser';
import { addressLines, codeText, fmtNumber, measurementText, partyTitle, unitText } from '../ui/format';
import { dateText, lineItemsTable, packageCountsText, packagesTable, roleParty, versionText } from './tables';
import type { ExportMeta } from './text';

/**
 * Die Standardschriften von PDF kennen nur westeuropäische Zeichen (Latin-1).
 * Alles andere wird ersetzt, damit keine „Kästchen“ erscheinen.
 */
export function pdfSafe(text: string | number | undefined): string {
  if (text === undefined) return '';
  return String(text)
    .replace(/[„“”″]/g, '"')
    .replace(/[‚‘’′]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/€/g, 'EUR')
    .replace(/[→⇒]/g, '->')
    .replace(/[•]/g, '-')
    .replace(/✓/g, 'OK')
    .replace(/[^ -~ -ÿ\n]/g, '?');
}

const MARGIN = 15;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const pad2 = (n: number) => String(n).padStart(2, '0');
const germanDateTime = (d: Date) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export async function buildPdf(result: ParseResult, messageIndex: number, meta: ExportMeta): Promise<ArrayBuffer> {
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const m: DesadvMessage = result.messages[messageIndex];
  const s = m.summary;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setProperties({
    title: pdfSafe(`Lieferschein ${s.documentNumber ?? m.reference}`),
    subject: pdfSafe(`EDIFACT ${versionText(m)}`),
    creator: 'DESADViewer',
  });

  const text = (value: string | number | undefined, x: number, y: number, opts?: { size?: number; bold?: boolean; color?: number; maxWidth?: number; align?: 'left' | 'right' }) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(opts?.size ?? 9);
    doc.setTextColor(opts?.color ?? 20);
    const lines = doc.splitTextToSize(pdfSafe(value), opts?.maxWidth ?? CONTENT_W) as string[];
    doc.text(lines, x, y, { align: opts?.align });
    return lines.length * (opts?.size ?? 9) * 0.42;
  };

  // ── Titel und Kopf ──
  let y = MARGIN + 4;
  text('Lieferschein', MARGIN, y, { size: 20, bold: true });
  text(`Lieferavis (EDIFACT ${versionText(m)})`, MARGIN, y + 6, { size: 9, color: 90 });

  const facts: [string, string][] = [
    ['Lieferschein-Nr.', s.documentNumber ?? '-'],
    ['Dokumentdatum', dateText(s.documentDate) || '-'],
    ['Versanddatum', dateText(s.despatchDate) || '-'],
    [s.arrivalDate?.qualifier?.label ?? 'Liefertermin', dateText(s.arrivalDate) || '-'],
  ];
  if (s.orderNumbers.length > 0) facts.push(['Bestellung', s.orderNumbers.join(', ')]);
  const boxW = 90;
  const labelW = 36;
  const boxX = PAGE_W - MARGIN - boxW + 3;
  let fy = MARGIN;
  doc.setDrawColor(200);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(boxX - 3, fy - 4, boxW, facts.length * 5.2 + 4, 1.5, 1.5, 'FD');
  for (const [k, v] of facts) {
    text(k, boxX, fy + 1, { size: 8, color: 90, maxWidth: labelW - 1 });
    text(v, boxX + labelW, fy + 1, { size: 9, bold: k === 'Lieferschein-Nr.', maxWidth: boxW - labelW - 6 });
    fy += 5.2;
  }
  y = Math.max(y + 16, fy + 6);

  // ── Beteiligte (2 × 2) ──
  const blocks: [string, Party | undefined][] = [
    ['Lieferant', roleParty(m, 'supplier')],
    ['Käufer', roleParty(m, 'buyer')],
    ['Lieferadresse', roleParty(m, 'shipTo')],
    ['Spediteur', roleParty(m, 'carrier')],
  ];
  const colW = CONTENT_W / 2 - 3;
  for (let row = 0; row < 2; row++) {
    let rowHeight = 0;
    for (let col = 0; col < 2; col++) {
      const [title, party] = blocks[row * 2 + col];
      const x = MARGIN + col * (colW + 6);
      let by = y;
      text(title.toUpperCase(), x, by, { size: 7, bold: true, color: 60 });
      by += 4;
      if (party) {
        by += text(partyTitle(party), x, by, { size: 9.5, bold: true, maxWidth: colW });
        for (const line of addressLines(party)) by += text(line, x, by, { size: 9, maxWidth: colW });
        if (party.id) by += text(`Kennung: ${party.id}`, x, by, { size: 7.5, color: 100, maxWidth: colW });
      } else {
        by += text('nicht angegeben', x, by, { size: 9, color: 140 });
      }
      rowHeight = Math.max(rowHeight, by - y);
    }
    y += rowHeight + 5;
  }

  // ── Transport, Lieferbedingung, Hinweise ──
  const extra: string[] = [];
  for (const t of m.transports) {
    extra.push(
      `Transport: ${[codeText(t.mode) || t.modeText, t.carrierName ?? t.carrierId, t.vehicleId && `Kennzeichen ${t.vehicleId}`].filter(Boolean).join(', ')}`,
    );
  }
  for (const e of m.equipment) extra.push(`${codeText(e.qualifier) || 'Equipment'}: ${e.id ?? '-'}`);
  for (const term of m.deliveryTerms) extra.push(`Lieferbedingung: ${[term.code?.known ? `${term.code.code} (${term.code.label})` : term.code?.code, term.text].filter(Boolean).join(', ')}`);
  for (const p of m.parties) for (const l of p.locations) extra.push(`${codeText(l.qualifier) || 'Ort'}: ${l.id ?? l.name ?? ''}`);
  for (const n of m.notes) extra.push(`Hinweis: ${n.text}`);
  for (const line of extra) y += text(line, MARGIN, y, { size: 8.5 }) + 0.8;
  if (extra.length) y += 3;

  // ── Positionen ──
  const items = lineItemsTable(m);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: 20 },
    head: [['Pos.', 'Materialnr.', 'Bezeichnung', 'Menge', 'Einheit', 'Charge', 'Bestellung', 'Packst.']],
    body: items.rows.map((r) => [
      pdfSafe(r.pos),
      pdfSafe(r.materialNumber),
      pdfSafe(r.description),
      typeof r.quantity === 'number' ? pdfSafe(fmtNumber(r.quantity)) : pdfSafe(r.quantity),
      pdfSafe(r.unit),
      pdfSafe(r.batch),
      pdfSafe([r.orderNumber, r.orderLine].filter(Boolean).join(' / ')),
      pdfSafe(r.package),
    ]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, valign: 'top' },
    headStyles: { fillColor: [29, 95, 209], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 34 },
      3: { halign: 'right', cellWidth: 15 },
      4: { cellWidth: 14 },
      5: { cellWidth: 20 },
      6: { cellWidth: 26 },
      7: { cellWidth: 13 },
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Summen ──
  const sums = [
    `Positionen: ${s.lineItemCount}`,
    s.packageCounts.length > 0 && `Packstücke: ${packageCountsText(m)}`,
    s.quantityTotals.length > 0 && `Liefermenge: ${s.quantityTotals.map((t) => `${fmtNumber(t.total)} ${unitText(t.unit)}`.trim()).join(', ')}`,
    s.grossWeight && `Bruttogewicht: ${measurementText(s.grossWeight)}`,
    s.netWeight && `Nettogewicht: ${measurementText(s.netWeight)}`,
  ].filter(Boolean) as string[];
  if (y > PAGE_H - 40) {
    doc.addPage();
    y = MARGIN + 4;
  }
  text('Summen', MARGIN, y, { size: 10, bold: true });
  y += 5;
  y += text(sums.join('   |   '), MARGIN, y, { size: 9 }) + 4;

  // ── Packstücke ──
  const packages = packagesTable(m);
  if (packages.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, bottom: 20 },
      head: [['Packstück-Ebene', 'Anzahl / Packmittel', 'Nummern (SSCC, Etiketten)', 'Inhalt']],
      body: packages.rows.map((r) => [
        pdfSafe(`${'  '.repeat(Number(r.depth ?? 0))}${r.path}`),
        pdfSafe([r.count !== undefined ? `${fmtNumber(r.count as number)} ×` : '', r.type].filter(Boolean).join(' ')),
        pdfSafe(r.numbers),
        pdfSafe([r.perPack, r.items].filter(Boolean).join('\n')),
      ]),
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.4, valign: 'top' },
      headStyles: { fillColor: [90, 105, 125], textColor: 255 },
      columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 32 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Prüfhinweise (nur Fehler/Warnungen) ──
  const problems = result.issues.filter((i) => i.severity !== 'info' && (i.messageIndex === undefined || i.messageIndex === messageIndex));
  if (problems.length > 0) {
    if (y > PAGE_H - 40) {
      doc.addPage();
      y = MARGIN + 4;
    }
    text(`Prüfhinweise (${problems.length})`, MARGIN, y, { size: 10, bold: true, color: 150 });
    y += 5;
    for (const p of problems) {
      if (y > PAGE_H - 25) {
        doc.addPage();
        y = MARGIN + 4;
      }
      y += text(`${p.severity === 'error' ? 'Fehler' : 'Warnung'}: ${p.message}`, MARGIN, y, { size: 8 }) + 1;
    }
  }

  // ── Fußzeile auf jeder Seite ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(210);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
    text(
      `Automatisch erstellte Darstellung eines elektronischen Lieferavises (DESADV, Ref. ${m.reference}) aus „${meta.source}“ – erstellt mit DESADViewer am ${germanDateTime(meta.exportedAt)}.`,
      MARGIN,
      PAGE_H - 10,
      { size: 7, color: 120, maxWidth: CONTENT_W - 25 },
    );
    text(`Seite ${i} von ${pages}`, PAGE_W - MARGIN, PAGE_H - 10, { size: 7, color: 120, align: 'right', maxWidth: 25 });
  }

  return doc.output('arraybuffer');
}
