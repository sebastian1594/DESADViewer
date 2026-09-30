/**
 * Text-Exporte: CSV, JSON und XML (ohne Zusatzbibliotheken).
 */
import type { ParseResult } from '../parser';
import type { Cell, Table } from './tables';

export interface ExportMeta {
  /** Name der eingelesenen Datei */
  source: string;
  exportedAt: Date;
}

// ─── CSV ─────────────────────────────────────────────────────────────────

/**
 * CSV für deutsches Excel: Semikolon als Trenner, Komma als Dezimalzeichen,
 * Zeilenende CRLF. (Das Byte-Order-Mark für UTF-8 ergänzt der Download.)
 */
export function toCsv(table: Table): string {
  const format = (cell: Cell): string => {
    if (cell === undefined) return '';
    if (typeof cell === 'number') return String(cell).replace('.', ',');
    let s = cell;
    // Schutz vor „Formel-Injektion“: Text, der wie eine Formel beginnt, wird entschärft
    if (/^[=+@\t\r]/.test(s) || /^-[^\d]/.test(s)) s = `'${s}`;
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [table.columns.map((c) => format(c.header)), ...table.rows.map((r) => table.columns.map((c) => format(r[c.key])))];
  return lines.map((l) => l.join(';')).join('\r\n') + '\r\n';
}

// ─── JSON ────────────────────────────────────────────────────────────────

export function toJson(result: ParseResult, meta: ExportMeta): string {
  return JSON.stringify(
    {
      generator: 'DESADViewer',
      exportedAt: meta.exportedAt.toISOString(),
      source: meta.source,
      ...result,
    },
    null,
    2,
  );
}

// ─── XML ─────────────────────────────────────────────────────────────────

/** Einzahl für Listen-Elemente: <parties><party>…</party></parties> */
const SINGULAR: Record<string, string> = {
  messages: 'message',
  segments: 'segment',
  issues: 'issue',
  interchanges: 'interchange',
  groups: 'group',
  dates: 'date',
  references: 'reference',
  measurements: 'measurement',
  notes: 'note',
  locations: 'location',
  parties: 'party',
  deliveryTerms: 'deliveryTerm',
  transports: 'transport',
  equipment: 'equipmentItem',
  packages: 'package',
  children: 'package',
  lineItems: 'lineItem',
  controlTotals: 'controlTotal',
  unplacedSegments: 'unplacedSegment',
  contacts: 'contact',
  communications: 'communication',
  packs: 'pack',
  markings: 'marking',
  identifiers: 'identifier',
  ranges: 'range',
  quantities: 'quantity',
  additionalIds: 'additionalId',
  descriptions: 'description',
  batchNumbers: 'batchNumber',
  orderNumbers: 'orderNumber',
  packageCounts: 'packageCount',
  quantityTotals: 'quantityTotal',
  lineItemIndices: 'lineItemIndex',
  handling: 'handlingEntry',
  seals: 'seal',
  marks: 'mark',
  nameAndAddress: 'line',
  name: 'line',
  street: 'line',
  elements: 'element',
  element: 'component',
};

const XML_NAME = /^[A-Za-z_][\w.-]*$/;

export function escapeXml(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '') // in XML verbotene Zeichen
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isCodedValue(v: object): v is { code: string; list: string; known: boolean; label?: string } {
  return 'code' in v && 'list' in v && 'known' in v;
}

function xmlNode(name: string, value: unknown, indent: string): string {
  if (value === undefined || value === null) return '';
  const pad = indent;
  if (typeof value !== 'object') return `${pad}<${name}>${escapeXml(String(value))}</${name}>\n`;

  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}<${name}/>\n`;
    const child = SINGULAR[name] ?? 'item';
    return `${pad}<${name}>\n${value.map((v) => xmlNode(child, v, indent + '  ')).join('')}${pad}</${name}>\n`;
  }

  // Codes kompakt: <qualifier code="SU" list="3035" known="true">Lieferant</qualifier>
  if (isCodedValue(value)) {
    const attrs = Object.entries(value)
      .filter(([k, v]) => k !== 'label' && v !== undefined)
      .map(([k, v]) => ` ${k}="${escapeXml(String(v))}"`)
      .join('');
    return value.label ? `${pad}<${name}${attrs}>${escapeXml(value.label)}</${name}>\n` : `${pad}<${name}${attrs}/>\n`;
  }

  const inner = Object.entries(value)
    .map(([k, v]) =>
      XML_NAME.test(k)
        ? xmlNode(k, v, indent + '  ')
        : // z. B. Zahlen-Schlüssel in segmentPlacement → <entry key="12">
          xmlNode('entry', v, indent + '  ').replace(/^(\s*)<entry/, `$1<entry key="${escapeXml(k)}"`),
    )
    .join('');
  return inner ? `${pad}<${name}>\n${inner}${pad}</${name}>\n` : `${pad}<${name}/>\n`;
}

export function toXml(result: ParseResult, meta: ExportMeta): string {
  const attrs = `generator="DESADViewer" exportedAt="${meta.exportedAt.toISOString()}" source="${escapeXml(meta.source)}"`;
  const body = Object.entries(result)
    .map(([k, v]) => xmlNode(k, v, '  '))
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<desadvExport ${attrs}>\n${body}</desadvExport>\n`;
}
