/**
 * Öffentliche Schnittstelle des Parsers.
 *
 *   import { parseEdifact } from './parser';
 *   const result = parseEdifact(dateiInhalt);
 *
 * Der Parser ist unabhängig von der Oberfläche und läuft komplett im Browser
 * (keine Netzwerkzugriffe).
 */
import { buildDesadv } from './desadv';
import { analyzeEnvelope } from './envelope';
import type { Issue, ParseResult } from './model';
import { DEFAULT_DELIMITERS, tokenize } from './tokenizer';

export * from './model';
export { formatEdiDate, SUPPORTED_DATE_FORMATS } from './dates';
export { tokenize, parseDecimal, DEFAULT_DELIMITERS } from './tokenizer';

export function parseEdifact(input: string): ParseResult {
  if (!input || input.trim() === '') {
    return {
      delimiters: DEFAULT_DELIMITERS,
      hasServiceStringAdvice: false,
      segments: [],
      interchanges: [],
      groups: [],
      messages: [],
      issues: [{ severity: 'error', code: 'EMPTY_INPUT', message: 'Die Eingabe ist leer. Bitte eine Datei auswählen oder Text einfügen.' }],
    };
  }

  const tokens = tokenize(input);
  const issues: Issue[] = [...tokens.issues];
  const envelope = analyzeEnvelope(tokens.segments);
  issues.push(...envelope.issues);

  if (envelope.messages.length === 0) {
    const invalidTags = tokens.segments.filter((s) => !/^[A-Z][A-Z0-9]{2}$/.test(s.tag)).length;
    const looksBroken = tokens.segments.length === 0 || invalidTags / tokens.segments.length > 0.5;
    issues.unshift({
      severity: 'error',
      code: looksBroken ? 'NOT_EDIFACT' : 'NO_MESSAGE',
      message: looksBroken
        ? 'Die Eingabe sieht nicht nach einer EDIFACT-Nachricht aus. Eine DESADV-Datei beginnt normalerweise mit „UNA“, „UNB“ oder „UNH“.'
        : 'In der Datei wurde keine Nachricht gefunden (kein UNH-Segment).',
    });
  }

  const messages = envelope.messages.map((env, i) => {
    const built = buildDesadv(env, tokens.segments, i);
    issues.push(...built.issues);
    return built.message;
  });

  return {
    delimiters: tokens.delimiters,
    hasServiceStringAdvice: tokens.hasServiceStringAdvice,
    segments: tokens.segments,
    interchanges: envelope.interchanges,
    groups: envelope.groups,
    messages,
    issues,
  };
}

/** true, wenn mindestens ein Fehler (nicht nur Warnung/Hinweis) vorliegt */
export function hasErrors(result: ParseResult): boolean {
  return result.issues.some((i) => i.severity === 'error');
}
