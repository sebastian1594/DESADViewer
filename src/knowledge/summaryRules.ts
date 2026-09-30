/**
 * DASHBOARD-REGELN
 *
 * Welche Qualifier füllen welches Feld der Zusammenfassung (Dashboard)?
 * Die Reihenfolge ist die Priorität: der erste gefundene Code gewinnt.
 * Beispiel: Für „Ankunftstermin“ wird zuerst DTM 132 gesucht, dann 17 usw.
 */
export const SUMMARY_RULES = {
  /** DTM 2005 */
  /** Datum oben rechts auf der Karte: Dokumentdatum, sonst Lieferscheindatum */
  documentDate: ['137', '124'],
  despatchDate: ['11'],
  arrivalDate: ['132', '17', '69', '76', '2', '35'],
  /** Bestelldatum im Nachrichtenkopf */
  orderDate: ['4'],
  /** Datum direkt unter der Bestellnummer (RFF+ON → DTM+171) gilt ebenfalls als Bestelldatum */
  orderReferenceDate: ['171', '4'],

  /** NAD 3035 */
  supplier: ['SU', 'CZ', 'SE', 'SF'],
  buyer: ['BY', 'OB'],
  shipTo: ['ST', 'DP', 'CN', 'UC'],
  carrier: ['CA', 'FW'],

  /** RFF 1153 – Bestellnummer (gesucht bei der Position, dann im Kopf, dann bei den Beteiligten) */
  orderReference: ['ON'],

  /**
   * LIN/PIA 7143 – welche Art von Artikelnummer als „Materialnummer“ gilt (Reihenfolge = Priorität).
   * IN = Artikelnummer des Käufers, BP = Teilenummer des Käufers.
   * Findet sich keine davon, wird die Hauptnummer aus LIN genommen.
   */
  materialNumberTypes: ['IN', 'BP'],

  /** QTY 6063 – Menge, die in der Positionstabelle als „Liefermenge“ gezeigt wird */
  despatchQuantity: ['12', '46', '113'],

  /** MEA 6313 auf Kopfebene */
  grossWeight: ['AAD', 'AAB'],
  netWeight: ['AAC', 'AAA'],

  /** Woher kommen Chargennummern einer Position? */
  batch: {
    gin: ['BX'], // GIN 7405
    pia: ['NB'], // PIA 7143
    rff: ['BT'], // RFF 1153
  },

  /** CNT 6069 – Anzahl der Positionen (wird mit den LIN-Segmenten verglichen) */
  lineCountControl: ['2'],
};
