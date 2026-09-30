import { CODE_LISTS } from './codelists';
import { SEGMENTS } from './segments';
import type { CodedValue, CodeListRegistry, SegmentDef } from './types';
import { compareDirectories } from './versions';

export * from './types';
export { CODE_LISTS } from './codelists';
export { SEGMENTS } from './segments';
export { SUMMARY_RULES } from './summaryRules';
export { describeVersion, describeSubset, compareDirectories } from './versions';

/**
 * Schlägt einen Code nach. Unbekannte Codes werden als `known: false`
 * zurückgegeben – es wird nie geraten.
 *
 * @param listId    Nummer des Datenelements, z. B. "3035"
 * @param code      Code aus der Nachricht; leer → undefined
 * @param directory Verzeichnis der Nachricht (z. B. "D.96A") für Versionshinweise
 */
export function describeCode(
  listId: string,
  code: string | undefined,
  directory?: string,
  lists: CodeListRegistry = CODE_LISTS,
): CodedValue | undefined {
  if (code === undefined || code === '') return undefined;
  const entry = lists[listId]?.codes[code];
  if (!entry) return { code, list: listId, known: false };

  let versionNote: string | undefined;
  if (directory && entry.since) {
    const cmp = compareDirectories(directory, entry.since);
    if (cmp !== undefined && cmp < 0) {
      versionNote = `Laut Erklär-Daten erst ab ${entry.since} definiert, die Nachricht ist aber ${directory}.`;
    }
  }
  if (directory && entry.until) {
    const cmp = compareDirectories(directory, entry.until);
    if (cmp !== undefined && cmp > 0) {
      versionNote = `Laut Erklär-Daten nur bis ${entry.until} definiert, die Nachricht ist aber ${directory}.`;
    }
  }

  const result: CodedValue = { code, list: listId, known: true, label: entry.label };
  if (entry.en) result.en = entry.en;
  if (entry.description) result.description = entry.description;
  if (versionNote) result.versionNote = versionNote;
  return result;
}

/**
 * Codelisten, deren Codes nur dann UN-Codes sind, wenn im selben zusammengesetzten
 * Datenelement keine andere verantwortliche Stelle (3055) angegeben ist.
 * Beispiel: PAC+2++CT::92 → „CT“ ist eine Packmittelnummer des Käufers, nicht „Karton“.
 */
export const AGENCY_SENSITIVE_LISTS = ['7065'];

/** Wie describeCode, beachtet aber eine fremde verantwortliche Stelle (3055). */
export function describeCodeWithAgency(
  listId: string,
  code: string | undefined,
  agency: string | undefined,
  directory?: string,
): CodedValue | undefined {
  if (code === undefined || code === '') return undefined;
  if (agency && agency !== '6' && AGENCY_SENSITIVE_LISTS.includes(listId)) {
    const agencyLabel = describeCode('3055', agency)?.label;
    return {
      code,
      list: listId,
      known: false,
      note: `Code aus einer eigenen Liste (Stelle ${agency}${agencyLabel ? ` = ${agencyLabel}` : ''}) – Bedeutung ist nur den Partnern bekannt.`,
    };
  }
  return describeCode(listId, code, directory);
}

/** Name einer Codeliste, z. B. "3035" → "Rolle des Beteiligten" */
export function codeListName(listId: string, lists: CodeListRegistry = CODE_LISTS): string | undefined {
  return lists[listId]?.name;
}

/** Beschreibung eines Segments oder undefined, wenn nicht hinterlegt. */
export function describeSegment(tag: string): SegmentDef | undefined {
  return SEGMENTS[tag];
}

export function isKnownSegment(tag: string): boolean {
  return tag in SEGMENTS;
}
