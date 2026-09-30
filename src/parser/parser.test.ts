import { describe, expect, it } from 'vitest';
import sample1 from '../../samples/01-d96a-einfach.edi?raw';
import sample2 from '../../samples/02-d07a-automotive-mehrstufig.edi?raw';
import sample3 from '../../samples/03-d10a-allgemein.edi?raw';
import sample4 from '../../samples/04-d01b-eigenes-una-escape.edi?raw';
import sample5 from '../../samples/05-fehlerhaft.edi?raw';
import sample6 from '../../samples/06-zwei-nachrichten.edi?raw';
import { hasErrors, parseEdifact } from './index';
import type { PackageNode, ParseResult } from './model';

const codes = (r: ParseResult, severity?: string) =>
  r.issues.filter((i) => !severity || i.severity === severity).map((i) => i.code);

/** Warnungen und Fehler (Hinweise vom Typ „info“ ausgenommen) */
const problems = (r: ParseResult) => r.issues.filter((i) => i.severity !== 'info');

describe('Beispiel 01 – D.96A einfach (EANCOM)', () => {
  const r = parseEdifact(sample1);
  const m = r.messages[0];

  it('ist fehlerfrei', () => {
    expect(problems(r)).toEqual([]);
  });

  it('erkennt Version und Subset aus dem UNH', () => {
    expect(m.identifier).toMatchObject({ type: 'DESADV', version: 'D', release: '96A', agency: 'UN', associationCode: 'EAN005' });
    expect(m.version.directory).toBe('D.96A');
    expect(m.version.subset).toMatchObject({ code: 'EAN005', known: true });
  });

  it('liest den Umschlag', () => {
    expect(r.interchanges[0]).toMatchObject({
      controlRef: 'DE0001',
      sender: { id: '9521234000006' },
      recipient: { id: '9527654000008' },
      messageCount: 1,
      declaredCount: 1,
    });
    expect(r.interchanges[0].preparedAt?.display).toBe('15.03.24 14:30');
  });

  it('liest Kopfdaten, Termine und Referenzen', () => {
    expect(m.header.documentNumber).toBe('LS-2024-0315');
    expect(m.header.documentName).toMatchObject({ code: '351', known: true });
    expect(m.header.messageFunction?.label).toBe('Original');
    expect(m.summary.documentDate?.formatted.display).toBe('15.03.2024');
    expect(m.summary.despatchDate?.formatted.display).toBe('15.03.2024 14:00');
    expect(m.summary.arrivalDate?.formatted.display).toBe('18.03.2024');
    expect(m.references[0]).toMatchObject({ value: '4500012345', qualifier: { code: 'ON' } });
    expect(m.references[0].dates[0].formatted.display).toBe('01.03.2024');
    expect(m.summary.orderNumbers).toEqual(['4500012345']);
  });

  it('liest Parteien inkl. Ansprechpartner', () => {
    const { supplier, buyer, shipTo } = m.summary.roles;
    expect(m.parties[supplier!]).toMatchObject({ name: ['Fantasie Werkzeuge AG'], city: 'Beispielhausen', postalCode: '54321' });
    expect(m.parties[supplier!].country?.label).toBe('Deutschland');
    expect(m.parties[supplier!].contacts[0]).toMatchObject({ name: 'Erika Beispiel' });
    expect(m.parties[supplier!].contacts[0].communications[0]).toMatchObject({ number: '0049 1234 56789', channel: { label: 'Telefon' } });
    expect(m.parties[buyer!].name).toEqual(['Musterhandel GmbH']);
    expect(m.parties[shipTo!].qualifier?.code).toBe('DP');
  });

  it('liest Transport und Gewicht', () => {
    expect(m.transports[0]).toMatchObject({ carrierId: '9525555000004', carrierName: 'Schnell Logistik KG', mode: { label: 'Straße (Lkw)' } });
    expect(m.summary.grossWeight).toMatchObject({ value: 412.5, unit: { code: 'KGM' } });
  });

  it('baut den Packbaum und ordnet Positionen zu', () => {
    expect(m.packages).toHaveLength(1);
    const pallet = m.packages[0].children[0];
    expect(pallet.id).toBe('2');
    expect(pallet.packs[0].type?.label).toBe('Palette');
    expect(pallet.packs[0].markings[0].identifiers[0].ranges[0].from).toBe('395212340000000014');
    expect(pallet.lineItemIndices).toEqual([0, 1]);
  });

  it('liest die Positionen', () => {
    expect(m.lineItems).toHaveLength(2);
    expect(m.lineItems[0]).toMatchObject({
      lineNumber: '1',
      itemNumber: '9521234111115',
      itemNumberType: { code: 'SRV' },
      description: 'Akkuschrauber 18 V',
      despatchQuantity: { value: 24, unit: { code: 'PCE' } },
      orderReference: { number: '4500012345', line: '10' },
      packageId: '2',
    });
    expect(m.lineItems[0].additionalIds[0]).toMatchObject({ id: 'AKKU-18V', type: { code: 'SA' } });
    expect(m.lineItems[1].batchNumbers).toEqual(['CH2403-A']);
    expect(m.summary.quantityTotals).toEqual([{ unit: expect.objectContaining({ code: 'PCE' }), total: 72 }]);
  });

  it('merkt sich zu jedem Objekt das Segment', () => {
    expect(r.segments[m.header.segmentIndex!].tag).toBe('BGM');
    expect(r.segments[m.lineItems[1].segmentIndex].raw).toBe("LIN+2++9521234222224:SRV'");
  });
});

describe('Beispiel 02 – D.07A Automotive mit mehrstufiger Packstruktur', () => {
  const r = parseEdifact(sample2);
  const m = r.messages[0];

  it('ist ohne Warnungen und Fehler', () => {
    expect(problems(r)).toEqual([]);
  });

  it('erkennt D.07A und das Automotive-Subset', () => {
    expect(m.version.directory).toBe('D.07A');
    expect(m.version.subset).toMatchObject({ code: 'GAVF24', known: true });
  });

  it('baut Sendung → Palette → Karton → Artikel', () => {
    const tree = (n: PackageNode): unknown => ({ id: n.id, lines: n.lineItemIndices, children: n.children.map(tree) });
    expect(m.packages.map(tree)).toEqual([
      {
        id: '1',
        lines: [],
        children: [
          { id: '2', lines: [], children: [{ id: '3', lines: [0], children: [] }, { id: '4', lines: [1], children: [] }] },
          { id: '5', lines: [], children: [{ id: '6', lines: [2], children: [] }] },
        ],
      },
    ]);
  });

  it('liest Packstück-Details (Anzahl, Menge je Packstück, Etikettennummern)', () => {
    const karton = m.packages[0].children[0].children[0].packs[0];
    expect(karton).toMatchObject({ count: 4, type: { label: 'Karton' }, level: { code: '1' } });
    expect(karton.quantities[0]).toMatchObject({ value: 50, qualifier: { code: '52' } });
    expect(karton.markings[0].marks).toEqual(['VDA 4902']);
    expect(karton.markings[0].identifiers[0].ranges).toEqual([{ from: '100001', to: '100004' }]);
    expect(m.summary.packageCounts).toEqual([
      expect.objectContaining({ type: expect.objectContaining({ code: 'PX' }), count: 2 }),
      expect.objectContaining({ type: expect.objectContaining({ code: 'CT' }), count: 12 }),
    ]);
  });

  it('liest Positionen mit Charge, Ursprungsland und Änderungsstand', () => {
    const [a, b, c] = m.lineItems;
    expect(a).toMatchObject({ itemNumber: 'A-4711-01', batchNumbers: ['CH240401'], countryOfOrigin: { label: 'Deutschland' } });
    expect(a.additionalIds.map((x) => [x.id, x.type?.code])).toEqual([
      ['Z100-AB-L', 'SA'],
      ['C', 'EC'],
    ]);
    expect(b.despatchQuantity?.value).toBe(80);
    expect(c).toMatchObject({ packageId: '6', countryOfOrigin: { label: 'Tschechien' } });
  });

  it('liest Parteien, Abladestelle, Transport und Equipment', () => {
    expect(m.parties.map((p) => p.qualifier?.code)).toEqual(['CN', 'CZ', 'SF', 'CA']);
    expect(m.parties[0].locations[0]).toMatchObject({ id: 'TOR5', qualifier: { label: 'Entladeort / Abladestelle' } });
    expect(m.summary.roles).toEqual({ supplier: 1, buyer: undefined, shipTo: 0, carrier: 3 });
    expect(m.transports[0]).toMatchObject({ vehicleId: 'XX-AB123', vehicleNationality: { code: 'DE' } });
    expect(m.equipment[0]).toMatchObject({ id: 'XX-CD456', qualifier: { label: 'Anhänger / Trailer' } });
    expect(m.summary.netWeight?.value).toBe(1080);
    expect(m.summary.grossWeight?.value).toBe(1265);
  });
});

describe('Beispiel 03 – D.10A allgemein', () => {
  const r = parseEdifact(sample3);
  const m = r.messages[0];

  it('ist ohne Warnungen und Fehler', () => {
    expect(problems(r)).toEqual([]);
  });

  it('erkennt D.10A ohne Subset und Syntax 4 im UNB', () => {
    expect(m.version).toMatchObject({ directory: 'D.10A', subset: undefined });
    expect(r.interchanges[0].syntaxVersion).toBe('4');
    expect(r.interchanges[0].preparedAt?.display).toBe('05.11.2024 09:30');
  });

  it('wandelt verschiedene Datumsformate um', () => {
    const d = Object.fromEntries(m.dates.map((x) => [x.qualifier?.code, x.formatted.display]));
    expect(d).toEqual({
      '137': '05.11.2024 09:30:00',
      '11': '05.11.2024 07:00 (UTC+01:00)',
      '2': '06.11.2024 – 07.11.2024',
      '10': 'KW 45/2024',
    });
    expect(m.summary.arrivalDate?.qualifier?.code).toBe('2');
  });

  it('liest Freitext, Lieferbedingung und Ansprechpartner', () => {
    expect(m.notes[0]).toMatchObject({ subject: { label: 'Lieferhinweis' }, text: 'Anlieferung nur an Rampe 3. Bitte 30 Minuten vorher anrufen.' });
    expect(m.deliveryTerms[0]).toMatchObject({ code: { label: 'Frei Frachtführer' }, text: 'Phantasiestadt' });
    expect(m.parties[2].contacts[0].communications[0]).toMatchObject({ number: 'wareneingang@beispiel.invalid', channel: { code: 'EM' } });
  });

  it('liest Dezimalmengen und mehrere Mengenarten', () => {
    const [blech, schraube] = m.lineItems;
    expect(blech.despatchQuantity).toMatchObject({ value: 1250.5, unit: { label: 'Kilogramm' } });
    expect(blech.quantities.map((q) => q.qualifier?.code)).toEqual(['12', '21']);
    expect(blech.dates[0].formatted.display).toBe('28.10.2024');
    expect(blech.batchNumbers).toEqual(['SCH-77812']);
    expect(schraube.description).toBe('Sechskantschraube M8x40, verzinkt');
    expect(m.summary.quantityTotals.map((t) => [t.unit?.code, t.total])).toEqual([
      ['KGM', 1250.5],
      ['PCE', 5000],
    ]);
  });
});

describe('Beispiel 04 – D.01B mit eigener UNA und Escape-Zeichen', () => {
  const r = parseEdifact(sample4);
  const m = r.messages[0];

  it('ist ohne Warnungen und Fehler', () => {
    expect(problems(r)).toEqual([]);
  });

  it('übernimmt die Trennzeichen aus der UNA', () => {
    expect(r.hasServiceStringAdvice).toBe(true);
    expect(r.delimiters).toEqual({ component: '>', element: '*', decimal: ',', release: '#', repetition: ' ', segment: '~' });
    expect(m.version.directory).toBe('D.01B');
    expect(m.version.subset?.code).toBe('EAN007');
  });

  it('löst Escape-Zeichen in Namen und Texten auf', () => {
    expect(m.parties[0].name).toEqual(['Stern*Partner Handels GmbH']);
    expect(m.parties[0].street).toEqual(['Ölweg 1']);
    const item = m.lineItems[0];
    expect(item.additionalIds[0].id).toBe('ART~77');
    expect(item.description).toBe('Profil 20*30 mm, Länge >2 m');
    expect(item.notes[0].text).toBe('Maße 20*30 cm (B*H) Hinweis: Kante empfindlich, Rabattcode 5#A');
  });

  it('liest Zahlen mit Dezimalkomma', () => {
    expect(m.summary.grossWeight?.value).toBe(1234.75);
    expect(m.lineItems[0].despatchQuantity?.value).toBe(12.5);
  });
});

describe('Beispiel 05 – fehlerhafte Datei', () => {
  const r = parseEdifact(sample5);

  it('bricht nicht ab, sondern liefert beide Nachrichten', () => {
    expect(r.messages).toHaveLength(2);
    expect(hasErrors(r)).toBe(true);
  });

  it('prüft Zählungen und Referenzen im Umschlag', () => {
    expect(codes(r)).toEqual(
      expect.arrayContaining(['UNT_COUNT_MISMATCH', 'UNT_REF_MISMATCH', 'UNT_MISSING', 'UNZ_COUNT_MISMATCH', 'UNZ_REF_MISMATCH', 'MISSING_TERMINATOR', 'UNB_INVALID_DATE']),
    );
  });

  it('meldet ungültige Datumswerte und Zahlen', () => {
    const invalidDates = r.issues.filter((i) => i.code === 'INVALID_DATE');
    expect(invalidDates).toHaveLength(2);
    expect(codes(r)).toContain('DATE_FORMAT_UNKNOWN');
    expect(r.issues.filter((i) => i.code === 'INVALID_NUMBER')).toHaveLength(2);
  });

  it('kennzeichnet unbekannte Segmente und Codes, statt sie zu verwerfen', () => {
    const m = r.messages[0];
    expect(m.unplacedSegments).toContainEqual({ segmentIndex: 8, tag: 'XYZ', reason: 'unknown-segment' });
    expect(r.segments[8].raw).toBe("XYZ+unbekannt+segment'");
    expect(m.parties[0].qualifier).toEqual({ code: 'QQ', list: '3035', known: false });
    const unknownCodes = r.issues.filter((i) => i.code === 'UNKNOWN_CODE').map((i) => i.message);
    expect(unknownCodes.some((msg) => msg.includes('„QQ“'))).toBe(true);
  });

  it('prüft Packbaum und Kontrollsumme', () => {
    const m = r.messages[0];
    expect(codes(r)).toEqual(expect.arrayContaining(['CPS_PARENT_MISSING', 'CNT_LINE_COUNT_MISMATCH']));
    expect(m.packages.map((p) => p.id)).toEqual(['1', '2']);
    expect(m.lineItems[0].despatchQuantity?.value).toBeUndefined();
    expect(m.summary.packageCounts).toEqual([expect.objectContaining({ count: 0, invalidCount: true })]);
  });

  it('ordnet Hinweise der richtigen Nachricht zu', () => {
    const missing = r.issues.find((i) => i.code === 'UNT_MISSING');
    expect(missing?.messageIndex).toBe(1);
    expect(r.messages[1].lineItems[0].despatchQuantity?.value).toBe(3);
  });
});

describe('Beispiel 06 – zwei Nachrichten in unterschiedlichen Versionen', () => {
  const r = parseEdifact(sample6);

  it('liest beide Nachrichten fehlerfrei', () => {
    expect(problems(r)).toEqual([]);
    expect(r.messages.map((m) => m.reference)).toEqual(['M1', 'M2']);
    expect(r.interchanges[0].messageCount).toBe(2);
  });

  it('erkennt die Version je Nachricht', () => {
    expect(r.messages.map((m) => m.version.directory)).toEqual(['D.96A', 'D.01B']);
  });

  it('trennt die Inhalte der Nachrichten', () => {
    expect(r.messages[0].lineItems).toHaveLength(1);
    expect(r.messages[1].lineItems).toHaveLength(2);
    expect(r.messages[1].segmentRange).toEqual({ start: 11, end: 22 });
  });
});

/** Erfundene Mini-Nachricht: Artikelnummer des Käufers (IN) steht in PIA, in LIN steht die des Lieferanten */
const KAEUFER_NUMMERN_TESTDATEN = [
  'UNH+1+DESADV:D:07A:UN',
  'BGM+351+LS-1+9',
  'RFF+ON:PO-77001',
  'NAD+SU+L1::92++Lieferant',
  'CPS+1',
  'LIN+1++LF-5520:SA',
  'PIA+1+KD-100200-01:IN',
  'QTY+12:200:PCE',
  'RFF+ON:PO-77001:10',
  'LIN+2++LF-7781:SA',
  'PIA+1+KD-100200-02:IN+X-99:EC',
  'QTY+12:200:PCE',
  'RFF+ON:PO-77002:20',
  'UNT+14+1',
].join("'\n") + "'";

describe('Material- und Bestellnummer nach EDIFACT-Qualifiern', () => {
  const r = parseEdifact(KAEUFER_NUMMERN_TESTDATEN);
  const m = r.messages[0];

  it('ist ohne Warnungen und Fehler', () => {
    expect(problems(r)).toEqual([]);
  });

  it('nimmt die Artikelnummer des Käufers (IN) aus PIA, obwohl in LIN die des Lieferanten steht', () => {
    expect(m.lineItems[0].itemNumber).toBe('LF-5520');
    expect(m.lineItems[0].materialNumber).toEqual({
      value: 'KD-100200-01',
      source: 'PIA · Artikelnummer des Käufers (IN)',
      segmentIndex: 6,
    });
    expect(m.lineItems[1].materialNumber?.value).toBe('KD-100200-02');
  });

  it('nimmt die Bestellnummer (RFF+ON) der Position samt Bestellposition – egal welches Format', () => {
    expect(m.lineItems[0].orderNumber).toMatchObject({ value: 'PO-77001', line: '10' });
    expect(m.lineItems[1].orderNumber).toMatchObject({ value: 'PO-77002', line: '20' });
    expect(m.summary.orderNumbers).toEqual(['PO-77001', 'PO-77002']);
  });

  it('nimmt die Hauptnummer aus LIN, wenn es keine Käufer-Artikelnummer gibt', () => {
    const m1 = parseEdifact(sample1).messages[0];
    expect(m1.lineItems[0].materialNumber).toMatchObject({ value: '9521234111115', source: 'LIN · GTIN (GS1-Artikelnummer) (SRV)' });
    expect(m1.lineItems[0].orderNumber).toMatchObject({ value: '4500012345', line: '10' });
  });

  it('nimmt eine Teilenummer des Käufers (BP), wenn es keine IN gibt', () => {
    const r4 = parseEdifact("UNH+1+DESADV:D:96A:UN'BGM+351+X+9'LIN+1++LF-1:SA'PIA+1+TN-4711:BP'QTY+12:1:PCE'UNT+6+1'");
    expect(r4.messages[0].lineItems[0].materialNumber?.value).toBe('TN-4711');
  });

  it('findet die Bestellnummer auch im RFF beim Käufer (NAD BY)', () => {
    const r3 = parseEdifact(
      "UNH+1+DESADV:D:07A:UN'BGM+351+X+9'NAD+BY+K1::92++Kunde AG'RFF+ON:4500099901'NAD+SU+L1::92++Lieferant'CPS+1'LIN+1++KD-1:IN'QTY+12:5:PCE'UNT+9+1'",
    );
    const m3 = r3.messages[0];
    expect(problems(r3)).toEqual([]);
    expect(m3.summary.orderNumbers).toEqual(['4500099901']);
    expect(m3.lineItems[0].orderNumber).toMatchObject({
      value: '4500099901',
      source: 'RFF bei Käufer (NAD BY) · Bestellnummer (Käufer) (ON)',
    });
  });

  it('nimmt andere Referenzarten nicht als Bestellnummer', () => {
    const r5 = parseEdifact("UNH+1+DESADV:D:96A:UN'BGM+351+X+9'RFF+AAN:LAB-1'LIN+1++KD-1:IN'QTY+12:1:PCE'UNT+6+1'");
    expect(r5.messages[0].lineItems[0].orderNumber).toBeUndefined();
    expect(r5.messages[0].summary.orderNumbers).toEqual([]);
  });

  it('ermittelt das Bestelldatum aus DTM 4 oder aus DTM 171 unter der Bestellnummer', () => {
    const viaRef = parseEdifact(
      "UNH+1+DESADV:D:07A:UN'BGM+351+X+9'DTM+137:20250310:102'NAD+BY+K1::92++Kunde'RFF+ON:4500099901'DTM+171:20250201:102'LIN+1++A:IN'QTY+12:1:PCE'UNT+9+1'",
    ).messages[0].summary;
    expect(viaRef.orderDate?.formatted.display).toBe('01.02.2025');
    expect(viaRef.documentDate?.formatted.display).toBe('10.03.2025');
    expect(viaRef.otherDates).toEqual([]);

    // DTM 124 (Lieferscheindatum) gilt als Datum des Dokuments, wenn DTM 137 fehlt
    const vda = parseEdifact("UNH+1+DESADV:D:07A:UN'BGM+351+X+9'DTM+124:20250305:102'UNT+4+1'").messages[0].summary;
    expect(vda.documentDate).toMatchObject({ qualifier: { label: 'Lieferscheindatum' }, formatted: { display: '05.03.2025' } });

    const viaHeader = parseEdifact("UNH+1+DESADV:D:07A:UN'BGM+351+X+9'DTM+4:20250115:102'DTM+999:20250101:102'UNT+5+1'").messages[0].summary;
    expect(viaHeader.orderDate?.formatted.display).toBe('15.01.2025');
    // unbekannte Datumsart geht nicht verloren
    expect(viaHeader.otherDates.map((d) => d.qualifier?.code)).toEqual(['999']);
  });

  it('sucht die Bestellnummer auch im Nachrichtenkopf', () => {
    const r2 = parseEdifact("UNH+1+DESADV:D:96A:UN'BGM+351+X+9'RFF+ON:4500765432'LIN+1++KD-123:IN'QTY+12:1:PCE'UNT+6+1'");
    expect(r2.messages[0].lineItems[0].orderNumber).toMatchObject({ value: '4500765432', source: expect.stringContaining('Nachrichtenkopf') });
    expect(r2.messages[0].lineItems[0].materialNumber).toMatchObject({ value: 'KD-123' });
  });
});
describe('Versionsunabhängigkeit', () => {
  const body = (version: string) =>
    `UNH+1+DESADV:${version}'BGM+351+LS1+9'NAD+SU+1::92++Lieferant'CPS+1'PAC+1++PX'LIN+1++A:IN'QTY+12:5:PCE'UNT+8+1'`;

  it.each(['D:93A:UN', 'D:96A:UN', 'D:97A:UN', 'D:01B:UN', 'D:07A:UN', 'D:10A:UN', 'D:20B:UN', 'D:99Z:UN:FANTASIE1'])('verarbeitet %s gleich', (v) => {
    const r = parseEdifact(body(v));
    expect(problems(r)).toEqual([]);
    const m = r.messages[0];
    expect(m.version.directory).toBe(v.split(':').slice(0, 2).join('.'));
    expect(m.lineItems[0].despatchQuantity?.value).toBe(5);
    expect(m.parties[0].name).toEqual(['Lieferant']);
  });

  it('zeigt unbekannte Subsets an, ohne sie zu deuten', () => {
    const r = parseEdifact(body('D:99Z:UN:FANTASIE1'));
    expect(r.messages[0].version.subset).toEqual({ code: 'FANTASIE1', known: false });
  });
});

describe('Umschlag – Sonderfälle', () => {
  it('meldet leere Eingaben verständlich', () => {
    const r = parseEdifact('   \n ');
    expect(codes(r)).toEqual(['EMPTY_INPUT']);
  });

  it('erkennt Texte, die kein EDIFACT sind', () => {
    const r = parseEdifact('<?xml version="1.0"?><Lieferschein/>');
    expect(codes(r, 'error')).toContain('NOT_EDIFACT');
  });

  it('akzeptiert Nachrichten ohne UNB/UNZ mit Hinweis', () => {
    const r = parseEdifact("UNH+1+DESADV:D:96A:UN'BGM+351+X+9'UNT+3+1'");
    expect(r.messages).toHaveLength(1);
    expect(codes(r)).toContain('UNB_MISSING');
    expect(problems(r).filter((i) => i.code !== 'NO_LINE_ITEMS')).toEqual([]);
  });

  it('zählt bei Gruppen (UNG/UNE) im UNZ die Gruppen', () => {
    const r = parseEdifact(
      "UNB+UNOC:3+A:ZZZ+B:ZZZ+240101:1200+R1'UNG+DESADV+A:ZZZ+B:ZZZ+240101:1200+G1+UN+D:96A'" +
        "UNH+1+DESADV:D:96A:UN'BGM+351+X+9'UNT+3+1'UNH+2+DESADV:D:96A:UN'BGM+351+Y+9'UNT+3+2'UNE+2+G1'UNZ+1+R1'",
    );
    expect(problems(r)).toEqual([]);
    expect(r.groups[0]).toMatchObject({ reference: 'G1', messageCount: 2 });
  });

  it('meldet falsche Gruppenzählung', () => {
    const r = parseEdifact("UNB+UNOC:3+A+B+240101:1200+R1'UNG+DESADV+A+B+240101:1200+G1+UN+D:96A'UNH+1+DESADV:D:96A:UN'BGM+351+X+9'UNT+3+1'UNE+3+G9'UNZ+1+R1'");
    expect(codes(r)).toEqual(expect.arrayContaining(['UNE_COUNT_MISMATCH', 'UNE_REF_MISMATCH']));
  });

  it('warnt bei anderen Nachrichtentypen, verarbeitet sie aber', () => {
    const r = parseEdifact("UNH+1+ORDERS:D:96A:UN'BGM+220+B1+9'UNT+3+1'");
    expect(codes(r)).toContain('NOT_DESADV');
    expect(r.messages[0].header.documentNumber).toBe('B1');
  });

  it('meldet doppelte Nachrichtenreferenzen', () => {
    const r = parseEdifact("UNH+1+DESADV:D:96A:UN'BGM+351+X+9'UNT+3+1'UNH+1+DESADV:D:96A:UN'BGM+351+Y+9'UNT+3+1'");
    expect(codes(r)).toContain('UNH_DUPLICATE_REF');
  });

  it('meldet Segmente an unerwarteter Stelle', () => {
    const r = parseEdifact("UNH+1+DESADV:D:96A:UN'BGM+351+X+9'COM+123:TE'UNT+4+1'");
    expect(r.messages[0].unplacedSegments).toEqual([{ segmentIndex: 2, tag: 'COM', reason: 'unexpected-position' }]);
  });

  it('erkennt Kreisverweise im Packbaum', () => {
    const r = parseEdifact("UNH+1+DESADV:D:96A:UN'BGM+351+X+9'CPS+1+2'CPS+2+1'UNT+5+1'");
    expect(codes(r)).toContain('CPS_CYCLE');
    expect(r.messages[0].packages.length).toBeGreaterThan(0);
  });

  it('behandelt Packmittel aus fremden Codelisten nicht als UN-Code', () => {
    const r = parseEdifact("UNH+1+DESADV:D:96A:UN'BGM+351+X+9'CPS+1'PAC+2++CT::92:Kunden-KLT'UNT+5+1'");
    const pack = r.messages[0].packages[0].packs[0];
    expect(pack.type).toMatchObject({ code: 'CT', known: false });
    expect(pack.type?.note).toContain('Stelle 92');
    expect(pack.typeDescription).toBe('Kunden-KLT');
  });
});
