/**
 * Zentrale Stelle für alle Exporte. Alles läuft im Browser – es wird nichts hochgeladen.
 *
 * PDF, Excel, CSV: beziehen sich auf die gerade gewählte Nachricht.
 * JSON, XML:       enthalten das vollständige Datenmodell der ganzen Datei.
 */
import type { ParseResult } from '../parser';
import { lineItemsTable } from './tables';
import { toCsv, toJson, toXml, type ExportMeta } from './text';

export type ExportFormat = 'pdf' | 'xlsx' | 'csv' | 'json' | 'xml';

export interface ExportFile {
  data: BlobPart;
  filename: string;
  mime: string;
}

export const EXPORT_FORMATS: { format: ExportFormat; label: string; description: string; wholeFile: boolean }[] = [
  { format: 'pdf', label: 'PDF', description: 'Lesbarer Lieferschein zum Drucken oder Weiterleiten', wholeFile: false },
  { format: 'xlsx', label: 'Excel', description: 'Arbeitsmappe mit den Blättern Kopf, Beteiligte, Positionen, Packstücke, Prüfergebnis', wholeFile: false },
  { format: 'csv', label: 'CSV', description: 'Positionen als Tabelle (Semikolon, deutsches Zahlenformat)', wholeFile: false },
  { format: 'json', label: 'JSON', description: 'Vollständiges Datenmodell der ganzen Datei (für Programme)', wholeFile: true },
  { format: 'xml', label: 'XML', description: 'Vollständiges Datenmodell der ganzen Datei als XML', wholeFile: true },
];

/** Sicherer Dateiname: nur Buchstaben, Ziffern, Punkt, Minus, Unterstrich */
export function safeFilePart(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'export'
  );
}

export function exportFilename(result: ParseResult, messageIndex: number, source: string, format: ExportFormat): string {
  const wholeFile = EXPORT_FORMATS.find((f) => f.format === format)?.wholeFile;
  let base: string;
  if (wholeFile) {
    base = source.replace(/^Beispiel:\s*/, '').replace(/\.[^.]*$/, '') || 'desadv';
  } else {
    const m = result.messages[messageIndex];
    base = `Lieferavis_${m.summary.documentNumber ?? m.reference}`;
  }
  const suffix = format === 'csv' ? '_Positionen' : '';
  return `${safeFilePart(base)}${suffix}.${format}`;
}

export async function createExport(format: ExportFormat, result: ParseResult, messageIndex: number, meta: ExportMeta): Promise<ExportFile> {
  const filename = exportFilename(result, messageIndex, meta.source, format);
  switch (format) {
    case 'pdf': {
      const { buildPdf } = await import('./pdf');
      return { data: await buildPdf(result, messageIndex, meta), filename, mime: 'application/pdf' };
    }
    case 'xlsx': {
      const { buildXlsx } = await import('./xlsx');
      return { data: await buildXlsx(result, messageIndex, meta), filename, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }
    case 'csv':
      // ﻿ (Byte-Order-Mark) sorgt dafür, dass Excel Umlaute richtig erkennt
      return { data: '﻿' + toCsv(lineItemsTable(result.messages[messageIndex])), filename, mime: 'text/csv;charset=utf-8' };
    case 'json':
      return { data: toJson(result, meta), filename, mime: 'application/json' };
    case 'xml':
      return { data: toXml(result, meta), filename, mime: 'application/xml' };
  }
}

/** Startet den Download im Browser (ohne Server). */
export function downloadFile(file: ExportFile): void {
  const blob = new Blob([file.data], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
