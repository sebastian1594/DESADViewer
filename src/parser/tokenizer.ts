/**
 * TOKENIZER – zerlegt den EDIFACT-Text in Segmente, Datenelemente und Komponenten.
 *
 * - Wertet ein UNA-Segment aus (eigene Trennzeichen), sonst Standard: ' + : ? .
 * - Löst Escape-Zeichen auf (z. B. "?+" → "+").
 * - Ignoriert Leerraum zwischen Segmenten und Zeilenumbrüche innerhalb von
 *   Segmenten (viele Systeme brechen EDIFACT-Dateien nach 80 Zeichen um).
 * - Bricht nie ab: Probleme werden als Issues gemeldet.
 */
import type { Delimiters, Issue, RawSegment } from './model';

export const DEFAULT_DELIMITERS: Delimiters = {
  component: ':',
  element: '+',
  decimal: '.',
  release: '?',
  repetition: ' ',
  segment: "'",
};

export interface TokenizeResult {
  delimiters: Delimiters;
  hasServiceStringAdvice: boolean;
  segments: RawSegment[];
  issues: Issue[];
}

const TAG_PATTERN = /^[A-Z][A-Z0-9]{2}$/;

/** Anzeige eines Zeichens in Fehlermeldungen (Leerzeichen/Umbrüche sichtbar machen). */
export function showChar(ch: string): string {
  if (ch === ' ') return '(Leerzeichen)';
  if (ch === '\n') return '(Zeilenumbruch)';
  if (ch === '\r') return '(Wagenrücklauf)';
  if (ch === '\t') return '(Tabulator)';
  return `„${ch}“`;
}

function readServiceStringAdvice(chars: string, issues: Issue[]): Delimiters {
  const d: Delimiters = {
    component: chars[0],
    element: chars[1],
    decimal: chars[2],
    release: chars[3],
    repetition: chars[4],
    segment: chars[5],
  };
  const important: [string, string][] = [
    ['Komponenten-Trennzeichen', d.component],
    ['Datenelement-Trennzeichen', d.element],
    ['Segment-Endezeichen', d.segment],
  ];
  if (d.release !== ' ') important.push(['Escape-Zeichen', d.release]);
  const seen = new Map<string, string>();
  for (const [name, ch] of important) {
    const other = seen.get(ch);
    if (other) {
      issues.push({
        severity: 'error',
        code: 'UNA_DUPLICATE_DELIMITER',
        message: `UNA ist fehlerhaft: ${other} und ${name} verwenden dasselbe Zeichen ${showChar(ch)}. Die Datei kann falsch zerlegt werden.`,
        segmentIndex: 0,
      });
    }
    seen.set(ch, name);
  }
  if (d.decimal !== '.' && d.decimal !== ',') {
    issues.push({
      severity: 'warning',
      code: 'UNA_UNUSUAL_DECIMAL',
      message: `UNA gibt ${showChar(d.decimal)} als Dezimalzeichen an. Üblich sind Punkt oder Komma.`,
      segmentIndex: 0,
    });
  }
  return d;
}

export function tokenize(input: string): TokenizeResult {
  const issues: Issue[] = [];
  const segments: RawSegment[] = [];
  const text = input.replace(/^﻿/, ''); // Byte-Order-Mark entfernen
  const len = text.length;
  let pos = 0;
  let line = 1;
  let delimiters = DEFAULT_DELIMITERS;
  let hasServiceStringAdvice = false;

  const isDelimiter = (ch: string) =>
    ch === delimiters.segment || ch === delimiters.element || ch === delimiters.component || ch === delimiters.release;

  const skipWhitespace = () => {
    while (pos < len) {
      const ch = text[pos];
      if ((ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') && !isDelimiter(ch)) {
        if (ch === '\n') line++;
        pos++;
      } else break;
    }
  };

  skipWhitespace();

  // ── UNA (Trennzeichen-Vorgabe) ──
  if (text.startsWith('UNA', pos)) {
    const chars = text.substr(pos + 3, 6);
    if (chars.length < 6) {
      issues.push({
        severity: 'error',
        code: 'UNA_INCOMPLETE',
        message: 'Das UNA-Segment ist unvollständig (es braucht genau 6 Zeichen nach „UNA“). Es werden die Standard-Trennzeichen verwendet.',
      });
      pos = len;
    } else {
      hasServiceStringAdvice = true;
      delimiters = readServiceStringAdvice(chars, issues);
      segments.push({ index: 0, tag: 'UNA', elements: [[chars]], raw: `UNA${chars}`, offset: pos, line });
      pos += 9;
    }
  }

  const releaseActive = delimiters.release !== ' ' && delimiters.release !== '';

  // ── Segmente ──
  while (pos < len) {
    skipWhitespace();
    if (pos >= len) break;

    const start = pos;
    const startLine = line;
    const elements: string[][] = [];
    let components: string[] = [];
    let buf = '';
    let rawText = '';
    let terminated = false;

    while (pos < len) {
      const ch = text[pos];
      if ((ch === '\n' || ch === '\r') && !isDelimiter(ch)) {
        // Zeilenumbruch mitten im Segment → ignorieren
        if (ch === '\n') line++;
        pos++;
        continue;
      }
      if (releaseActive && ch === delimiters.release) {
        if (pos + 1 >= len) {
          issues.push({
            severity: 'warning',
            code: 'RELEASE_AT_END',
            message: `Das Escape-Zeichen ${showChar(ch)} steht ganz am Ende der Datei und hat keine Wirkung.`,
            segmentIndex: segments.length,
          });
          rawText += ch;
          pos++;
          continue;
        }
        const next = text[pos + 1];
        buf += next;
        rawText += ch + next;
        if (next === '\n') line++;
        pos += 2;
        continue;
      }
      rawText += ch;
      pos++;
      if (ch === delimiters.segment) {
        terminated = true;
        break;
      }
      if (ch === delimiters.element) {
        components.push(buf);
        elements.push(components);
        components = [];
        buf = '';
      } else if (ch === delimiters.component) {
        components.push(buf);
        buf = '';
      } else {
        buf += ch;
      }
    }
    components.push(buf);
    elements.push(components);

    const index = segments.length;
    const tag = elements[0][0];
    if (tag === '' && elements.length === 1 && elements[0].length === 1) {
      issues.push({
        severity: 'warning',
        code: 'EMPTY_SEGMENT',
        message: `In Zeile ${startLine} steht ein leeres Segment (zwei Segment-Endezeichen hintereinander). Es wird übersprungen.`,
      });
      continue;
    }
    if (elements[0].length > 1) {
      issues.push({
        severity: 'warning',
        code: 'TAG_WITH_COMPONENTS',
        message: `Das Segmentkennzeichen „${elements[0].join(delimiters.component)}“ enthält Komponenten; verwendet wird „${tag}“.`,
        segmentIndex: index,
      });
    }
    segments.push({ index, tag, elements: elements.slice(1), raw: rawText, offset: start, line: startLine });

    if (!TAG_PATTERN.test(tag)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_TAG',
        message: `„${tag.slice(0, 20)}“ (Zeile ${startLine}) ist kein gültiges Segmentkennzeichen. Erwartet werden drei Großbuchstaben/Ziffern wie „NAD“.`,
        segmentIndex: index,
      });
    }
    if (!terminated) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_TERMINATOR',
        message: `Das letzte Segment (${tag}) endet nicht mit dem Segment-Endezeichen ${showChar(delimiters.segment)}. Die Datei ist evtl. unvollständig.`,
        segmentIndex: index,
      });
    }
  }

  return { delimiters, hasServiceStringAdvice, segments, issues };
}

/**
 * Wandelt eine EDIFACT-Zahl in eine JavaScript-Zahl um.
 * Punkt und Komma werden beide als Dezimalzeichen akzeptiert (wie in ISO 9735 erlaubt).
 * Gibt undefined zurück, wenn der Wert keine gültige Zahl ist.
 */
export function parseDecimal(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const s = raw.trim();
  if (!/^-?(\d+([.,]\d*)?|[.,]\d+)$/.test(s)) return undefined;
  return Number(s.replace(',', '.'));
}
