import { describe, expect, it } from 'vitest';
import sample1 from '../../samples/01-d96a-einfach.edi?raw';
import { parseEdifact } from '../parser';
import { tokenize } from '../parser/tokenizer';
import { explainSegment, segmentSummary } from './explain';

const seg = (text: string) => tokenize(text).segments[0];

describe('explainSegment', () => {
  it('erklärt ein NAD-Segment Element für Element', () => {
    const e = explainSegment(seg("NAD+SU+4012345000009::9++Fantasie AG'"), 'D.96A');
    expect(e.def?.name).toBe('Name und Anschrift');
    expect(e.elements[0]).toMatchObject({ position: 1, isComposite: false, def: { id: '3035' } });
    expect(e.elements[0].components[0].coded).toMatchObject({ known: true, label: 'Lieferant' });
    expect(e.elements[1].isComposite).toBe(true);
    expect(e.elements[1].components.map((c) => [c.def?.id, c.value])).toEqual([
      ['3039', '4012345000009'],
      ['1131', ''],
      ['3055', '9'],
    ]);
    expect(e.elements[1].components[2].coded?.label).toContain('GS1');
    expect(e.elements[2].empty).toBe(true);
  });

  it('rechnet Datumswerte direkt um', () => {
    const e = explainSegment(seg("DTM+137:20240315:102'"));
    expect(e.elements[0].components[1]).toMatchObject({ value: '20240315', hint: '15.03.2024' });
    const bad = explainSegment(seg("DTM+137:20241345:102'"));
    expect(bad.elements[0].components[1]).toMatchObject({ hintIsError: true });
  });

  it('kennzeichnet unbekannte Codes und Segmente', () => {
    expect(explainSegment(seg("NAD+QQ'")).elements[0].components[0].coded).toMatchObject({ code: 'QQ', known: false });
    const unknown = explainSegment(seg("XYZ+a:b+c'"));
    expect(unknown.def).toBeUndefined();
    expect(unknown.elements.map((el) => el.components.map((c) => c.value))).toEqual([['a', 'b'], ['c']]);
  });

  it('markiert Elemente, die über die Beschreibung hinausgehen', () => {
    const e = explainSegment(seg("CPS+1++4+X+Y'"));
    expect(e.elements.map((el) => el.beyondDefinition)).toEqual([false, false, false, true, true]);
  });

  it('beachtet fremde Codelisten bei Packmitteln', () => {
    const e = explainSegment(seg("PAC+2++CT::92'"));
    expect(e.elements[2].components[0].coded).toMatchObject({ known: false, note: expect.stringContaining('Stelle 92') });
  });

  it('zeigt die sechs UNA-Zeichen einzeln', () => {
    const e = explainSegment(tokenize("UNA:+.? 'UNH+1'").segments[0]);
    expect(e.elements.map((el) => el.components[0].value)).toEqual([':', '+', '.', '?', ' ', "'"]);
  });
});

describe('segmentSummary', () => {
  const r = parseEdifact(sample1);
  const summaries = Object.fromEntries(r.segments.map((s) => [s.raw, segmentSummary(s, 'D.96A')]));

  it.each([
    ["UNH+ME000001+DESADV:D:96A:UN:EAN005'", 'DESADV D.96A (EAN005) · Ref. ME000001'],
    ["DTM+11:202403151400:203'", 'Versanddatum: 15.03.2024 14:00'],
    ["QTY+12:24:PCE'", 'Liefermenge: 24 Stück'],
    ["CPS+2+1'", 'Ebene 2 in Ebene 1'],
    ["PAC+1++PX'", '1 × Palette'],
    ["GIN+BJ+395212340000000014'", 'SSCC (Nummer der Versandeinheit): 395212340000000014'],
    ["RFF+ON:4500012345:10'", 'Bestellnummer (Käufer): 4500012345 / Pos. 10'],
    ["UNT+32+ME000001'", '32 Segmente · Ref. ME000001'],
  ])('%s → %s', (raw, expected) => {
    expect(summaries[raw]).toBe(expected);
  });
});

describe('Lage der Segmente (segmentPlacement)', () => {
  it('rückt Gruppen und Untergruppen ein', () => {
    const r = parseEdifact(sample1);
    const m = r.messages[0];
    const placement = (tag: string) => {
      const s = r.segments.find((x) => x.tag === tag)!;
      return m.segmentPlacement[s.index];
    };
    expect(placement('UNH')).toEqual({ depth: 0, group: 'message' });
    expect(placement('BGM')).toEqual({ depth: 0, group: 'message' });
    expect(placement('CTA')).toEqual({ depth: 1, group: 'contact' });
    expect(placement('COM')).toEqual({ depth: 2, group: 'contact' });
    expect(placement('PCI')).toEqual({ depth: 2, group: 'marking' });
    expect(placement('GIN')).toEqual({ depth: 3, group: 'marking' });
    expect(placement('UNT')).toEqual({ depth: 0, group: 'message' });
    // jedes Segment der Nachricht hat eine Lage
    for (let i = m.segmentRange.start; i <= m.segmentRange.end; i++) expect(m.segmentPlacement[i]).toBeDefined();
  });
});
