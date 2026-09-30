import { describe, expect, it } from 'vitest';
import { CODE_LISTS, NUMBER_RULES, SEGMENTS, compareDirectories, describeCode, describeSubset, describeVersion, matchesAny } from './index';
import type { CodeListRegistry } from './types';

describe('describeCode', () => {
  it('findet bekannte Codes', () => {
    expect(describeCode('3035', 'SU')).toMatchObject({ known: true, label: 'Lieferant', en: 'Supplier' });
    expect(describeCode('2005', '137')).toMatchObject({ known: true, label: 'Dokumentdatum' });
  });

  it('kennzeichnet unbekannte Codes, ohne zu raten', () => {
    expect(describeCode('3035', 'QQ')).toEqual({ code: 'QQ', list: '3035', known: false });
    expect(describeCode('9999', 'X')).toEqual({ code: 'X', list: '9999', known: false });
  });

  it('gibt bei leerem Code undefined zurück', () => {
    expect(describeCode('3035', '')).toBeUndefined();
    expect(describeCode('3035', undefined)).toBeUndefined();
  });

  it('meldet Versionsunterschiede aus den Erklär-Daten (since/until)', () => {
    const lists: CodeListRegistry = {
      T: { id: 'T', name: 'Test', codes: { NEU: { label: 'Neu', since: 'D.01B' }, ALT: { label: 'Alt', until: 'D.96A' } } },
    };
    expect(describeCode('T', 'NEU', 'D.96A', lists)?.versionNote).toContain('erst ab D.01B');
    expect(describeCode('T', 'NEU', 'D.07A', lists)?.versionNote).toBeUndefined();
    expect(describeCode('T', 'ALT', 'D.10A', lists)?.versionNote).toContain('nur bis D.96A');
    expect(describeCode('T', 'ALT', 'D.93A', lists)?.versionNote).toBeUndefined();
  });
});

describe('Versionen', () => {
  it('vergleicht Verzeichnisse über die Jahrtausendgrenze', () => {
    expect(compareDirectories('D.96A', 'D.01B')! < 0).toBe(true);
    expect(compareDirectories('D.20B', 'D.10A')! > 0).toBe(true);
    expect(compareDirectories('D.01A', 'D.01B')! < 0).toBe(true);
    expect(compareDirectories('D.07A', 'D.07A')).toBe(0);
    expect(compareDirectories('X', 'D.07A')).toBeUndefined();
  });

  it('beschreibt beliebige Versionen aus dem UNH', () => {
    expect(describeVersion('D', '96A', 'EAN005')).toMatchObject({
      directory: 'D.96A',
      directoryLabel: 'UN/EDIFACT-Verzeichnis D.96A (Jahr 1996, Ausgabe A)',
      subset: { code: 'EAN005', known: true },
    });
    expect(describeVersion('D', '20B').directoryLabel).toContain('Jahr 2020');
    expect(describeVersion('D', '93A').directoryLabel).toContain('Jahr 1993');
    expect(describeVersion('D', '96A').subset).toBeUndefined();
  });

  it('erkennt Subsets exakt und über Präfix', () => {
    expect(describeSubset('GAVF24')).toMatchObject({ known: true });
    expect(describeSubset('EAN010')).toMatchObject({ known: true, name: 'EANCOM (GS1)' });
    expect(describeSubset('XYZ1')).toEqual({ code: 'XYZ1', known: false });
  });
});

describe('Nummern-Muster', () => {
  it.each([
    ['320045678', true],
    ['3201234567', true],
    ['32012345', false], // 8 Stellen
    ['32012345678', false], // 11 Stellen
    ['4500012345', false],
    ['32A1234567', false],
  ])('Bestellnr. %s → %s', (value, expected) => {
    expect(matchesAny(value, NUMBER_RULES.orderNumber)).toBe(expected);
  });

  it.each([
    ['A2V00001234567', true],
    ['a2v123', true],
    ['XA2V1', false],
  ])('Materialnr. %s → %s', (value, expected) => {
    expect(matchesAny(value, NUMBER_RULES.materialNumber)).toBe(expected);
  });
});

describe('Konsistenz der Erklär-Daten', () => {
  it('jede Codeliste hat ihre eigene Nummer als id', () => {
    for (const [key, list] of Object.entries(CODE_LISTS)) expect(list.id).toBe(key);
  });

  it('jedes Segment hat sein Kennzeichen als tag', () => {
    for (const [key, seg] of Object.entries(SEGMENTS)) expect(seg.tag).toBe(key);
  });

  it('Verweise auf Codelisten zeigen auf vorhandene Listen', () => {
    const missing: string[] = [];
    for (const seg of Object.values(SEGMENTS)) {
      for (const el of seg.elements) {
        const refs = [el.codeList, ...(el.components ?? []).map((c) => c.codeList)].filter(Boolean) as string[];
        for (const ref of refs) if (!CODE_LISTS[ref]) missing.push(`${seg.tag}/${el.id} → ${ref}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
