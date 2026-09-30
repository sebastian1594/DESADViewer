import { describe, expect, it } from 'vitest';
import { parseDecimal, tokenize } from './tokenizer';

describe('tokenize – Standard-Trennzeichen', () => {
  it('zerlegt Segmente, Datenelemente und Komponenten', () => {
    const r = tokenize("UNH+1+DESADV:D:96A:UN'BGM+351+LS1+9'");
    expect(r.hasServiceStringAdvice).toBe(false);
    expect(r.segments.map((s) => s.tag)).toEqual(['UNH', 'BGM']);
    expect(r.segments[0].elements).toEqual([['1'], ['DESADV', 'D', '96A', 'UN']]);
    expect(r.segments[1].elements).toEqual([['351'], ['LS1'], ['9']]);
    expect(r.issues).toEqual([]);
  });

  it('behält leere Datenelemente und Komponenten an ihrer Position', () => {
    const r = tokenize("NAD+BY+123::9++Name'");
    expect(r.segments[0].elements).toEqual([['BY'], ['123', '', '9'], [''], ['Name']]);
  });

  it('ignoriert Zeilenumbrüche und Leerraum zwischen Segmenten', () => {
    const r = tokenize("  \r\nUNH+1+DESADV:D:96A:UN'\r\n\r\n   BGM+351+X+9'\n");
    expect(r.segments.map((s) => s.tag)).toEqual(['UNH', 'BGM']);
    expect(r.segments[1].line).toBe(4);
  });

  it('ignoriert Zeilenumbrüche mitten im Segment (80-Zeichen-Umbruch)', () => {
    const r = tokenize("IMD+F++:::Lange Bez\neichnung'");
    expect(r.segments[0].elements[2][3]).toBe('Lange Bezeichnung');
  });

  it('löst das Escape-Zeichen ? auf', () => {
    const r = tokenize("FTX+AAI+++Frage?? Antwort?: 1?+1?'s'");
    expect(r.segments[0].elements[3]).toEqual(["Frage? Antwort: 1+1's"]);
  });

  it('entfernt ein Byte-Order-Mark am Anfang', () => {
    const r = tokenize("﻿UNH+1'");
    expect(r.segments[0].tag).toBe('UNH');
  });

  it('meldet ein fehlendes Endezeichen am Dateiende', () => {
    const r = tokenize("UNH+1'UNZ+1+X");
    expect(r.segments).toHaveLength(2);
    expect(r.issues.map((i) => i.code)).toContain('MISSING_TERMINATOR');
  });

  it('meldet ungültige Segmentkennzeichen', () => {
    const r = tokenize("Hallo Welt'");
    expect(r.issues.map((i) => i.code)).toContain('INVALID_TAG');
  });

  it('überspringt leere Segmente mit Warnung', () => {
    const r = tokenize("UNH+1''BGM+351'");
    expect(r.segments.map((s) => s.tag)).toEqual(['UNH', 'BGM']);
    expect(r.issues.map((i) => i.code)).toContain('EMPTY_SEGMENT');
  });
});

describe('tokenize – UNA (eigene Trennzeichen)', () => {
  it('liest die Standard-UNA', () => {
    const r = tokenize("UNA:+.? 'UNH+1'");
    expect(r.hasServiceStringAdvice).toBe(true);
    expect(r.segments[0].tag).toBe('UNA');
    expect(r.segments[1].tag).toBe('UNH');
  });

  it('verwendet eigene Trennzeichen und eigenes Escape-Zeichen', () => {
    const r = tokenize('UNA>*,# ~UNH*1*DESADV>D>01B~FTX*AAI***A#*B#>C#~D##E~');
    expect(r.delimiters).toMatchObject({ component: '>', element: '*', decimal: ',', release: '#', segment: '~' });
    expect(r.segments[1].elements[1]).toEqual(['DESADV', 'D', '01B']);
    expect(r.segments[2].elements[3]).toEqual(['A*B>C~D#E']);
  });

  it('behandelt Apostroph und Plus als normale Zeichen, wenn UNA andere Trennzeichen festlegt', () => {
    const r = tokenize("UNA:*.? ~NAD*SU*1**O'Brien + Co~");
    expect(r.segments[1].elements[3]).toEqual(["O'Brien + Co"]);
  });

  it('meldet eine unvollständige UNA', () => {
    const r = tokenize('UNA:+');
    expect(r.issues.map((i) => i.code)).toContain('UNA_INCOMPLETE');
  });

  it('meldet doppelt vergebene Trennzeichen', () => {
    const r = tokenize("UNA++.? 'UNH+1'");
    expect(r.issues.map((i) => i.code)).toContain('UNA_DUPLICATE_DELIMITER');
  });
});

describe('parseDecimal', () => {
  it.each([
    ['12', 12],
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['-3', -3],
    ['.5', 0.5],
    ['1250.500', 1250.5],
  ])('%s → %s', (raw, expected) => {
    expect(parseDecimal(raw)).toBe(expected);
  });

  it.each(['', 'zwölf', '1.2.3', '1 000', '12a'])('„%s“ ist keine Zahl', (raw) => {
    expect(parseDecimal(raw)).toBeUndefined();
  });
});
