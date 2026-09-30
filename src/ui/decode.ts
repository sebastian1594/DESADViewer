/**
 * Wandelt die Bytes einer Datei in Text um – komplett im Browser.
 *
 * EDIFACT-Dateien sind meist UTF-8 oder ISO 8859-1 (Zeichensatz UNOC).
 * Erst wird streng UTF-8 versucht; scheitert das, wird Windows-1252
 * (Obermenge von ISO 8859-1) verwendet, damit Umlaute richtig erscheinen.
 */
export interface DecodedFile {
  text: string;
  encoding: 'UTF-8' | 'ISO-8859-1';
  /** Gesetzt, wenn die Datei offensichtlich keine Textdatei ist (z. B. "PDF") */
  binaryKind?: string;
}

function detectBinary(bytes: Uint8Array): string | undefined {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0x25, 0x50, 0x44, 0x46)) return 'PDF-Dokument';
  if (startsWith(0x50, 0x4b, 0x03, 0x04)) return 'ZIP-Archiv bzw. Excel-/Word-Datei';
  if (startsWith(0xd0, 0xcf, 0x11, 0xe0)) return 'ältere Office-Datei';
  if (startsWith(0x89, 0x50, 0x4e, 0x47) || startsWith(0xff, 0xd8, 0xff)) return 'Bilddatei';
  const probe = bytes.subarray(0, 4096);
  if (probe.includes(0)) return 'Binärdatei';
  return undefined;
}

export function decodeBytes(bytes: Uint8Array): DecodedFile {
  const binaryKind = detectBinary(bytes);
  if (binaryKind) return { text: '', encoding: 'UTF-8', binaryKind };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'ISO-8859-1' };
  }
}
