/**
 * Typen für das Erklär-Wissen (Segmente, Datenelemente, Codelisten).
 * Die eigentlichen Inhalte stehen in segments.ts, codelists.ts und versions.ts.
 */

/** Ein Eintrag in einer Codeliste, z. B. Code "SU" in Liste 3035 = "Lieferant". */
export interface CodeEntry {
  /** Deutsche Kurzbezeichnung */
  label: string;
  /** Originalbezeichnung aus dem UN/EDIFACT-Verzeichnis (Englisch) */
  en?: string;
  /** Optionale ausführlichere Erklärung auf Deutsch */
  description?: string;
  /** Code ist erst ab diesem Verzeichnis definiert, z. B. "D.01B" */
  since?: string;
  /** Code ist nur bis zu diesem Verzeichnis definiert, z. B. "D.07A" */
  until?: string;
}

/** Eine Codeliste, benannt nach der Nummer des Datenelements (z. B. "2005"). */
export interface CodeList {
  id: string;
  /** Deutscher Name des Datenelements */
  name: string;
  en?: string;
  description?: string;
  codes: Record<string, CodeEntry>;
}

export type CodeListRegistry = Record<string, CodeList>;

/** Ergebnis einer Code-Suche. Wird auch direkt im Datenmodell gespeichert. */
export interface CodedValue {
  /** Der Rohcode aus der Nachricht */
  code: string;
  /** Nummer der Codeliste / des Datenelements, z. B. "3035" */
  list: string;
  /** true = Code steht in den Erklär-Daten */
  known: boolean;
  label?: string;
  en?: string;
  description?: string;
  /** Hinweis, falls der Code laut Erklär-Daten nicht zur Nachrichtenversion passt */
  versionNote?: string;
  /** Hinweis, warum ein Code nicht nachgeschlagen wurde (z. B. fremde Codeliste) */
  note?: string;
}

/** Beschreibung einer Komponente eines zusammengesetzten Datenelements */
export interface ComponentDef {
  id: string;
  name: string;
  codeList?: string;
}

/** Beschreibung eines Datenelements (Position im Segment) */
export interface ElementDef {
  /** Nummer, z. B. "3035" (einfaches Element) oder "C082" (zusammengesetzt) */
  id: string;
  name: string;
  codeList?: string;
  components?: ComponentDef[];
  /** z. B. Hinweise auf Versionsunterschiede */
  note?: string;
}

export interface SegmentDef {
  tag: string;
  name: string;
  en: string;
  description: string;
  elements: ElementDef[];
  note?: string;
}

export interface SubsetInfo {
  code: string;
  known: boolean;
  name?: string;
  description?: string;
}

export interface VersionInfo {
  /** z. B. "D.96A" */
  directory: string;
  /** Lesbare Beschreibung, z. B. "UN/EDIFACT-Verzeichnis D.96A (Jahr 1996, Ausgabe A)" */
  directoryLabel: string;
  subset?: SubsetInfo;
}
