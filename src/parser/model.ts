/**
 * DATENMODELL – das Ergebnis des Parsers.
 *
 * Jedes Objekt merkt sich `segmentIndex` = Position des zugehörigen Segments
 * in `ParseResult.segments`. So kann die Oberfläche später zum Segment springen.
 */
import type { CodedValue, VersionInfo } from '../knowledge/types';

export type { CodedValue, VersionInfo };

// ─── Grundbausteine ──────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'info';

/** Ein Hinweis, eine Warnung oder ein Fehler – immer auf Deutsch. */
export interface Issue {
  severity: Severity;
  /** Maschinenlesbarer Code, z. B. "UNT_COUNT_MISMATCH" */
  code: string;
  message: string;
  segmentIndex?: number;
  messageIndex?: number;
}

export interface Delimiters {
  component: string;
  element: string;
  decimal: string;
  release: string;
  repetition: string;
  segment: string;
}

/** Ein Segment, wie es in der Datei steht – nur zerlegt, noch nicht interpretiert. */
export interface RawSegment {
  /** Position in der Datei (0 = erstes Segment) */
  index: number;
  tag: string;
  /** elements[i][j] = Komponente j des Datenelements i (Escape-Zeichen bereits aufgelöst) */
  elements: string[][];
  /** Originaltext inkl. Endezeichen (ohne Zeilenumbrüche) */
  raw: string;
  /** Zeichenposition in der Eingabe */
  offset: number;
  /** Zeilennummer in der Eingabe (ab 1) */
  line: number;
}

/** Ergebnis der Datumsumwandlung */
export interface FormattedDate {
  /** false = Wert passt nicht zum Format oder ist kein gültiges Datum */
  valid: boolean;
  /** true = Format wurde erkannt und umgewandelt */
  recognized: boolean;
  /** Deutsche Anzeige, z. B. "15.03.2024 14:30" (oder Rohwert, falls nicht erkannt) */
  display: string;
  /** ISO-Format, z. B. "2024-03-15T14:30" (nur bei vollständiger Jahresangabe) */
  iso?: string;
  error?: string;
}

export interface DateEntry {
  qualifier?: CodedValue;
  value: string;
  format?: CodedValue;
  formatted: FormattedDate;
  segmentIndex: number;
}

export interface ReferenceEntry {
  qualifier?: CodedValue;
  value: string;
  lineNumber?: string;
  dates: DateEntry[];
  segmentIndex: number;
}

export interface Measurement {
  purpose?: CodedValue;
  dimension?: CodedValue;
  unit?: CodedValue;
  value?: number;
  rawValue?: string;
  segmentIndex: number;
}

export interface Quantity {
  qualifier?: CodedValue;
  value?: number;
  rawValue: string;
  unit?: CodedValue;
  segmentIndex: number;
}

export interface FreeText {
  subject?: CodedValue;
  text: string;
  segmentIndex: number;
}

export interface LocationEntry {
  qualifier?: CodedValue;
  id?: string;
  idAgency?: CodedValue;
  name?: string;
  dates: DateEntry[];
  segmentIndex: number;
}

/** GIN – Identifikationsnummern (einzeln oder als Bereich von–bis) */
export interface Identifier {
  qualifier?: CodedValue;
  ranges: { from: string; to?: string }[];
  segmentIndex: number;
}

// ─── Kopf, Parteien, Transport ───────────────────────────────────────────

export interface MessageIdentifier {
  type: string;
  version: string;
  release: string;
  agency: string;
  associationCode?: string;
  codeListVersion?: string;
  /** S016 (Syntax 4) */
  subsetId?: string;
  /** S017 (Syntax 4) */
  implementationGuide?: string;
}

export interface DocumentHeader {
  documentName?: CodedValue;
  documentNameText?: string;
  documentNumber?: string;
  messageFunction?: CodedValue;
  segmentIndex?: number;
}

export interface Communication {
  number: string;
  channel?: CodedValue;
  segmentIndex: number;
}

export interface Contact {
  function?: CodedValue;
  departmentCode?: string;
  name?: string;
  communications: Communication[];
  segmentIndex: number;
}

export interface Party {
  qualifier?: CodedValue;
  id?: string;
  idCodeList?: string;
  idAgency?: CodedValue;
  /** C058 – unformatierte Anschrift */
  nameAndAddress: string[];
  name: string[];
  street: string[];
  city?: string;
  region?: string;
  postalCode?: string;
  country?: CodedValue;
  locations: LocationEntry[];
  references: ReferenceEntry[];
  contacts: Contact[];
  segmentIndex: number;
}

export interface Transport {
  stage?: CodedValue;
  journeyId?: string;
  mode?: CodedValue;
  modeText?: string;
  meansType?: CodedValue;
  carrierId?: string;
  carrierName?: string;
  vehicleId?: string;
  vehicleName?: string;
  vehicleNationality?: CodedValue;
  locations: LocationEntry[];
  references: ReferenceEntry[];
  segmentIndex: number;
}

export interface HandlingEntry {
  code?: string;
  text?: string;
  notes: FreeText[];
  segmentIndex: number;
}

export interface Equipment {
  qualifier?: CodedValue;
  id?: string;
  sizeType?: string;
  measurements: Measurement[];
  seals: string[];
  handling: HandlingEntry[];
  segmentIndex: number;
}

export interface DeliveryTerm {
  function?: string;
  code?: CodedValue;
  text?: string;
  locations: LocationEntry[];
  notes: FreeText[];
  segmentIndex: number;
}

// ─── Packstücke und Positionen ───────────────────────────────────────────

/** PCI – Kennzeichnung mit zugehörigen Nummern (GIN) */
export interface Marking {
  instruction?: CodedValue;
  marks: string[];
  references: ReferenceEntry[];
  dates: DateEntry[];
  identifiers: Identifier[];
  segmentIndex: number;
}

/** PAC – Packstücke einer Ebene */
export interface PackEntry {
  count?: number;
  rawCount?: string;
  level?: CodedValue;
  type?: CodedValue;
  typeDescription?: string;
  measurements: Measurement[];
  quantities: Quantity[];
  dates: DateEntry[];
  references: ReferenceEntry[];
  markings: Marking[];
  handling: HandlingEntry[];
  segmentIndex: number;
}

/** CPS – ein Knoten im Packbaum (z. B. Palette oder Kartonlage) */
export interface PackageNode {
  id: string;
  parentId?: string;
  level?: CodedValue;
  notes: FreeText[];
  packs: PackEntry[];
  /** Indizes in `DesadvMessage.lineItems` */
  lineItemIndices: number[];
  children: PackageNode[];
  segmentIndex: number;
}

export interface AdditionalProductId {
  function?: CodedValue;
  id: string;
  type?: CodedValue;
  segmentIndex: number;
}

export interface ItemDescription {
  format?: CodedValue;
  code?: string;
  text: string;
  segmentIndex: number;
}

/** Eine gefundene Nummer mit Herkunft (zum Lernen: in welchem Segment stand sie?) */
export interface FoundNumber {
  value: string;
  /** Positionsnummer in der Bestellung (bei Bestellnummern aus RFF) */
  line?: string;
  /** Herkunft in Worten, z. B. „PIA · Artikelnummer des Käufers (IN)“ */
  source: string;
  segmentIndex: number;
  /** true = über ein Muster aus numberRules.ts gefunden, false = Standardregel */
  byPattern: boolean;
}

export interface LineItem {
  lineNumber?: string;
  action?: CodedValue;
  itemNumber?: string;
  itemNumberType?: CodedValue;
  parentLineNumber?: string;
  additionalIds: AdditionalProductId[];
  descriptions: ItemDescription[];
  quantities: Quantity[];
  measurements: Measurement[];
  dates: DateEntry[];
  references: ReferenceEntry[];
  identifiers: Identifier[];
  markings: Marking[];
  locations: LocationEntry[];
  notes: FreeText[];
  countryOfOrigin?: CodedValue;
  /** CPS-Nummer, in der die Position steht */
  packageId?: string;

  // Bequemlichkeitsfelder (nach SUMMARY_RULES abgeleitet)
  description?: string;
  despatchQuantity?: Quantity;
  batchNumbers: string[];
  orderReference?: { number: string; line?: string };
  /** Materialnummer nach NUMBER_RULES (sonst Nummer aus LIN) */
  materialNumber?: FoundNumber;
  /** Bestellnummer nach NUMBER_RULES (sonst RFF+ON) */
  orderNumber?: FoundNumber;
  segmentIndex: number;
}

// ─── Zusammenfassung ─────────────────────────────────────────────────────

export interface ControlTotal {
  qualifier?: CodedValue;
  value?: number;
  rawValue: string;
  unit?: CodedValue;
  segmentIndex: number;
}

/** Segmente, die nicht ins Datenmodell übernommen wurden (werden roh angezeigt). */
export interface UnplacedSegment {
  segmentIndex: number;
  tag: string;
  /**
   * unknown-segment:      Segment ist in den Erklär-Daten nicht beschrieben
   * unexpected-position:  bekanntes Segment an einer unerwarteten Stelle
   * not-evaluated:        gültig, wird aber (noch) nicht ausgewertet
   */
  reason: 'unknown-segment' | 'unexpected-position' | 'not-evaluated';
}

export interface Summary {
  documentNumber?: string;
  documentDate?: DateEntry;
  despatchDate?: DateEntry;
  arrivalDate?: DateEntry;
  /** DTM 4 im Kopf oder DTM 171 unter der Bestellnummer (RFF+ON) */
  orderDate?: DateEntry;
  /** Weitere Datumsangaben im Kopf, die keinem Feld oben zugeordnet sind */
  otherDates: DateEntry[];
  orderNumbers: string[];
  /** Indizes in `DesadvMessage.parties` */
  roles: { supplier?: number; buyer?: number; shipTo?: number; carrier?: number };
  lineItemCount: number;
  /** Packstücke je Packmittel; `invalidCount` = mindestens eine PAC-Anzahl war ungültig/fehlte */
  packageCounts: { type?: CodedValue; description?: string; count: number; invalidCount?: boolean }[];
  quantityTotals: { unit?: CodedValue; total: number }[];
  grossWeight?: Measurement;
  netWeight?: Measurement;
}

/** Segmentgruppe, zu der ein Segment gehört (interne Kennung, Anzeige-Text in der UI) */
export type SegmentGroupKind =
  | 'message'
  | 'reference'
  | 'party'
  | 'contact'
  | 'terms'
  | 'transport'
  | 'location'
  | 'equipment'
  | 'handling'
  | 'package'
  | 'pack'
  | 'marking'
  | 'line';

/** Lage eines Segments in der Gruppenstruktur (für die eingerückte Segmentansicht) */
export interface SegmentPlacement {
  /** 0 = Nachrichtenebene, 1 = in einer Gruppe, 2 = in einer Untergruppe … */
  depth: number;
  group: SegmentGroupKind;
}

export interface DesadvMessage {
  index: number;
  reference: string;
  identifier: MessageIdentifier;
  version: VersionInfo;
  /** Erstes (UNH) und letztes Segment der Nachricht */
  segmentRange: { start: number; end: number };
  header: DocumentHeader;
  dates: DateEntry[];
  references: ReferenceEntry[];
  measurements: Measurement[];
  notes: FreeText[];
  locations: LocationEntry[];
  parties: Party[];
  deliveryTerms: DeliveryTerm[];
  transports: Transport[];
  equipment: Equipment[];
  /** Wurzeln des Packbaums */
  packages: PackageNode[];
  lineItems: LineItem[];
  controlTotals: ControlTotal[];
  unplacedSegments: UnplacedSegment[];
  /** Lage jedes Segments der Nachricht (Schlüssel = Segmentindex) */
  segmentPlacement: Record<number, SegmentPlacement>;
  summary: Summary;
}

// ─── Umschlag ────────────────────────────────────────────────────────────

export interface PartnerId {
  id: string;
  qualifier?: CodedValue;
}

export interface InterchangeInfo {
  syntax?: CodedValue;
  syntaxVersion?: string;
  sender?: PartnerId;
  recipient?: PartnerId;
  preparedAt?: FormattedDate;
  controlRef?: string;
  applicationRef?: string;
  testIndicator: boolean;
  segmentIndex: number;
  trailerIndex?: number;
  declaredCount?: number;
  messageCount: number;
  groupCount: number;
}

export interface GroupInfo {
  groupId?: string;
  reference?: string;
  segmentIndex: number;
  trailerIndex?: number;
  messageCount: number;
}

/** Gesamtergebnis für eine eingelesene Datei */
export interface ParseResult {
  delimiters: Delimiters;
  /** true = Datei beginnt mit UNA (eigene Trennzeichen) */
  hasServiceStringAdvice: boolean;
  segments: RawSegment[];
  interchanges: InterchangeInfo[];
  groups: GroupInfo[];
  messages: DesadvMessage[];
  issues: Issue[];
}
