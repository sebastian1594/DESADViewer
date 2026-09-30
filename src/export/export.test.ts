import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import sample1 from '../../samples/01-d96a-einfach.edi?raw';
import sample2 from '../../samples/02-d07a-automotive-mehrstufig.edi?raw';
import sample4 from '../../samples/04-d01b-eigenes-una-escape.edi?raw';
import sample5 from '../../samples/05-fehlerhaft.edi?raw';
import { parseEdifact } from '../parser';
import { createExport, exportFilename, safeFilePart } from './index';
import { buildPdf, pdfSafe } from './pdf';
import { headerTable, lineItemsTable, packagesTable } from './tables';
import { escapeXml, toCsv, toJson, toXml } from './text';
import { buildXlsx } from './xlsx';

const meta = { source: 'test.edi', exportedAt: new Date('2024-05-01T10:00:00Z') };
const r1 = parseEdifact(sample1);
const r2 = parseEdifact(sample2);

describe('Tabellen', () => {
  it('enthält die Kopfdaten', () => {
    const t = headerTable(r1, r1.messages[0]);
    const map = Object.fromEntries(t.rows.map((r) => [r.field, r.value]));
    expect(map['Lieferscheinnr. / Dokumentnr.']).toBe('LS-2024-0315');
    expect(map['EDIFACT-Version']).toBe('DESADV · D.96A · Subset EAN005');
    expect(map['Bruttogewicht']).toBe('412,5 Kilogramm');
    expect(map['Absender (UNB)']).toBe('9521234000006');
  });

  it('zeigt ungültige Packstück-Anzahlen nicht als 0', () => {
    const r5 = parseEdifact(sample5);
    const map = Object.fromEntries(headerTable(r5, r5.messages[0]).rows.map((r) => [r.field, r.value]));
    expect(map['Packstücke']).toBe('? × Karton (Anzahl teilweise ungültig)');
    expect(map['Packstücke']).not.toContain('0 ×');
  });

  it('liefert Positionen mit Zahlen als Zahlen', () => {
    const t = lineItemsTable(r1.messages[0]);
    expect(t.rows[0]).toMatchObject({ pos: '1', itemNumber: '9521234111115', quantity: 24, unit: 'Stück', unitCode: 'PCE', orderNumber: '4500012345', orderLine: '10' });
    expect(t.rows[1].batch).toBe('CH2403-A');
  });

  it('übernimmt Material- und Bestellnummer nach den EDIFACT-Qualifiern', () => {
    const r7 = parseEdifact(
      "UNH+1+DESADV:D:07A:UN'BGM+351+LS-1+9'LIN+1++LF-5520:SA'PIA+1+KD-100200-01:IN'QTY+12:200:PCE'RFF+ON:PO-77001:10'" +
        "LIN+2++LF-7781:SA'PIA+1+KD-100200-02:IN'QTY+12:200:PCE'RFF+ON:PO-77002:20'UNT+12+1'",
    );
    const t = lineItemsTable(r7.messages[0]);
    expect(t.rows[0]).toMatchObject({ materialNumber: 'KD-100200-01', itemNumber: 'LF-5520', orderNumber: 'PO-77001', orderLine: '10' });
    expect(t.rows[1]).toMatchObject({ materialNumber: 'KD-100200-02', orderNumber: 'PO-77002', orderLine: '20' });
  });

  it('macht den Packbaum zu einer flachen Tabelle mit Pfad', () => {
    const t = packagesTable(r2.messages[0]);
    expect(t.rows.map((r) => r.path)).toEqual(['1', '1 > 2', '1 > 2 > 3', '1 > 2 > 4', '1 > 5', '1 > 5 > 6']);
    expect(t.rows[2]).toMatchObject({ count: 4, type: 'Karton', numbers: 'Packstück-Etikettennummer: 100001–100004' });
    expect(t.rows[2].items).toBe('Pos. 1 A-4711-01 (200 Stück)');
  });
});

describe('CSV', () => {
  it('nutzt Semikolon, Dezimalkomma und Anführungszeichen bei Bedarf', () => {
    const csv = toCsv({
      name: 'T',
      columns: [
        { key: 'a', header: 'Text' },
        { key: 'b', header: 'Zahl' },
      ],
      rows: [
        { a: 'Profil; 20"', b: 12.5 },
        { a: 'Zeile\nzwei', b: 3 },
        { a: undefined, b: undefined },
      ],
    });
    expect(csv).toBe('Text;Zahl\r\n"Profil; 20""";12,5\r\n"Zeile\nzwei";3\r\n;\r\n');
  });

  it('entschärft Texte, die wie Excel-Formeln aussehen', () => {
    const csv = toCsv({ name: 'T', columns: [{ key: 'a', header: 'A' }], rows: [{ a: '=SUMME(A1)' }, { a: '+49 123' }, { a: '-5' }] });
    expect(csv.split('\r\n').slice(1, 4)).toEqual(["'=SUMME(A1)", "'+49 123", '-5']);
  });

  it('exportiert die Positionen mit UTF-8-Kennung für Excel', async () => {
    const r4 = parseEdifact(sample4);
    const file = await createExport('csv', r4, 0, meta);
    const text = file.data as string;
    expect(text.startsWith('﻿Pos.;Materialnr.;Artikelnr. (LIN);')).toBe(true);
    expect(text).toContain('Profil 20*30 mm, Länge >2 m;12,5;Kilogramm');
  });
});

describe('JSON', () => {
  it('enthält das vollständige Datenmodell und lässt sich wieder einlesen', () => {
    const data = JSON.parse(toJson(r1, meta));
    expect(data.generator).toBe('DESADViewer');
    expect(data.exportedAt).toBe('2024-05-01T10:00:00.000Z');
    expect(data.messages[0].lineItems).toHaveLength(2);
    expect(data.segments).toHaveLength(r1.segments.length);
    expect(data.messages[0].version.directory).toBe('D.96A');
  });
});

describe('XML', () => {
  it('maskiert Sonderzeichen', () => {
    expect(escapeXml('A & B <c> "d"\u0001')).toBe('A &amp; B &lt;c&gt; &quot;d&quot;');
  });

  it('erzeugt lesbares XML mit Listen und Codes', () => {
    const xml = toXml(r1, meta);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<desadvExport generator="DESADViewer"')).toBe(true);
    expect(xml).toContain('<qualifier code="SU" list="3035" known="true" en="Supplier">Lieferant</qualifier>');
    expect(xml).toContain('<lineItems>');
    expect(xml).toContain('<lineItem>');
    expect(xml).toContain('<documentNumber>LS-2024-0315</documentNumber>');
    expect(xml).toMatch(/<entry key="\d+">/);
    expect(xml.trimEnd().endsWith('</desadvExport>')).toBe(true);
  });

  it('ist wohlgeformt (jedes geöffnete Element wird geschlossen)', () => {
    const xml = toXml(parseEdifact(sample5), meta);
    const stack: string[] = [];
    for (const [, close, name, selfClosing] of xml.matchAll(/<(\/?)([A-Za-z_][\w.-]*)[^>]*?(\/?)>/g)) {
      if (selfClosing) continue;
      if (close) expect(stack.pop()).toBe(name);
      else stack.push(name);
    }
    expect(stack).toEqual([]);
  });
});

describe('Dateinamen', () => {
  it('erzeugt sichere Dateinamen', () => {
    expect(safeFilePart('LS 2024/03 Ä')).toBe('LS_2024_03_A');
    expect(exportFilename(r1, 0, 'x.edi', 'pdf')).toBe('Lieferavis_LS-2024-0315.pdf');
    expect(exportFilename(r1, 0, 'x.edi', 'csv')).toBe('Lieferavis_LS-2024-0315_Positionen.csv');
    expect(exportFilename(r1, 0, 'Beispiel: 01-d96a-einfach.edi', 'json')).toBe('01-d96a-einfach.json');
  });
});

describe('PDF', () => {
  it('ersetzt Zeichen, die PDF-Standardschriften nicht kennen', () => {
    expect(pdfSafe('„Test“ – 5 € → ok ✓ ÄÖÜß ×')).toBe('"Test" - 5 EUR -> ok OK ÄÖÜß ×');
    expect(pdfSafe('😀')).toBe('??');
  });

  it('erzeugt ein PDF-Dokument', async () => {
    const bytes = new Uint8Array(await buildPdf(r2, 0, meta));
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text).toContain('Lieferschein');
    expect(text).toContain('80012345');
    expect(text).toContain('Halter links');
    expect(bytes.length).toBeGreaterThan(5000);
  });

  it('funktioniert auch mit fehlerhaften Dateien', async () => {
    const bytes = new Uint8Array(await buildPdf(parseEdifact(sample5), 0, meta));
    expect(new TextDecoder('latin1').decode(bytes)).toContain('Prüfhinweise');
  });
});

describe('Excel', () => {
  it('erzeugt eine Arbeitsmappe mit allen Blättern und echten Zahlen', async () => {
    const buffer = await buildXlsx(r2, 0, meta);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Kopf', 'Beteiligte', 'Positionen', 'Packstücke', 'Prüfergebnis']);

    const pos = wb.getWorksheet('Positionen')!;
    expect(pos.getRow(1).getCell(1).value).toBe('Pos.');
    expect(pos.getRow(2).getCell(2).value).toBe('A-4711-01');
    expect(pos.getRow(1).getCell(7).value).toBe('Menge');
    expect(pos.getRow(2).getCell(7).value).toBe(200);
    expect(pos.rowCount).toBe(4);

    const packs = wb.getWorksheet('Packstücke')!;
    expect(packs.getRow(3).getCell(1).value).toBe('1 > 2');
  });
});
