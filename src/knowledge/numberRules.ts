/**
 * EIGENE NUMMERN-MUSTER
 *
 * Woran erkennt DESADViewer die Materialnummer und die Bestellnummer einer Position?
 * Viele Partner schreiben diese Nummern an unterschiedliche Stellen (LIN, PIA, RFF …).
 * Deshalb sucht die App alle Nummern einer Position ab und nimmt die erste, die zu
 * einem der Muster unten passt. Passt keine, gilt die Standardregel
 * (Materialnr. = Nummer aus LIN, Bestellnr. = Referenz RFF+ON).
 *
 * Die Muster sind „reguläre Ausdrücke“. Kurz erklärt:
 *   ^        = Anfang der Nummer
 *   $        = Ende der Nummer
 *   \d       = eine Ziffer
 *   {7,8}    = das Vorige 7- bis 8-mal
 *   i        = Groß-/Kleinschreibung egal
 *
 * Beispiele:
 *   /^A2V/i          → beginnt mit „A2V“
 *   /^32\d{7,8}$/    → beginnt mit „32“, danach 7–8 Ziffern (insgesamt 9–10 Stellen)
 *   /^45\d{8}$/      → beginnt mit „45“, insgesamt 10 Stellen
 *
 * Weitere Muster einfach in die Liste schreiben, durch Komma getrennt.
 */
export const NUMBER_RULES = {
  /** Materialnummer: gesucht in LIN und PIA einer Position */
  materialNumber: [/^A2V/i],
  /** Bestellnummer: gesucht in den RFF-Segmenten der Position, dann im Nachrichtenkopf
   *  und bei den Beteiligten (z. B. RFF+ON direkt nach NAD+BY) */
  orderNumber: [/^32\d{7,8}$/],
};

export function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(value.trim()));
}
