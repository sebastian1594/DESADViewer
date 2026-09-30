/**
 * Excel-Export (.xlsx) mit mehreren Blättern: Kopf, Beteiligte, Positionen, Packstücke, Prüfergebnis.
 * ExcelJS wird erst beim Export nachgeladen.
 */
import type { ParseResult } from '../parser';
import { headerTable, issuesTable, lineItemsTable, packagesTable, partiesTable, type Table } from './tables';
import type { ExportMeta } from './text';

export async function buildXlsx(result: ParseResult, messageIndex: number, meta: ExportMeta): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const m = result.messages[messageIndex];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DESADViewer';
  wb.created = meta.exportedAt;
  wb.title = `Lieferavis ${m.summary.documentNumber ?? m.reference}`;
  wb.description = `Aus „${meta.source}“, Nachricht ${messageIndex + 1}`;

  const tables: Table[] = [headerTable(result, m), partiesTable(m), lineItemsTable(m), packagesTable(m), issuesTable(result, messageIndex)];

  for (const table of tables) {
    const ws = wb.addWorksheet(table.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = table.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 14 }));
    for (const row of table.rows) ws.addRow(row);

    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D5FD1' } };
    head.alignment = { vertical: 'middle' };
    table.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.alignment = { vertical: 'top', wrapText: !c.numeric };
      if (c.numeric) col.numFmt = '#,##0.###';
    });
    if (table.rows.length > 0) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: table.columns.length } };
    }
  }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
