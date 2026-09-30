/**
 * Erklärt ein Rohsegment Element für Element mit Hilfe des Erklär-Wissens.
 * Reine Logik ohne React – wird von der Segmentansicht verwendet und getestet.
 */
import { describeCode, describeCodeWithAgency, describeSegment } from '../knowledge';
import type { CodedValue, ComponentDef, ElementDef, SegmentDef } from '../knowledge';
import { formatEdiDate } from '../parser/dates';
import type { RawSegment, SegmentGroupKind } from '../parser/model';
import { showChar } from '../parser/tokenizer';

export interface ExplainedComponent {
  /** 1-basierte Position innerhalb des Datenelements */
  position: number;
  def?: ComponentDef;
  value: string;
  coded?: CodedValue;
  /** Zusätzliche Deutung, z. B. umgewandeltes Datum */
  hint?: string;
  hintIsError?: boolean;
}

export interface ExplainedElement {
  /** 1-basierte Position nach dem Segmentkennzeichen */
  position: number;
  def?: ElementDef;
  isComposite: boolean;
  /** Element steht in der Nachricht, ist aber in den Erklär-Daten nicht beschrieben */
  beyondDefinition: boolean;
  /** Alle Komponenten leer */
  empty: boolean;
  components: ExplainedComponent[];
}

export interface ExplainedSegment {
  def?: SegmentDef;
  elements: ExplainedElement[];
}

export const GROUP_LABELS: Record<SegmentGroupKind, string> = {
  message: 'Nachrichtenebene',
  reference: 'Referenz (RFF-Gruppe)',
  party: 'Beteiligter (NAD-Gruppe)',
  contact: 'Ansprechpartner (CTA-Gruppe)',
  terms: 'Lieferbedingung (TOD-Gruppe)',
  transport: 'Transport (TDT-Gruppe)',
  location: 'Ort (LOC-Gruppe)',
  equipment: 'Equipment (EQD-Gruppe)',
  handling: 'Handhabung (HAN-Gruppe)',
  package: 'Packstück-Ebene (CPS-Gruppe)',
  pack: 'Packstücke (PAC-Gruppe)',
  marking: 'Kennzeichnung (PCI-Gruppe)',
  line: 'Position (LIN-Gruppe)',
};

export function explainSegment(seg: RawSegment, directory?: string): ExplainedSegment {
  const def = describeSegment(seg.tag);

  if (seg.tag === 'UNA') {
    const chars = seg.elements[0]?.[0] ?? '';
    return {
      def,
      elements: (def?.elements ?? []).map((d, i) => ({
        position: i + 1,
        def: d,
        isComposite: false,
        beyondDefinition: false,
        empty: false,
        components: [{ position: 1, value: chars[i] ?? '', hint: chars[i] === ' ' ? showChar(' ') : undefined }],
      })),
    };
  }

  const elements = seg.elements.map((comps, i): ExplainedElement => {
    const elDef = def?.elements[i];
    const compDefs = elDef?.components;
    const agencyPos = compDefs?.findIndex((c) => c.id === '3055') ?? -1;
    const agency = agencyPos >= 0 ? comps[agencyPos] : undefined;

    const components = comps.map((value, j): ExplainedComponent => {
      const compDef: ComponentDef | undefined = compDefs ? compDefs[j] : j === 0 && elDef ? { id: elDef.id, name: elDef.name, codeList: elDef.codeList } : undefined;
      const result: ExplainedComponent = { position: j + 1, def: compDef, value };
      if (value && compDef?.codeList) result.coded = describeCodeWithAgency(compDef.codeList, value, agency, directory);
      // Datumswert direkt umrechnen (DTM C507: 2005:2380:2379)
      if (seg.tag === 'DTM' && compDef?.id === '2380' && value) {
        const formatted = formatEdiDate(value, comps[2] || undefined);
        if (!formatted.valid) {
          result.hint = formatted.error;
          result.hintIsError = true;
        } else if (formatted.recognized) {
          result.hint = formatted.display;
        } else {
          result.hint = formatted.error;
        }
      }
      return result;
    });

    return {
      position: i + 1,
      def: elDef,
      isComposite: Boolean(compDefs) || comps.length > 1,
      beyondDefinition: Boolean(def) && !elDef,
      empty: comps.every((v) => v === ''),
      components,
    };
  });

  return { def, elements };
}

// ─── Kurzbeschreibung für die zugeklappte Zeile ──────────────────────────

const label = (c: CodedValue | undefined): string => (!c ? '' : c.known && c.label ? c.label : `${c.code} (unbekannter Code)`);

/** Einzeilige Zusammenfassung, z. B. „Lieferant: Fantasie Werkzeuge AG“ */
export function segmentSummary(seg: RawSegment, directory?: string): string | undefined {
  const v = (el: number, comp = 0) => seg.elements[el]?.[comp] || undefined;
  const code = (list: string, value: string | undefined) => describeCode(list, value, directory);
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ');

  switch (seg.tag) {
    case 'UNA':
      return 'Legt die Trennzeichen dieser Datei fest';
    case 'UNB':
      return join(v(1), '→', v(2), '· Ref.', v(4));
    case 'UNH':
      return join(v(1, 0), v(1, 1) && v(1, 2) ? `${v(1, 1)}.${v(1, 2)}` : undefined, v(1, 4) && `(${v(1, 4)})`, '· Ref.', v(0));
    case 'UNT':
      return `${v(0) ?? '?'} Segmente · Ref. ${v(1) ?? '?'}`;
    case 'UNZ':
    case 'UNE':
      return `Anzahl ${v(0) ?? '?'} · Ref. ${v(1) ?? '?'}`;
    case 'BGM':
      return join(label(code('1001', v(0, 0))) || v(0, 3), v(1) && `Nr. ${v(1)}`);
    case 'DTM': {
      const f = formatEdiDate(v(0, 1) ?? '', v(0, 2));
      return `${label(code('2005', v(0, 0))) || 'Datum'}: ${f.valid ? f.display : `${v(0, 1) ?? ''} (ungültig)`}`;
    }
    case 'RFF':
      return `${label(code('1153', v(0, 0))) || 'Referenz'}: ${join(v(0, 1), v(0, 2) && `/ Pos. ${v(0, 2)}`)}`;
    case 'NAD':
      return `${label(code('3035', v(0))) || 'Beteiligter'}: ${seg.elements[3]?.filter(Boolean).join(' ') || seg.elements[2]?.[0] || v(1) || ''}`;
    case 'LOC':
      return `${label(code('3227', v(0))) || 'Ort'}: ${v(1, 0) ?? v(1, 3) ?? ''}`;
    case 'CTA':
      return join(label(code('3139', v(0))), v(1, 1));
    case 'COM':
      return `${label(code('3155', v(0, 1))) || 'Kontakt'}: ${v(0, 0) ?? ''}`;
    case 'TDT':
      return join(label(code('8051', v(0))), label(code('8067', v(2, 0))) && `· ${label(code('8067', v(2, 0)))}`, v(4, 3) && `· ${v(4, 3)}`);
    case 'QTY':
      return `${label(code('6063', v(0, 0))) || 'Menge'}: ${join(v(0, 1), label(code('6411', v(0, 2))))}`;
    case 'MEA':
      return `${label(code('6313', v(1, 0))) || 'Messwert'}: ${join(v(2, 1), label(code('6411', v(2, 0))))}`;
    case 'CPS':
      return `Ebene ${v(0) ?? '?'}${v(1) ? ` in Ebene ${v(1)}` : ' (oberste Ebene)'}`;
    case 'PAC': {
      const type = describeCodeWithAgency('7065', v(2, 0), v(2, 2), directory);
      return join(v(0), '×', type?.known ? type.label : v(2, 3) ?? (type ? label(type) : 'Packstück'));
    }
    case 'PCI':
      return label(code('4233', v(0))) || seg.elements[1]?.filter(Boolean).join(' ');
    case 'GIN':
      return `${label(code('7405', v(0))) || 'Nummer'}: ${seg.elements
        .slice(1)
        .map((c) => (c[1] ? `${c[0]} – ${c[1]}` : c[0]))
        .filter(Boolean)
        .join(', ')}`;
    case 'LIN':
      return join(`Position ${v(0) ?? '?'}`, v(2, 0) && `· ${v(2, 0)}`);
    case 'PIA':
      return seg.elements
        .slice(1)
        .filter((c) => c[0])
        .map((c) => `${label(code('7143', c[1] || undefined)) || 'Nr.'}: ${c[0]}`)
        .join(' · ');
    case 'IMD':
      return seg.elements[2]?.slice(3, 5).filter(Boolean).join(' ') || v(2, 0);
    case 'FTX': {
      const text = seg.elements[3]?.filter(Boolean).join(' ') ?? '';
      return text.length > 80 ? `${text.slice(0, 80)} …` : text;
    }
    case 'CNT':
      return `${label(code('6069', v(0, 0))) || 'Kontrollsumme'}: ${v(0, 1) ?? ''}`;
    case 'ALI':
      return v(0) && `Ursprungsland: ${label(code('3207', v(0)))}`;
    case 'EQD':
      return join(label(code('8053', v(0))), v(1, 0));
    case 'TOD':
      return join(label(code('4053', v(2, 0))), v(2, 3));
    default:
      return undefined;
  }
}
