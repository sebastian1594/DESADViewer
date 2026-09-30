import type { SubsetInfo, VersionInfo } from './types';

/**
 * VERSIONEN UND SUBSETS
 *
 * Die Version wird NICHT fest vorgegeben, sondern aus dem UNH-Segment gelesen,
 * z. B. UNH+1+DESADV:D:96A:UN:EAN005 → Verzeichnis „D.96A“, Subset „EAN005“.
 * Jede Version wird verarbeitet – auch solche, die hier nicht stehen.
 *
 * SUBSETS: Branchen- oder Verbandsprofile, die im UNH (Komponente 0057)
 * angegeben werden. Neue Einträge einfach unten ergänzen.
 * `match: 'prefix'` bedeutet: gilt für alle Codes, die so beginnen.
 */
interface SubsetEntry {
  code: string;
  match?: 'exact' | 'prefix';
  name: string;
  description: string;
}

export const SUBSETS: SubsetEntry[] = [
  {
    code: 'EAN005',
    name: 'EANCOM (GS1)',
    description: 'Handels-Subset der GS1 (EANCOM®), aufbauend auf UN/EDIFACT D.96A.',
  },
  {
    code: 'EAN007',
    name: 'EANCOM 2002 (GS1)',
    description: 'Handels-Subset der GS1 (EANCOM® 2002), aufbauend auf UN/EDIFACT D.01B.',
  },
  {
    code: 'EAN',
    match: 'prefix',
    name: 'EANCOM (GS1)',
    description: 'Handels-Subset der GS1 (EANCOM®). Die Ziffern kennzeichnen die Subset-Version.',
  },
  {
    code: 'GAVF',
    match: 'prefix',
    name: 'Automotive-Subset (VDA 4987 / Global DESADV)',
    description:
      'Kennung aus dem Automobilbereich für das globale Lieferavis nach VDA-Empfehlung 4987. Die Ziffern kennzeichnen die Version des Subsets.',
  },
];

/** Sucht die Beschreibung eines Subsets (exakte Treffer vor Präfix-Treffern). */
export function describeSubset(code: string, subsets: SubsetEntry[] = SUBSETS): SubsetInfo {
  const exact = subsets.find((s) => (s.match ?? 'exact') === 'exact' && s.code === code);
  const prefix = subsets.find((s) => s.match === 'prefix' && code.startsWith(s.code));
  const hit = exact ?? prefix;
  if (!hit) return { code, known: false };
  return { code, known: true, name: hit.name, description: hit.description };
}

/**
 * Zerlegt ein Verzeichnis wie "D.96A" in einen vergleichbaren Zahlenwert.
 * Gibt undefined zurück, wenn das Format unbekannt ist.
 */
export function directorySortKey(directory: string): number | undefined {
  const m = /^([A-Z])[.:]?(\d{2})([A-Z])$/.exec(directory.trim().toUpperCase());
  if (!m) return undefined;
  const yy = Number(m[2]);
  // UN/EDIFACT-Verzeichnisse gibt es seit Ende der 1980er-Jahre.
  const year = yy >= 88 ? 1900 + yy : 2000 + yy;
  return year * 100 + (m[3].charCodeAt(0) - 64);
}

/** Vergleicht zwei Verzeichnisse. Ergebnis <0, 0, >0 – oder undefined, wenn nicht vergleichbar. */
export function compareDirectories(a: string, b: string): number | undefined {
  const ka = directorySortKey(a);
  const kb = directorySortKey(b);
  if (ka === undefined || kb === undefined) return undefined;
  return ka - kb;
}

/** Baut die lesbare Versionsbeschreibung aus den UNH-Angaben. */
export function describeVersion(version: string, release: string, associationCode?: string): VersionInfo {
  const directory = version && release ? `${version}.${release}` : version || release || '?';
  let directoryLabel: string;
  const m = /^(\d{2})([A-Z])$/.exec(release);
  if (version === 'D' && m) {
    const key = directorySortKey(directory)!;
    const year = Math.floor(key / 100);
    directoryLabel = `UN/EDIFACT-Verzeichnis ${directory} (Jahr ${year}, Ausgabe ${m[2]})`;
  } else if (version === 'S' && m) {
    directoryLabel = `UN/EDIFACT-Standardverzeichnis ${directory}`;
  } else {
    directoryLabel = `Verzeichnis ${directory} (Format nicht erkannt – Angaben werden trotzdem verarbeitet)`;
  }
  return {
    directory,
    directoryLabel,
    subset: associationCode ? describeSubset(associationCode) : undefined,
  };
}
