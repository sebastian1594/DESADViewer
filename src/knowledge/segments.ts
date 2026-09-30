import type { ComponentDef, ElementDef, SegmentDef } from './types';

/**
 * SEGMENT-BESCHREIBUNGEN – was bedeutet welches Segment, welche Datenelemente hat es?
 *
 * Die Reihenfolge in `elements` entspricht der Position im Segment
 * (1. Element nach dem Segmentkennzeichen = Index 0).
 * Die Struktur orientiert sich an D.96A; Abweichungen neuerer Verzeichnisse
 * stehen im Feld `note` des jeweiligen Elements.
 *
 * Neues Segment ergänzen: einen Eintrag nach dem Muster unten hinzufügen.
 */

/** Kurzschreibweise für eine Komponente */
const c = (id: string, name: string, codeList?: string): ComponentDef => ({ id, name, codeList });
/** Kurzschreibweise für ein einfaches Datenelement */
const e = (id: string, name: string, codeList?: string, note?: string): ElementDef => ({ id, name, codeList, note });
/** Kurzschreibweise für ein zusammengesetztes Datenelement */
const ce = (id: string, name: string, components: ComponentDef[], note?: string): ElementDef => ({
  id,
  name,
  components,
  note,
});

const repeat = (n: number, factory: (i: number) => ComponentDef): ComponentDef[] =>
  Array.from({ length: n }, (_, i) => factory(i + 1));

export const SEGMENTS: Record<string, SegmentDef> = {
  // ─── Service-Segmente ──────────────────────────────────────────────────
  UNA: {
    tag: 'UNA',
    name: 'Trennzeichen-Vorgabe',
    en: 'Service string advice',
    description:
      'Optionaler Vorspann. Legt fest, welche Zeichen in dieser Datei als Trennzeichen dienen. Ohne UNA gelten die Standardzeichen : + . ? (Leerzeichen) \'.',
    elements: [
      e('UNA1', 'Trennzeichen für Komponenten (Standard :)'),
      e('UNA2', 'Trennzeichen für Datenelemente (Standard +)'),
      e('UNA3', 'Dezimalzeichen (Standard .)'),
      e('UNA4', 'Freigabe-/Escape-Zeichen (Standard ?)'),
      e('UNA5', 'Wiederholungszeichen bzw. reserviert (Standard Leerzeichen)'),
      e('UNA6', 'Segment-Endezeichen (Standard \')'),
    ],
  },
  UNB: {
    tag: 'UNB',
    name: 'Nutzdaten-Kopf',
    en: 'Interchange header',
    description: 'Beginn der Übertragung („Briefumschlag“): wer sendet an wen, wann, mit welcher Referenz.',
    elements: [
      ce('S001', 'Syntaxkennung', [c('0001', 'Zeichensatz', '0001'), c('0002', 'Syntax-Versionsnummer')]),
      ce('S002', 'Absender', [c('0004', 'Absenderkennung'), c('0007', 'Qualifier der Kennung', '0007'), c('0008', 'Rückleitadresse')]),
      ce('S003', 'Empfänger', [c('0010', 'Empfängerkennung'), c('0007', 'Qualifier der Kennung', '0007'), c('0014', 'Leitadresse')]),
      ce('S004', 'Datum/Uhrzeit der Erstellung', [c('0017', 'Datum (JJMMTT, ab Syntax 4: JJJJMMTT)'), c('0019', 'Uhrzeit (HHMM)')]),
      e('0020', 'Datenaustauschreferenz'),
      ce('S005', 'Referenz/Passwort des Empfängers', [c('0022', 'Referenz/Passwort'), c('0025', 'Qualifier')]),
      e('0026', 'Anwendungsreferenz'),
      e('0029', 'Verarbeitungspriorität'),
      e('0031', 'Bestätigungsanforderung'),
      e('0032', 'Kennung der Kommunikationsvereinbarung'),
      e('0035', 'Testkennzeichen', '0035'),
    ],
  },
  UNG: {
    tag: 'UNG',
    name: 'Gruppen-Kopf',
    en: 'Functional group header',
    description: 'Optional: fasst mehrere Nachrichten gleichen Typs zu einer Gruppe zusammen.',
    elements: [
      e('0038', 'Kennung der Nachrichtengruppe', '0065'),
      ce('S006', 'Absender', [c('0040', 'Absenderkennung'), c('0007', 'Qualifier', '0007')]),
      ce('S007', 'Empfänger', [c('0044', 'Empfängerkennung'), c('0007', 'Qualifier', '0007')]),
      ce('S004', 'Datum/Uhrzeit', [c('0017', 'Datum'), c('0019', 'Uhrzeit')]),
      e('0048', 'Gruppenreferenz'),
      e('0051', 'Verantwortliche Organisation', '0051'),
      ce('S008', 'Nachrichtenversion', [c('0052', 'Version'), c('0054', 'Release'), c('0057', 'Anwendungscode')]),
      e('0058', 'Passwort'),
    ],
  },
  UNH: {
    tag: 'UNH',
    name: 'Nachrichten-Kopf',
    en: 'Message header',
    description:
      'Beginn einer Nachricht. Enthält den Nachrichtentyp (z. B. DESADV) und die Version des UN/EDIFACT-Verzeichnisses (z. B. D:96A) – daraus erkennt DESADViewer die Version.',
    elements: [
      e('0062', 'Nachrichtenreferenz (muss im UNT wiederholt werden)'),
      ce('S009', 'Nachrichtenkennung', [
        c('0065', 'Nachrichtentyp', '0065'),
        c('0052', 'Version (z. B. D = Verzeichnis)'),
        c('0054', 'Release (z. B. 96A)'),
        c('0051', 'Verantwortliche Organisation', '0051'),
        c('0057', 'Anwendungscode / Subset (z. B. EAN005)'),
        c('0110', 'Version der Codelisten'),
        c('0113', 'Unterfunktion des Nachrichtentyps'),
      ]),
      e('0068', 'Gemeinsame Zugriffsreferenz'),
      ce('S010', 'Status der Übertragung', [c('0070', 'Laufende Nummer'), c('0073', 'Erste/letzte Übertragung')]),
      ce('S016', 'Nachrichten-Subset (ab Syntax 4)', [c('0115', 'Subset-Kennung'), c('0116', 'Version'), c('0118', 'Release'), c('0051', 'Organisation')]),
      ce('S017', 'Implementierungsrichtlinie (ab Syntax 4)', [c('0121', 'Kennung'), c('0122', 'Version'), c('0124', 'Release'), c('0051', 'Organisation')]),
      ce('S018', 'Szenario (ab Syntax 4)', [c('0127', 'Kennung'), c('0128', 'Version'), c('0130', 'Release'), c('0051', 'Organisation')]),
    ],
  },
  UNT: {
    tag: 'UNT',
    name: 'Nachrichten-Ende',
    en: 'Message trailer',
    description: 'Ende einer Nachricht. Enthält die Anzahl der Segmente (UNH bis UNT, beide mitgezählt) und wiederholt die Nachrichtenreferenz.',
    elements: [e('0074', 'Anzahl der Segmente in der Nachricht'), e('0062', 'Nachrichtenreferenz')],
  },
  UNE: {
    tag: 'UNE',
    name: 'Gruppen-Ende',
    en: 'Functional group trailer',
    description: 'Ende einer Nachrichtengruppe mit Anzahl der Nachrichten.',
    elements: [e('0060', 'Anzahl der Nachrichten in der Gruppe'), e('0048', 'Gruppenreferenz')],
  },
  UNZ: {
    tag: 'UNZ',
    name: 'Nutzdaten-Ende',
    en: 'Interchange trailer',
    description: 'Ende der Übertragung. Enthält die Anzahl der Nachrichten (bzw. Gruppen) und wiederholt die Referenz aus UNB.',
    elements: [e('0036', 'Anzahl der Nachrichten bzw. Gruppen'), e('0020', 'Datenaustauschreferenz')],
  },

  // ─── Nachrichtenkopf ───────────────────────────────────────────────────
  BGM: {
    tag: 'BGM',
    name: 'Beginn der Nachricht',
    en: 'Beginning of message',
    description: 'Art des Dokuments (z. B. 351 = Liefermeldung) und die Dokumentnummer (meist die Lieferscheinnummer).',
    elements: [
      ce('C002', 'Dokumentart', [c('1001', 'Dokumentart (Code)', '1001'), c('1131', 'Codeliste'), c('3055', 'Verantwortliche Stelle', '3055'), c('1000', 'Dokumentname')]),
      ce('C106', 'Dokumentnummer', [c('1004', 'Dokumentnummer'), c('1056', 'Version'), c('1060', 'Revision')], 'In D.96A ein einfaches Element 1004, ab D.01B zusammengesetzt (C106). Position und Bedeutung bleiben gleich.'),
      e('1225', 'Nachrichtenfunktion', '1225'),
      e('4343', 'Antwortart'),
    ],
  },
  DTM: {
    tag: 'DTM',
    name: 'Datum/Uhrzeit',
    en: 'Date/time/period',
    description: 'Ein Datum mit seiner Bedeutung (z. B. 137 = Dokumentdatum) und seinem Format (z. B. 102 = JJJJMMTT).',
    elements: [ce('C507', 'Datum/Uhrzeit/Zeitraum', [c('2005', 'Art des Datums', '2005'), c('2380', 'Wert'), c('2379', 'Format', '2379')])],
  },
  RFF: {
    tag: 'RFF',
    name: 'Referenz',
    en: 'Reference',
    description: 'Verweis auf ein anderes Dokument, z. B. ON = Bestellnummer des Käufers.',
    elements: [
      ce('C506', 'Referenz', [c('1153', 'Art der Referenz', '1153'), c('1154', 'Referenznummer'), c('1156', 'Positionsnummer'), c('4000', 'Version'), c('1060', 'Revision')]),
    ],
  },
  NAD: {
    tag: 'NAD',
    name: 'Name und Anschrift',
    en: 'Name and address',
    description: 'Ein Beteiligter (Firma/Ort) mit seiner Rolle, z. B. SU = Lieferant, BY = Käufer, ST = Lieferanschrift, CA = Spediteur.',
    elements: [
      e('3035', 'Rolle des Beteiligten', '3035'),
      ce('C082', 'Kennung des Beteiligten', [c('3039', 'Kennung (z. B. GLN, Lieferantennummer)'), c('1131', 'Codeliste'), c('3055', 'Verantwortliche Stelle', '3055')]),
      ce('C058', 'Name und Anschrift (unformatiert)', repeat(5, (i) => c('3124', `Zeile ${i}`))),
      ce('C080', 'Name', [...repeat(5, (i) => c('3036', `Name ${i}`)), c('3045', 'Namensformat')]),
      ce('C059', 'Straße', repeat(4, (i) => c('3042', `Straße/Postfach ${i}`))),
      e('3164', 'Ort'),
      ce('C819', 'Region/Bundesland', [c('3229', 'Code'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('3228', 'Name')], 'In älteren Versionen ein einfaches Element 3229.'),
      e('3251', 'Postleitzahl'),
      e('3207', 'Land', '3207'),
    ],
  },
  LOC: {
    tag: 'LOC',
    name: 'Ort',
    en: 'Place/location identification',
    description: 'Ein Ort, z. B. 11 = Entladeort/Abladestelle, 7 = Lieferort.',
    elements: [
      e('3227', 'Art des Ortes', '3227'),
      ce('C517', 'Ortsangabe', [c('3225', 'Ortskennung'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('3224', 'Ortsname')]),
      ce('C519', 'Zugehöriger Ort 1', [c('3223', 'Kennung'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('3222', 'Name')]),
      ce('C553', 'Zugehöriger Ort 2', [c('3233', 'Kennung'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('3232', 'Name')]),
      e('5479', 'Beziehung'),
    ],
  },
  CTA: {
    tag: 'CTA',
    name: 'Ansprechpartner',
    en: 'Contact information',
    description: 'Eine Kontaktperson oder Abteilung des vorher genannten Beteiligten.',
    elements: [e('3139', 'Funktion', '3139'), ce('C056', 'Abteilung/Person', [c('3413', 'Code'), c('3412', 'Name')])],
  },
  COM: {
    tag: 'COM',
    name: 'Kommunikationsverbindung',
    en: 'Communication contact',
    description: 'Telefonnummer, Fax oder E-Mail des vorher genannten Ansprechpartners.',
    elements: [ce('C076', 'Kommunikationsverbindung', [c('3148', 'Nummer/Adresse'), c('3155', 'Art', '3155')])],
  },
  TDT: {
    tag: 'TDT',
    name: 'Transportangaben',
    en: 'Details of transport',
    description: 'Wie wird transportiert? Verkehrszweig (z. B. 3 = Straße), Frachtführer, Kennzeichen des Fahrzeugs.',
    elements: [
      e('8051', 'Transportabschnitt', '8051'),
      e('8028', 'Fahrt-/Transportnummer'),
      ce('C220', 'Verkehrszweig', [c('8067', 'Code', '8067'), c('8066', 'Bezeichnung')]),
      ce('C228', 'Transportmittel', [c('8179', 'Art des Transportmittels'), c('8178', 'Bezeichnung')], 'Ab D.01B als C001 mit den Komponenten 8179:1131:3055:8178.'),
      ce('C040', 'Frachtführer', [c('3127', 'Kennung'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('3128', 'Name')]),
      e('8101', 'Transitrichtung'),
      ce('C401', 'Zusatzinformationen Transport', [c('8457', 'Grund'), c('8459', 'Verantwortung'), c('7130', 'Kundenautorisierung')]),
      ce('C222', 'Transportmittel-Kennung', [c('8213', 'Kennung (z. B. Kfz-Kennzeichen)'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('8212', 'Name'), c('8453', 'Nationalität', '3207')]),
      e('8281', 'Eigentümer des Transportmittels'),
    ],
  },
  TOD: {
    tag: 'TOD',
    name: 'Lieferbedingungen',
    en: 'Terms of delivery or transport',
    description: 'Lieferbedingungen, meist ein Incoterm wie FCA oder DAP.',
    elements: [
      e('4055', 'Funktion der Lieferbedingung'),
      e('4215', 'Frachtzahlung'),
      ce('C100', 'Lieferbedingung', [c('4053', 'Code', '4053'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('4052', 'Text 1'), c('4052', 'Text 2')]),
    ],
  },
  EQD: {
    tag: 'EQD',
    name: 'Transportequipment',
    en: 'Equipment details',
    description: 'Container, Anhänger/Trailer o. Ä., in dem die Ware transportiert wird.',
    elements: [
      e('8053', 'Art des Equipments', '8053'),
      ce('C237', 'Equipment-Kennung', [c('8260', 'Kennung'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('3207', 'Land', '3207')]),
      ce('C224', 'Größe und Typ', [c('8155', 'Code'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('8154', 'Beschreibung')]),
      e('8077', 'Gestellt von'),
      e('8249', 'Status'),
      e('8169', 'Voll/leer'),
    ],
  },
  SEL: {
    tag: 'SEL',
    name: 'Plombe',
    en: 'Seal number',
    description: 'Plombennummer des Containers oder Trailers.',
    elements: [e('9308', 'Plombennummer'), ce('C215', 'Aussteller der Plombe', [c('9303', 'Code'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('9302', 'Name')]), e('4517', 'Zustand')],
  },
  EQA: {
    tag: 'EQA',
    name: 'Zugeordnetes Equipment',
    en: 'Attached equipment',
    description: 'Weiteres Equipment, das mit dem vorigen verbunden ist.',
    elements: [e('8053', 'Art des Equipments', '8053'), ce('C237', 'Equipment-Kennung', [c('8260', 'Kennung'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('3207', 'Land', '3207')])],
  },
  HAN: {
    tag: 'HAN',
    name: 'Handhabungshinweise',
    en: 'Handling instructions',
    description: 'Hinweise zur Handhabung, z. B. „nicht stapeln“.',
    elements: [
      ce('C524', 'Handhabungshinweis', [c('4079', 'Code'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('4078', 'Text')]),
      ce('C218', 'Gefahrgut', [c('7419', 'Code'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055')]),
    ],
  },
  MEA: {
    tag: 'MEA',
    name: 'Maße und Gewichte',
    en: 'Measurements',
    description: 'Ein Messwert, z. B. Bruttogewicht in Kilogramm.',
    elements: [
      e('6311', 'Zweck der Messung', '6311'),
      ce('C502', 'Gemessene Eigenschaft', [c('6313', 'Eigenschaft', '6313'), c('6321', 'Bedeutung'), c('6155', 'Nicht-diskrete Messung'), c('6154', 'Beschreibung')]),
      ce('C174', 'Wert und Einheit', [c('6411', 'Maßeinheit', '6411'), c('6314', 'Wert'), c('6162', 'Minimum'), c('6152', 'Maximum'), c('6432', 'Anzahl signifikanter Stellen')]),
      e('7383', 'Oberfläche/Lage'),
    ],
  },
  MOA: {
    tag: 'MOA',
    name: 'Geldbetrag',
    en: 'Monetary amount',
    description: 'Ein Geldbetrag, z. B. Warenwert.',
    elements: [ce('C516', 'Betrag', [c('5025', 'Art des Betrags'), c('5004', 'Betrag'), c('6345', 'Währung'), c('6343', 'Währungsart'), c('4405', 'Status')])],
  },
  FTX: {
    tag: 'FTX',
    name: 'Freitext',
    en: 'Free text',
    description: 'Beliebiger Text, z. B. Liefer- oder Verpackungshinweise.',
    elements: [
      e('4451', 'Thema', '4451'),
      e('4453', 'Funktion'),
      ce('C107', 'Textbaustein (Code)', [c('4441', 'Code'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055')]),
      ce('C108', 'Text', repeat(5, (i) => c('4440', `Textzeile ${i}`))),
      e('3453', 'Sprache'),
      e('4447', 'Formatierung'),
    ],
  },
  ALI: {
    tag: 'ALI',
    name: 'Zusatzinformationen',
    en: 'Additional information',
    description: 'Zusätzliche Angaben, vor allem das Ursprungsland der Ware.',
    elements: [e('3239', 'Ursprungsland', '3207'), e('9213', 'Zollverfahren'), ...repeat(5, (i) => c('4183', `Sonderbedingung ${i}`))],
  },
  CNT: {
    tag: 'CNT',
    name: 'Kontrollsumme',
    en: 'Control total',
    description: 'Prüfsumme über die Nachricht, z. B. 2 = Anzahl der Positionen.',
    elements: [ce('C270', 'Kontrollsumme', [c('6069', 'Art', '6069'), c('6066', 'Wert'), c('6411', 'Maßeinheit', '6411')])],
  },
  PCD: {
    tag: 'PCD',
    name: 'Prozentangabe',
    en: 'Percentage details',
    description: 'Eine Prozentangabe.',
    elements: [ce('C501', 'Prozent', [c('5245', 'Art'), c('5482', 'Wert'), c('5249', 'Basis'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055')])],
  },

  // ─── Packstücke ────────────────────────────────────────────────────────
  CPS: {
    tag: 'CPS',
    name: 'Packstück-Hierarchie',
    en: 'Consignment packing sequence',
    description:
      'Baut den Packbaum auf: jede Ebene (z. B. Sendung → Palette → Karton) bekommt eine Nummer und verweist auf ihre übergeordnete Ebene.',
    elements: [e('7164', 'Nummer dieser Ebene'), e('7166', 'Nummer der übergeordneten Ebene'), e('7075', 'Verpackungsebene', '7075')],
  },
  PAC: {
    tag: 'PAC',
    name: 'Packstücke',
    en: 'Package',
    description: 'Anzahl und Art der Packstücke auf dieser Ebene, z. B. 4 Kartons.',
    elements: [
      e('7224', 'Anzahl Packstücke'),
      ce('C531', 'Verpackungsdetails', [c('7075', 'Verpackungsebene', '7075'), c('7233', 'Verpackungsbezogene Information'), c('7073', 'Verpackungsbedingungen')]),
      ce('C202', 'Packmittelart', [c('7065', 'Packmittel (Code)', '7065'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('7064', 'Beschreibung')]),
      ce('C402', 'Packmittel-Kennung', [c('7077', 'Beschreibungsart', '7077'), c('7064', 'Beschreibung'), c('7143', 'Nummernart'), c('7064', 'Beschreibung'), c('7143', 'Nummernart')]),
      ce('C532', 'Mehrwegverpackung', [c('8395', 'Zahlung'), c('8393', 'Mehrweg-Kennzeichen')]),
    ],
  },
  PCI: {
    tag: 'PCI',
    name: 'Packstück-Kennzeichnung',
    en: 'Package identification',
    description: 'Wie sind die Packstücke beschriftet/etikettiert? Darauf folgen meist GIN-Segmente mit den Nummern.',
    elements: [
      e('4233', 'Markierungsanweisung', '4233'),
      ce('C210', 'Markierungen/Beschriftungen', repeat(10, (i) => c('7102', `Markierung ${i}`))),
      e('8275', 'Status Container/Packstück'),
      ce('C827', 'Art der Markierung', [c('7511', 'Code'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055')]),
    ],
  },
  GIN: {
    tag: 'GIN',
    name: 'Identifikationsnummern',
    en: 'Goods identity number',
    description: 'Nummern zur Identifikation, z. B. SSCC (BJ), Chargen (BX) oder Seriennummern (BN). Auch Nummernbereiche „von–bis“ sind möglich.',
    elements: [
      e('7405', 'Art der Nummer', '7405'),
      ...repeat(5, (i) => ce('C208', `Nummer/Bereich ${i}`, [c('7402', 'Nummer (von)'), c('7402', 'Nummer (bis)')])),
    ],
  },
  GIR: {
    tag: 'GIR',
    name: 'Zusammengehörige Nummern',
    en: 'Related identification numbers',
    description: 'Mehrere Nummern, die zusammengehören (z. B. Seriennummer + Charge).',
    elements: [
      e('7297', 'Art der Zusammengehörigkeit'),
      ...repeat(5, (i) => ce('C206', `Nummer ${i}`, [c('7402', 'Nummer'), c('7405', 'Art', '7405'), c('4405', 'Status')])),
    ],
  },
  DLM: {
    tag: 'DLM',
    name: 'Lieferbeschränkung',
    en: 'Delivery limitations',
    description: 'Einschränkungen zur Lieferung.',
    elements: [e('4455', 'Art der Rückstandsbehandlung'), ce('C522', 'Anweisung', [c('4403', 'Art'), c('4401', 'Code')])],
  },

  // ─── Positionen ────────────────────────────────────────────────────────
  LIN: {
    tag: 'LIN',
    name: 'Position',
    en: 'Line item',
    description: 'Beginn einer Artikelposition mit Positionsnummer und Hauptartikelnummer.',
    elements: [
      e('1082', 'Positionsnummer'),
      e('1229', 'Änderungskennzeichen', '1229'),
      ce('C212', 'Artikelnummer', [c('7140', 'Artikelnummer'), c('7143', 'Art der Nummer', '7143'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055')]),
      ce('C829', 'Unterposition', [c('5495', 'Unterpositions-Kennzeichen'), c('1082', 'Übergeordnete Positionsnummer')]),
      e('1222', 'Konfigurationsebene'),
      e('7083', 'Konfigurationscode'),
    ],
  },
  PIA: {
    tag: 'PIA',
    name: 'Zusätzliche Artikelnummern',
    en: 'Additional product id',
    description: 'Weitere Nummern zum Artikel, z. B. Artikelnummer des Lieferanten (SA) oder Charge (NB).',
    elements: [
      e('4347', 'Funktion', '4347'),
      ...repeat(5, (i) =>
        ce('C212', `Artikelnummer ${i}`, [c('7140', 'Artikelnummer'), c('7143', 'Art der Nummer', '7143'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055')]),
      ),
    ],
  },
  IMD: {
    tag: 'IMD',
    name: 'Artikelbeschreibung',
    en: 'Item description',
    description: 'Bezeichnung des Artikels in Textform.',
    elements: [
      e('7077', 'Art der Beschreibung', '7077'),
      ce('C272', 'Merkmal', [c('7081', 'Merkmal (Code)'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055')]),
      ce('C273', 'Beschreibung', [c('7009', 'Code'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('7008', 'Text 1'), c('7008', 'Text 2'), c('3453', 'Sprache')]),
      e('7383', 'Oberfläche/Lage'),
    ],
  },
  QTY: {
    tag: 'QTY',
    name: 'Menge',
    en: 'Quantity',
    description: 'Eine Menge mit ihrer Bedeutung (z. B. 12 = Liefermenge) und Einheit (z. B. PCE = Stück).',
    elements: [ce('C186', 'Mengenangabe', [c('6063', 'Art der Menge', '6063'), c('6060', 'Menge'), c('6411', 'Maßeinheit', '6411')])],
  },
  QVR: {
    tag: 'QVR',
    name: 'Mengenabweichung',
    en: 'Quantity variances',
    description: 'Abweichung zwischen bestellter und gelieferter Menge mit Grund.',
    elements: [
      ce('C279', 'Abweichung', [c('6064', 'Menge'), c('6063', 'Art der Menge', '6063')]),
      e('4221', 'Art der Abweichung'),
      ce('C960', 'Grund', [c('4295', 'Grund (Code)'), c('1131', 'Codeliste'), c('3055', 'Stelle', '3055'), c('4294', 'Text')]),
    ],
  },
};
