import { describe, expect, it } from 'vitest';
import sample1 from '../../samples/01-d96a-einfach.edi?raw';
import { parseEdifact } from '../parser';
import { collectDateRows } from './dateRows';

const rowsOf = (edi: string) => collectDateRows(parseEdifact(edi).messages[0]).map((r) => [r.label, r.code, r.values.join(' | ')]);

describe('collectDateRows', () => {
  it('findet Datumsangaben im Kopf, unter Referenzen und bei Positionen', () => {
    const edi =
      "UNH+1+DESADV:D:10A:UN'BGM+351+X+9'DTM+124:20250305:102'RFF+AAN:LAB-1'DTM+137:20250306:102'" +
      "RFF+ON:3299999901'DTM+171:20250201:102'LIN+1++A2V1:IN'QTY+12:1:PCE'DTM+2:20250310:102'" +
      "LIN+2++A2V2:IN'QTY+12:1:PCE'DTM+2:20250311:102'LIN+3++A2V3:IN'QTY+12:1:PCE'DTM+2:20250310:102'UNT+18+1'";
    expect(rowsOf(edi)).toEqual([
      ['Lieferscheindatum', '124', '05.03.2025'],
      ['Dokumentdatum', '137', '06.03.2025'],
      ['Bestelldatum', '171', '01.02.2025'],
      ['Gewünschter Liefertermin', '2', '10.03.2025 | 11.03.2025'],
    ]);
  });

  it('zeigt unbekannte Datumsarten mit Code statt sie wegzulassen', () => {
    expect(rowsOf("UNH+1+DESADV:D:96A:UN'BGM+351+X+9'DTM+999:20250101:102'UNT+4+1'")).toEqual([['Datum', '999', '01.01.2025']]);
  });

  it('liest alle Datumsangaben des Beispiels 01', () => {
    expect(rowsOf(sample1).map((r) => r[0])).toEqual(['Dokumentdatum', 'Versanddatum', 'Voraussichtliche Ankunft', 'Bestelldatum']);
  });
});
