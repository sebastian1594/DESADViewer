import { describe, expect, it } from 'vitest';
import { decodeBytes } from './decode';

describe('decodeBytes', () => {
  it('liest UTF-8 mit Umlauten', () => {
    const bytes = new TextEncoder().encode("NAD+SU+++Müller Öl GmbH'");
    expect(decodeBytes(bytes)).toEqual({ text: "NAD+SU+++Müller Öl GmbH'", encoding: 'UTF-8' });
  });

  it('fällt bei ISO 8859-1 (z. B. UNOC) zurück und zeigt Umlaute richtig', () => {
    // "Müller" in ISO 8859-1: ü = 0xFC
    const bytes = new Uint8Array([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72]);
    expect(decodeBytes(bytes)).toEqual({ text: 'Müller', encoding: 'ISO-8859-1' });
  });

  it('erkennt PDF- und Excel-Dateien', () => {
    expect(decodeBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])).binaryKind).toBe('PDF-Dokument');
    expect(decodeBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])).binaryKind).toContain('Excel');
  });

  it('erkennt sonstige Binärdateien an Null-Bytes', () => {
    expect(decodeBytes(new Uint8Array([0x55, 0x4e, 0x00, 0x48])).binaryKind).toBe('Binärdatei');
  });
});
