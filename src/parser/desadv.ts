/**
 * DESADV-INTERPRETER – baut aus den Segmenten einer Nachricht das Datenmodell.
 *
 * Funktionsweise (vereinfacht):
 * EDIFACT-Nachrichten bestehen aus verschachtelten „Segmentgruppen“
 * (z. B. NAD mit folgenden CTA/COM, oder CPS → PAC → PCI → GIN, oder LIN → QTY …).
 * Wir führen einen Stapel („Stack“) der gerade offenen Gruppen. Für jedes Segment
 * wird von innen nach außen geschaut, welche offene Gruppe es aufnimmt oder als
 * neue Untergruppe öffnet. Die Regeln (GROUP_RULES) sind eine tolerante
 * Obermenge über alle bekannten DESADV-Versionen – es ist nichts auf eine
 * bestimmte Version verdrahtet.
 *
 * Bedeutungen (Klartext) kommen ausschließlich aus src/knowledge.
 */
import { SUMMARY_RULES, codeListName, describeCode, describeCodeWithAgency, describeVersion, isKnownSegment } from '../knowledge';
import { formatEdiDate } from './dates';
import type { MessageEnvelope } from './envelope';
import type {
  CodedValue,
  Contact,
  DateEntry,
  DeliveryTerm,
  DesadvMessage,
  Equipment,
  FoundNumber,
  FreeText,
  HandlingEntry,
  Identifier,
  Issue,
  LineItem,
  LocationEntry,
  Marking,
  Measurement,
  PackageNode,
  PackEntry,
  Party,
  Quantity,
  RawSegment,
  ReferenceEntry,
  SegmentGroupKind,
  Summary,
  Transport,
} from './model';
import { parseDecimal } from './tokenizer';

// ─── Gruppenregeln ───────────────────────────────────────────────────────

type Kind = SegmentGroupKind;

interface GroupRule {
  /** Segmente, die direkt zu dieser Gruppe gehören */
  accepts: string[];
  /** Segmente, die eine neue Untergruppe öffnen */
  children: Record<string, Kind>;
}

const GROUP_RULES: Record<Kind, GroupRule> = {
  message: {
    accepts: ['BGM', 'DTM', 'ALI', 'MEA', 'MOA', 'FTX', 'LOC', 'CNT'],
    children: { RFF: 'reference', NAD: 'party', TOD: 'terms', TDT: 'transport', EQD: 'equipment', CPS: 'package', LIN: 'line' },
  },
  reference: { accepts: ['DTM'], children: {} },
  party: { accepts: ['LOC', 'FII'], children: { RFF: 'reference', CTA: 'contact' } },
  contact: { accepts: ['COM'], children: {} },
  terms: { accepts: ['LOC', 'FTX'], children: {} },
  transport: { accepts: ['PCD'], children: { LOC: 'location', RFF: 'reference' } },
  location: { accepts: ['DTM'], children: {} },
  equipment: { accepts: ['MEA', 'SEL', 'EQA'], children: { HAN: 'handling' } },
  handling: { accepts: ['FTX'], children: {} },
  package: { accepts: ['FTX'], children: { PAC: 'pack', LIN: 'line' } },
  pack: { accepts: ['MEA', 'QTY', 'DTM', 'RFF'], children: { HAN: 'handling', PCI: 'marking' } },
  marking: { accepts: ['RFF', 'DTM', 'GIR', 'GIN', 'DLM'], children: {} },
  line: {
    accepts: ['PIA', 'IMD', 'MEA', 'QTY', 'ALI', 'GIN', 'GIR', 'DLM', 'DTM', 'FTX', 'MOA', 'HAN', 'QVR', 'PCD'],
    children: { RFF: 'reference', PCI: 'marking', LOC: 'location' },
  },
};

/** Ein Eintrag im Stapel: Gruppenart + das Modellobjekt, das gerade befüllt wird. */
interface Frame {
  kind: Kind;
  // Die Objekte sind je nach Gruppe unterschiedlich; Zugriff erfolgt über die Felder unten.
  obj: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────

const val = (seg: RawSegment, el: number, comp = 0): string | undefined => {
  const v = seg.elements[el]?.[comp];
  return v === undefined || v === '' ? undefined : v;
};

/** Alle nicht-leeren Komponenten eines Elements (ab Position `from`) */
const vals = (seg: RawSegment, el: number, from = 0, to = Infinity): string[] =>
  (seg.elements[el] ?? []).slice(from, to).filter((v) => v !== '');

class Builder {
  private reportedCodes = new Set<string>();
  readonly issues: Issue[] = [];

  constructor(
    private readonly directory: string,
    private readonly messageIndex: number,
  ) {}

  issue(severity: Issue['severity'], code: string, message: string, segmentIndex?: number) {
    this.issues.push({ severity, code, message, segmentIndex, messageIndex: this.messageIndex });
  }

  /** Code nachschlagen; unbekannte Codes einmal pro Nachricht als Hinweis melden. */
  code(list: string, value: string | undefined, segmentIndex: number): CodedValue | undefined {
    const result = describeCode(list, value, this.directory);
    if (!result) return undefined;
    const key = `${list}|${result.code}`;
    if (!this.reportedCodes.has(key)) {
      if (!result.known) {
        this.reportedCodes.add(key);
        const listName = codeListName(list);
        this.issue(
          'info',
          'UNKNOWN_CODE',
          `Code „${result.code}“ (Datenelement ${list}${listName ? ` – ${listName}` : ''}) ist in den Erklär-Daten nicht hinterlegt und wird als „unbekannter Code“ angezeigt.`,
          segmentIndex,
        );
      } else if (result.versionNote) {
        this.reportedCodes.add(key);
        this.issue('info', 'CODE_VERSION_NOTE', `Code „${result.code}“ (Datenelement ${list}): ${result.versionNote}`, segmentIndex);
      }
    }
    return result;
  }

  /** Code einer Liste, die nur nachgeschlagen wird, wenn keine fremde Stelle (3055) angegeben ist. */
  codeUnlessForeignAgency(list: string, value: string | undefined, agency: string | undefined, segmentIndex: number): CodedValue | undefined {
    const result = describeCodeWithAgency(list, value, agency, this.directory);
    if (result?.note) return result; // fremde Codeliste → nicht als „unbekannt“ melden
    return this.code(list, value, segmentIndex);
  }

  number(raw: string | undefined, what: string, segmentIndex: number): number | undefined {
    if (raw === undefined) return undefined;
    const n = parseDecimal(raw);
    if (n === undefined) this.issue('warning', 'INVALID_NUMBER', `${what}: „${raw}“ ist keine gültige Zahl.`, segmentIndex);
    return n;
  }

  // ── Segment-Leser ──

  date(seg: RawSegment): DateEntry {
    const value = val(seg, 0, 1) ?? '';
    const formatCode = val(seg, 0, 2);
    const formatted = formatEdiDate(value, formatCode);
    const qualifier = this.code('2005', val(seg, 0, 0), seg.index);
    const what = qualifier?.label ?? `DTM ${val(seg, 0, 0) ?? ''}`.trim();
    if (!formatted.valid) {
      this.issue('warning', 'INVALID_DATE', `${what}: ${formatted.error}`, seg.index);
    } else if (!formatted.recognized && formatted.error) {
      this.issue('info', 'DATE_FORMAT_UNKNOWN', `${what}: ${formatted.error}`, seg.index);
    }
    return { qualifier, value, format: this.code('2379', formatCode, seg.index), formatted, segmentIndex: seg.index };
  }

  reference(seg: RawSegment): ReferenceEntry {
    return {
      qualifier: this.code('1153', val(seg, 0, 0), seg.index),
      value: val(seg, 0, 1) ?? '',
      lineNumber: val(seg, 0, 2),
      dates: [],
      segmentIndex: seg.index,
    };
  }

  measurement(seg: RawSegment): Measurement {
    const rawValue = val(seg, 2, 1);
    return {
      purpose: this.code('6311', val(seg, 0), seg.index),
      dimension: this.code('6313', val(seg, 1, 0), seg.index),
      unit: this.code('6411', val(seg, 2, 0), seg.index),
      value: this.number(rawValue, 'Messwert (MEA)', seg.index),
      rawValue,
      segmentIndex: seg.index,
    };
  }

  quantity(seg: RawSegment): Quantity {
    const rawValue = val(seg, 0, 1) ?? '';
    const qualifier = this.code('6063', val(seg, 0, 0), seg.index);
    if (!rawValue) this.issue('warning', 'QTY_EMPTY', 'Mengenangabe (QTY) ohne Menge.', seg.index);
    return {
      qualifier,
      rawValue,
      value: rawValue ? this.number(rawValue, `Menge (${qualifier?.label ?? 'QTY'})`, seg.index) : undefined,
      unit: this.code('6411', val(seg, 0, 2), seg.index),
      segmentIndex: seg.index,
    };
  }

  freeText(seg: RawSegment): FreeText {
    return { subject: this.code('4451', val(seg, 0), seg.index), text: vals(seg, 3).join(' '), segmentIndex: seg.index };
  }

  location(seg: RawSegment): LocationEntry {
    return {
      qualifier: this.code('3227', val(seg, 0), seg.index),
      id: val(seg, 1, 0),
      idAgency: this.code('3055', val(seg, 1, 2), seg.index),
      name: val(seg, 1, 3),
      dates: [],
      segmentIndex: seg.index,
    };
  }

  identifier(seg: RawSegment): Identifier {
    const ranges = seg.elements
      .slice(1)
      .filter((c) => c.some((v) => v !== ''))
      .map((c) => (c[1] ? { from: c[0], to: c[1] } : { from: c[0] }));
    return { qualifier: this.code('7405', val(seg, 0), seg.index), ranges, segmentIndex: seg.index };
  }

  party(seg: RawSegment): Party {
    return {
      qualifier: this.code('3035', val(seg, 0), seg.index),
      id: val(seg, 1, 0),
      idCodeList: val(seg, 1, 1),
      idAgency: this.code('3055', val(seg, 1, 2), seg.index),
      nameAndAddress: vals(seg, 2),
      name: vals(seg, 3, 0, 5),
      street: vals(seg, 4),
      city: val(seg, 5),
      region: val(seg, 6, 3) ?? val(seg, 6, 0),
      postalCode: val(seg, 7),
      country: this.code('3207', val(seg, 8), seg.index),
      locations: [],
      references: [],
      contacts: [],
      segmentIndex: seg.index,
    };
  }

  transport(seg: RawSegment): Transport {
    // C228 (D.96A: 8179:8178) bzw. C001 (ab D.01B: 8179:1131:3055:8178) – Code steht immer vorne.
    return {
      stage: this.code('8051', val(seg, 0), seg.index),
      journeyId: val(seg, 1),
      mode: this.code('8067', val(seg, 2, 0), seg.index),
      modeText: val(seg, 2, 1),
      meansType: this.code('8179', val(seg, 3, 0), seg.index),
      carrierId: val(seg, 4, 0),
      carrierName: val(seg, 4, 3),
      vehicleId: val(seg, 7, 0),
      vehicleName: val(seg, 7, 3),
      vehicleNationality: this.code('3207', val(seg, 7, 4), seg.index),
      locations: [],
      references: [],
      segmentIndex: seg.index,
    };
  }

  pack(seg: RawSegment): PackEntry {
    const rawCount = val(seg, 0);
    return {
      rawCount,
      count: this.number(rawCount, 'Anzahl Packstücke (PAC)', seg.index),
      level: this.code('7075', val(seg, 1, 0), seg.index),
      type: this.codeUnlessForeignAgency('7065', val(seg, 2, 0), val(seg, 2, 2), seg.index),
      typeDescription: val(seg, 2, 3),
      measurements: [],
      quantities: [],
      dates: [],
      references: [],
      markings: [],
      handling: [],
      segmentIndex: seg.index,
    };
  }

  marking(seg: RawSegment): Marking {
    return {
      instruction: this.code('4233', val(seg, 0), seg.index),
      marks: vals(seg, 1),
      references: [],
      dates: [],
      identifiers: [],
      segmentIndex: seg.index,
    };
  }

  line(seg: RawSegment, packageId: string | undefined): LineItem {
    return {
      lineNumber: val(seg, 0),
      action: this.code('1229', val(seg, 1), seg.index),
      itemNumber: val(seg, 2, 0),
      itemNumberType: this.code('7143', val(seg, 2, 1), seg.index),
      parentLineNumber: val(seg, 3, 1),
      additionalIds: [],
      descriptions: [],
      quantities: [],
      measurements: [],
      dates: [],
      references: [],
      identifiers: [],
      markings: [],
      locations: [],
      notes: [],
      packageId,
      batchNumbers: [],
      segmentIndex: seg.index,
    };
  }

  handling(seg: RawSegment): HandlingEntry {
    return { code: val(seg, 0, 0), text: val(seg, 0, 3), notes: [], segmentIndex: seg.index };
  }
}

// ─── Hauptfunktion ───────────────────────────────────────────────────────

export function buildDesadv(envelope: MessageEnvelope, allSegments: RawSegment[], messageIndex: number): { message: DesadvMessage; issues: Issue[] } {
  const id = envelope.identifier;
  const version = describeVersion(id.version, id.release, id.associationCode);
  const b = new Builder(version.directory, messageIndex);

  const message: DesadvMessage = {
    index: messageIndex,
    reference: envelope.reference,
    identifier: id,
    version,
    segmentRange: { start: envelope.start, end: envelope.end },
    header: {},
    dates: [],
    references: [],
    measurements: [],
    notes: [],
    locations: [],
    parties: [],
    deliveryTerms: [],
    transports: [],
    equipment: [],
    packages: [],
    lineItems: [],
    controlTotals: [],
    unplacedSegments: [],
    segmentPlacement: { [envelope.start]: { depth: 0, group: 'message' } },
    summary: undefined as unknown as Summary,
  };

  const packageNodes: PackageNode[] = [];
  const stack: Frame[] = [{ kind: 'message', obj: message }];

  const body = allSegments.slice(envelope.start + 1, envelope.closed ? envelope.end : envelope.end + 1);

  for (const seg of body) {
    // Von innen nach außen suchen: Untergruppe öffnen oder Segment aufnehmen?
    let handled = false;
    for (let depth = stack.length - 1; depth >= 0; depth--) {
      const frame = stack[depth];
      const rule = GROUP_RULES[frame.kind];
      const childKind = rule.children[seg.tag];
      if (childKind) {
        stack.length = depth + 1;
        const child = openGroup(b, childKind, frame, seg, message, packageNodes);
        stack.push({ kind: childKind, obj: child });
        message.segmentPlacement[seg.index] = { depth, group: childKind };
        handled = true;
        break;
      }
      if (rule.accepts.includes(seg.tag)) {
        stack.length = depth + 1;
        message.segmentPlacement[seg.index] = { depth, group: frame.kind };
        if (!applySegment(b, frame, seg, message)) {
          message.unplacedSegments.push({ segmentIndex: seg.index, tag: seg.tag, reason: 'not-evaluated' });
        }
        handled = true;
        break;
      }
    }
    if (!handled) {
      message.segmentPlacement[seg.index] = { depth: 0, group: 'message' };
      if (!isKnownSegment(seg.tag)) {
        message.unplacedSegments.push({ segmentIndex: seg.index, tag: seg.tag, reason: 'unknown-segment' });
        b.issue('info', 'UNKNOWN_SEGMENT', `Segment „${seg.tag}“ ist in den Erklär-Daten nicht beschrieben. Es wird in der Segmentansicht roh angezeigt.`, seg.index);
      } else {
        message.unplacedSegments.push({ segmentIndex: seg.index, tag: seg.tag, reason: 'unexpected-position' });
        b.issue('warning', 'UNEXPECTED_SEGMENT', `Segment „${seg.tag}“ steht an einer unerwarteten Stelle und wird im Dashboard nicht ausgewertet.`, seg.index);
      }
    }
  }

  if (envelope.closed) message.segmentPlacement[envelope.end] = { depth: 0, group: 'message' };
  message.packages = buildPackageTree(b, packageNodes);
  const outerRefs = outerReferences(message);
  for (const item of message.lineItems) {
    deriveLineFields(item);
    findNumbers(item, outerRefs);
  }
  message.summary = buildSummary(message);
  runChecks(b, message);

  return { message, issues: b.issues };
}

/** Öffnet eine neue Segmentgruppe und hängt das Objekt an die Elterngruppe. */
function openGroup(b: Builder, kind: Kind, parent: Frame, seg: RawSegment, message: DesadvMessage, packageNodes: PackageNode[]): unknown {
  const p = parent.obj;
  switch (kind) {
    case 'reference': {
      const ref = b.reference(seg);
      p.references.push(ref);
      return ref;
    }
    case 'party': {
      const party = b.party(seg);
      message.parties.push(party);
      return party;
    }
    case 'contact': {
      const contact: Contact = {
        function: b.code('3139', val(seg, 0), seg.index),
        departmentCode: val(seg, 1, 0),
        name: val(seg, 1, 1),
        communications: [],
        segmentIndex: seg.index,
      };
      (p as Party).contacts.push(contact);
      return contact;
    }
    case 'terms': {
      const term: DeliveryTerm = {
        function: val(seg, 0),
        code: b.code('4053', val(seg, 2, 0), seg.index),
        text: vals(seg, 2, 3).join(' ') || undefined,
        locations: [],
        notes: [],
        segmentIndex: seg.index,
      };
      message.deliveryTerms.push(term);
      return term;
    }
    case 'transport': {
      const t = b.transport(seg);
      message.transports.push(t);
      return t;
    }
    case 'location': {
      const loc = b.location(seg);
      p.locations.push(loc);
      return loc;
    }
    case 'equipment': {
      const eq: Equipment = {
        qualifier: b.code('8053', val(seg, 0), seg.index),
        id: val(seg, 1, 0),
        sizeType: val(seg, 2, 0) ?? val(seg, 2, 3),
        measurements: [],
        seals: [],
        handling: [],
        segmentIndex: seg.index,
      };
      message.equipment.push(eq);
      return eq;
    }
    case 'handling': {
      const h = b.handling(seg);
      p.handling.push(h);
      return h;
    }
    case 'package': {
      const node: PackageNode = {
        id: val(seg, 0) ?? '',
        parentId: val(seg, 1),
        level: b.code('7075', val(seg, 2), seg.index),
        notes: [],
        packs: [],
        lineItemIndices: [],
        children: [],
        segmentIndex: seg.index,
      };
      if (!node.id) b.issue('warning', 'CPS_NO_ID', 'Packstück-Ebene (CPS) ohne Nummer.', seg.index);
      packageNodes.push(node);
      return node;
    }
    case 'pack': {
      const pack = b.pack(seg);
      (p as PackageNode).packs.push(pack);
      return pack;
    }
    case 'marking': {
      const m = b.marking(seg);
      p.markings.push(m);
      return m;
    }
    case 'line': {
      const packageId = parent.kind === 'package' ? (p as PackageNode).id : undefined;
      const item = b.line(seg, packageId);
      message.lineItems.push(item);
      if (parent.kind === 'package') (p as PackageNode).lineItemIndices.push(message.lineItems.length - 1);
      return item;
    }
    case 'message':
      return message;
  }
}

/** Übernimmt ein einfaches Segment in die aktuelle Gruppe. false = nicht ausgewertet. */
function applySegment(b: Builder, frame: Frame, seg: RawSegment, message: DesadvMessage): boolean {
  const o = frame.obj;
  switch (seg.tag) {
    case 'BGM':
      message.header = {
        documentName: b.code('1001', val(seg, 0, 0), seg.index),
        documentNameText: val(seg, 0, 3),
        documentNumber: val(seg, 1, 0),
        messageFunction: b.code('1225', val(seg, 2), seg.index),
        segmentIndex: seg.index,
      };
      return true;
    case 'DTM':
      if (!Array.isArray(o.dates)) return false;
      o.dates.push(b.date(seg));
      return true;
    case 'MEA':
      if (!Array.isArray(o.measurements)) return false;
      o.measurements.push(b.measurement(seg));
      return true;
    case 'QTY':
      if (!Array.isArray(o.quantities)) return false;
      o.quantities.push(b.quantity(seg));
      return true;
    case 'FTX':
      if (!Array.isArray(o.notes)) return false;
      o.notes.push(b.freeText(seg));
      return true;
    case 'LOC':
      if (!Array.isArray(o.locations)) return false;
      o.locations.push(b.location(seg));
      return true;
    case 'RFF':
      if (!Array.isArray(o.references)) return false;
      o.references.push(b.reference(seg));
      return true;
    case 'GIN':
      if (!Array.isArray(o.identifiers)) return false;
      o.identifiers.push(b.identifier(seg));
      return true;
    case 'COM':
      (o as Contact).communications.push({ number: val(seg, 0, 0) ?? '', channel: b.code('3155', val(seg, 0, 1), seg.index), segmentIndex: seg.index });
      return true;
    case 'SEL':
      if (val(seg, 0)) (o as Equipment).seals.push(val(seg, 0)!);
      return true;
    case 'PIA': {
      const item = o as LineItem;
      const fn = b.code('4347', val(seg, 0), seg.index);
      for (const comp of seg.elements.slice(1)) {
        if (!comp[0]) continue;
        item.additionalIds.push({ function: fn, id: comp[0], type: b.code('7143', comp[1] || undefined, seg.index), segmentIndex: seg.index });
      }
      return true;
    }
    case 'IMD': {
      const text = vals(seg, 2, 3, 5).join(' ');
      const code = val(seg, 2, 0);
      if (!text && !code) return false;
      (o as LineItem).descriptions.push({ format: b.code('7077', val(seg, 0), seg.index), code, text, segmentIndex: seg.index });
      return true;
    }
    case 'ALI':
      if (frame.kind !== 'line' || !val(seg, 0)) return false;
      (o as LineItem).countryOfOrigin = b.code('3207', val(seg, 0), seg.index);
      return true;
    case 'CNT': {
      const rawValue = val(seg, 0, 1) ?? '';
      message.controlTotals.push({
        qualifier: b.code('6069', val(seg, 0, 0), seg.index),
        rawValue,
        value: b.number(rawValue, 'Kontrollsumme (CNT)', seg.index),
        unit: b.code('6411', val(seg, 0, 2), seg.index),
        segmentIndex: seg.index,
      });
      return true;
    }
    default:
      return false;
  }
}

/** Baut aus den CPS-Knoten den Packbaum (Eltern-Verweis über CPS-Element 2). */
function buildPackageTree(b: Builder, nodes: PackageNode[]): PackageNode[] {
  const byId = new Map<string, PackageNode>();
  for (const node of nodes) {
    if (byId.has(node.id)) {
      b.issue('warning', 'CPS_DUPLICATE_ID', `Die Packstück-Ebene Nr. ${node.id} (CPS) kommt mehrfach vor.`, node.segmentIndex);
    } else {
      byId.set(node.id, node);
    }
  }
  const roots: PackageNode[] = [];
  for (const node of nodes) {
    const parent = node.parentId !== undefined ? byId.get(node.parentId) : undefined;
    if (node.parentId === undefined) {
      roots.push(node);
    } else if (!parent) {
      b.issue(
        'warning',
        'CPS_PARENT_MISSING',
        `Packstück-Ebene Nr. ${node.id} verweist auf die übergeordnete Ebene Nr. ${node.parentId}, die es nicht gibt. Sie wird oben im Baum angezeigt.`,
        node.segmentIndex,
      );
      roots.push(node);
    } else if (createsCycle(node, parent, byId)) {
      b.issue('warning', 'CPS_CYCLE', `Packstück-Ebene Nr. ${node.id} erzeugt einen Kreisverweis und wird oben im Baum angezeigt.`, node.segmentIndex);
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }
  return roots;
}

function createsCycle(node: PackageNode, parent: PackageNode, byId: Map<string, PackageNode>): boolean {
  let current: PackageNode | undefined = parent;
  const seen = new Set<string>();
  while (current) {
    if (current === node) return true;
    if (seen.has(current.id)) return false;
    seen.add(current.id);
    current = current.parentId !== undefined ? byId.get(current.parentId) : undefined;
  }
  return false;
}

/** Leitet Bequemlichkeitsfelder (Beschreibung, Liefermenge, Charge, Bestellbezug) ab. */
function deriveLineFields(item: LineItem): void {
  const rules = SUMMARY_RULES;
  item.description = item.descriptions.find((d) => d.text)?.text;
  for (const q of rules.despatchQuantity) {
    const hit = item.quantities.find((x) => x.qualifier?.code === q);
    if (hit) {
      item.despatchQuantity = hit;
      break;
    }
  }
  const batches = new Set<string>();
  const allIdentifiers = [...item.identifiers, ...item.markings.flatMap((m) => m.identifiers)];
  for (const gin of allIdentifiers) {
    if (gin.qualifier && rules.batch.gin.includes(gin.qualifier.code)) {
      for (const r of gin.ranges) batches.add(r.to ? `${r.from}–${r.to}` : r.from);
    }
  }
  for (const pia of item.additionalIds) {
    if (pia.type && rules.batch.pia.includes(pia.type.code)) batches.add(pia.id);
  }
  for (const ref of item.references) {
    if (ref.qualifier && rules.batch.rff.includes(ref.qualifier.code) && ref.value) batches.add(ref.value);
  }
  item.batchNumbers = [...batches];
  const order = item.references.find((r) => r.qualifier && rules.orderReference.includes(r.qualifier.code));
  if (order) item.orderReference = { number: order.value, line: order.lineNumber };
}

/** „Artikelnummer des Käufers (IN)“ – für die Herkunftsangabe gefundener Nummern */
function kindText(c: CodedValue | undefined): string {
  if (!c) return 'ohne Angabe der Art';
  return c.known && c.label ? `${c.label} (${c.code})` : `Art ${c.code}`;
}

/** Referenzen außerhalb der Positionen: im Nachrichtenkopf und bei den Beteiligten (NAD-Gruppe) */
interface OuterRef {
  ref: ReferenceEntry;
  /** z. B. „im Nachrichtenkopf“ oder „beim Käufer (NAD BY)“ */
  where: string;
}

function outerReferences(m: DesadvMessage): OuterRef[] {
  return [
    ...m.references.map((ref) => ({ ref, where: 'im Nachrichtenkopf' })),
    ...m.parties.flatMap((p) =>
      p.references.map((ref) => ({
        ref,
        where: `bei ${p.qualifier?.known && p.qualifier.label ? p.qualifier.label : 'Beteiligtem'} (NAD ${p.qualifier?.code ?? '?'})`,
      })),
    ),
  ];
}

/** true, wenn die Referenz laut Qualifier eine Bestellnummer ist (SUMMARY_RULES.orderReference, z. B. ON) */
function isOrderReference(ref: ReferenceEntry): boolean {
  return ref.qualifier !== undefined && SUMMARY_RULES.orderReference.includes(ref.qualifier.code) && ref.value !== '';
}

/**
 * Bestimmt Material- und Bestellnummer einer Position – allein über die EDIFACT-Qualifier,
 * unabhängig vom Nummernformat einer bestimmten Firma:
 *  - Materialnr.: Artikelnummer mit Art IN/BP (SUMMARY_RULES.materialNumberTypes) aus LIN oder PIA,
 *                 sonst die Hauptnummer aus LIN
 *  - Bestellnr.:  RFF+ON der Position, sonst im Nachrichtenkopf, sonst bei den Beteiligten (NAD-Gruppe)
 */
function findNumbers(item: LineItem, outerRefs: OuterRef[]): void {
  const materialCandidates: (FoundNumber & { type?: string })[] = [];
  if (item.itemNumber) {
    materialCandidates.push({ value: item.itemNumber, type: item.itemNumberType?.code, source: `LIN · ${kindText(item.itemNumberType)}`, segmentIndex: item.segmentIndex });
  }
  for (const a of item.additionalIds) {
    materialCandidates.push({ value: a.id, type: a.type?.code, source: `PIA · ${kindText(a.type)}`, segmentIndex: a.segmentIndex });
  }
  const byType = findByPriority(materialCandidates, SUMMARY_RULES.materialNumberTypes, (c) => c.type);
  const material = byType ?? materialCandidates[0];
  if (material) item.materialNumber = { value: material.value, source: material.source, segmentIndex: material.segmentIndex };

  const toFound = (r: ReferenceEntry, where?: string): FoundNumber => ({
    value: r.value,
    line: r.lineNumber,
    source: `RFF${where ? ` ${where}` : ''} · ${kindText(r.qualifier)}`,
    segmentIndex: r.segmentIndex,
  });
  const lineOrder = item.references.find(isOrderReference);
  const outerOrder = outerRefs.find((o) => isOrderReference(o.ref));
  if (lineOrder) item.orderNumber = toFound(lineOrder);
  else if (outerOrder) item.orderNumber = toFound(outerOrder.ref, outerOrder.where);
}

function findByPriority<T>(items: T[], codes: string[], getCode: (t: T) => string | undefined): T | undefined {
  for (const code of codes) {
    const hit = items.find((i) => getCode(i) === code);
    if (hit) return hit;
  }
  return undefined;
}

function buildSummary(m: DesadvMessage): Summary {
  const r = SUMMARY_RULES;
  const dateCode = (d: DateEntry) => d.qualifier?.code;
  const partyIndex = (codes: string[]) => {
    const p = findByPriority(m.parties, codes, (x) => x.qualifier?.code);
    return p ? m.parties.indexOf(p) : undefined;
  };

  // Bestellnummern: alle RFF+ON – im Kopf, bei den Beteiligten und bei den Positionen
  const outerRefs = outerReferences(m).map((o) => o.ref);
  const allRefs = [...outerRefs, ...m.lineItems.flatMap((i) => i.references)];
  const orderNumbers = new Set(allRefs.filter(isOrderReference).map((ref) => ref.value));

  // Packstücke je Packmittel zählen
  const packageCounts = new Map<string, Summary['packageCounts'][number]>();
  const visit = (node: PackageNode) => {
    for (const pack of node.packs) {
      const key = pack.type?.code ?? `text:${pack.typeDescription ?? ''}`;
      const entry = packageCounts.get(key) ?? { type: pack.type, description: pack.typeDescription, count: 0 };
      if (pack.count === undefined) entry.invalidCount = true;
      else entry.count += pack.count;
      packageCounts.set(key, entry);
    }
    node.children.forEach(visit);
  };
  m.packages.forEach(visit);

  // Liefermengen je Einheit summieren
  const totals = new Map<string, Summary['quantityTotals'][number]>();
  for (const item of m.lineItems) {
    const q = item.despatchQuantity;
    if (q?.value === undefined) continue;
    const key = q.unit?.code ?? '';
    const entry = totals.get(key) ?? { unit: q.unit, total: 0 };
    entry.total += q.value;
    totals.set(key, entry);
  }

  const documentDate = findByPriority(m.dates, r.documentDate, dateCode);
  const despatchDate = findByPriority(m.dates, r.despatchDate, dateCode);
  const arrivalDate = findByPriority(m.dates, r.arrivalDate, dateCode);
  // Bestelldatum: DTM 4 im Kopf, sonst Datum direkt unter einer Bestellnummer (RFF+ON → DTM)
  const orderRefDates = allRefs.filter(isOrderReference).flatMap((ref) => ref.dates);
  const orderDate = findByPriority(m.dates, r.orderDate, dateCode) ?? findByPriority(orderRefDates, r.orderReferenceDate, dateCode);
  const used = new Set([documentDate, despatchDate, arrivalDate, orderDate]);

  return {
    documentNumber: m.header.documentNumber,
    documentDate,
    despatchDate,
    arrivalDate,
    orderDate,
    otherDates: m.dates.filter((d) => !used.has(d)),
    orderNumbers: [...orderNumbers],
    roles: {
      supplier: partyIndex(r.supplier),
      buyer: partyIndex(r.buyer),
      shipTo: partyIndex(r.shipTo),
      carrier: partyIndex(r.carrier),
    },
    lineItemCount: m.lineItems.length,
    packageCounts: [...packageCounts.values()],
    quantityTotals: [...totals.values()].map((t) => ({ ...t, total: Math.round(t.total * 1e6) / 1e6 })),
    grossWeight: findByPriority(m.measurements, r.grossWeight, (x) => x.dimension?.code),
    netWeight: findByPriority(m.measurements, r.netWeight, (x) => x.dimension?.code),
  };
}

/** Inhaltliche Plausibilitätsprüfungen */
function runChecks(b: Builder, m: DesadvMessage): void {
  if (m.header.segmentIndex === undefined) {
    b.issue('warning', 'BGM_MISSING', 'Die Nachricht hat kein BGM-Segment – Dokumentart und Lieferscheinnummer fehlen.', m.segmentRange.start);
  } else if (!m.header.documentNumber) {
    b.issue('warning', 'BGM_NO_NUMBER', 'Im BGM-Segment fehlt die Dokumentnummer (Lieferscheinnummer).', m.header.segmentIndex);
  }
  if (m.lineItems.length === 0) {
    b.issue('info', 'NO_LINE_ITEMS', 'Die Nachricht enthält keine Positionen (LIN).', m.segmentRange.start);
  }
  for (const cnt of m.controlTotals) {
    if (cnt.qualifier && SUMMARY_RULES.lineCountControl.includes(cnt.qualifier.code) && cnt.value !== undefined && cnt.value !== m.lineItems.length) {
      b.issue(
        'warning',
        'CNT_LINE_COUNT_MISMATCH',
        `Die Kontrollsumme (CNT) meldet ${cnt.rawValue} Positionen, gefunden wurden ${m.lineItems.length}.`,
        cnt.segmentIndex,
      );
    }
  }
}
