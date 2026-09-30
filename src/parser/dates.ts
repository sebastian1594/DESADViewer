/**
 * DATUMSUMWANDLUNG – EDIFACT-Datumswerte (DTM) ins deutsche Format.
 *
 * Das Format ergibt sich aus dem Formatcode (Datenelement 2379), z. B.
 * 102 = JJJJMMTT → "15.03.2024". Unbekannte Formate werden NICHT geraten,
 * sondern als Rohwert angezeigt (recognized = false).
 * Zweistellige Jahre (Formate 2, 101, 201) bleiben zweistellig, weil das
 * Jahrhundert nicht sicher bekannt ist.
 */
import type { FormattedDate } from './model';

const pad = (n: number | string, len = 2) => String(n).padStart(len, '0');

function isValidDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function isValidTime(h: number, m: number, s = 0): boolean {
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59;
}

const invalid = (value: string, error: string): FormattedDate => ({
  valid: false,
  recognized: true,
  display: value,
  error,
});

interface DateParts {
  display: string;
  iso?: string;
}

/** JJJJMMTT[HHMM[SS]] → Anzeige + ISO */
function fullDateTime(value: string, withTime: 0 | 1 | 2): DateParts | string {
  const y = Number(value.slice(0, 4));
  const mo = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));
  if (!isValidDay(y, mo, d)) return `„${value}“ ist kein gültiges Datum (Tag ${pad(d)}, Monat ${pad(mo)}).`;
  let display = `${pad(d)}.${pad(mo)}.${y}`;
  let iso = `${y}-${pad(mo)}-${pad(d)}`;
  if (withTime > 0) {
    const h = Number(value.slice(8, 10));
    const mi = Number(value.slice(10, 12));
    const s = withTime === 2 ? Number(value.slice(12, 14)) : 0;
    if (!isValidTime(h, mi, s)) return `„${value}“ enthält keine gültige Uhrzeit.`;
    display += ` ${pad(h)}:${pad(mi)}`;
    iso += `T${pad(h)}:${pad(mi)}`;
    if (withTime === 2) {
      display += `:${pad(s)}`;
      iso += `:${pad(s)}`;
    }
  }
  return { display, iso };
}

/** JJMMTT[HHMM] → Anzeige mit zweistelligem Jahr (kein ISO-Wert) */
function shortYearDate(yy: string, mm: string, dd: string, time?: string): DateParts | string {
  // Zur Prüfung (Schaltjahr) reicht ein Jahr im selben Zyklus.
  if (!isValidDay(2000 + Number(yy), Number(mm), Number(dd))) return `„${dd}.${mm}.${yy}“ ist kein gültiges Datum.`;
  let display = `${dd}.${mm}.${yy}`;
  if (time) {
    const h = Number(time.slice(0, 2));
    const mi = Number(time.slice(2, 4));
    if (!isValidTime(h, mi)) return `„${time}“ ist keine gültige Uhrzeit.`;
    display += ` ${time.slice(0, 2)}:${time.slice(2, 4)}`;
  }
  return { display };
}

type Handler = { pattern: RegExp; convert: (v: string, m: RegExpExecArray) => DateParts | string };

const HANDLERS: Record<string, Handler> = {
  '2': { pattern: /^(\d{2})(\d{2})(\d{2})$/, convert: (_v, m) => shortYearDate(m[3], m[2], m[1]) },
  '101': { pattern: /^(\d{2})(\d{2})(\d{2})$/, convert: (_v, m) => shortYearDate(m[1], m[2], m[3]) },
  '102': { pattern: /^\d{8}$/, convert: (v) => fullDateTime(v, 0) },
  '201': { pattern: /^(\d{2})(\d{2})(\d{2})(\d{4})$/, convert: (_v, m) => shortYearDate(m[1], m[2], m[3], m[4]) },
  '203': { pattern: /^\d{12}$/, convert: (v) => fullDateTime(v, 1) },
  '204': { pattern: /^\d{14}$/, convert: (v) => fullDateTime(v, 2) },
  '205': {
    pattern: /^(\d{12})([+-])(\d{2})(\d{2})$/,
    convert: (_v, m) => {
      const base = fullDateTime(m[1], 1);
      if (typeof base === 'string') return base;
      const zone = `${m[2]}${m[3]}:${m[4]}`;
      return { display: `${base.display} (UTC${zone})`, iso: `${base.iso}${zone}` };
    },
  },
  '401': {
    pattern: /^(\d{2})(\d{2})$/,
    convert: (v, m) => (isValidTime(Number(m[1]), Number(m[2])) ? { display: `${m[1]}:${m[2]} Uhr` } : `„${v}“ ist keine gültige Uhrzeit.`),
  },
  '602': { pattern: /^\d{4}$/, convert: (v) => ({ display: v, iso: v }) },
  '610': {
    pattern: /^(\d{4})(\d{2})$/,
    convert: (v, m) => {
      const mo = Number(m[2]);
      return mo >= 1 && mo <= 12 ? { display: `${m[2]}.${m[1]}`, iso: `${m[1]}-${m[2]}` } : `„${v}“ enthält keinen gültigen Monat.`;
    },
  },
  '616': {
    pattern: /^(\d{4})(\d{2})$/,
    convert: (v, m) => {
      const w = Number(m[2]);
      return w >= 1 && w <= 53 ? { display: `KW ${m[2]}/${m[1]}`, iso: `${m[1]}-W${m[2]}` } : `„${v}“ enthält keine gültige Kalenderwoche.`;
    },
  },
  '718': {
    pattern: /^(\d{8})-(\d{8})$/,
    convert: (_v, m) => range(fullDateTime(m[1], 0), fullDateTime(m[2], 0)),
  },
  '719': {
    pattern: /^(\d{12})-(\d{12})$/,
    convert: (_v, m) => range(fullDateTime(m[1], 1), fullDateTime(m[2], 1)),
  },
};

function range(a: DateParts | string, b: DateParts | string): DateParts | string {
  if (typeof a === 'string') return a;
  if (typeof b === 'string') return b;
  return { display: `${a.display} – ${b.display}`, iso: `${a.iso}/${b.iso}` };
}

/** Liste der Formatcodes, die umgewandelt werden können. */
export const SUPPORTED_DATE_FORMATS = Object.keys(HANDLERS);

/**
 * Wandelt einen EDIFACT-Datumswert um.
 * @param value  Rohwert, z. B. "20240315"
 * @param format Formatcode, z. B. "102"
 */
export function formatEdiDate(value: string, format: string | undefined): FormattedDate {
  if (!format) {
    return { valid: true, recognized: false, display: value, error: 'Kein Formatcode angegeben – Rohwert wird angezeigt.' };
  }
  const handler = HANDLERS[format];
  if (!handler) {
    return {
      valid: true,
      recognized: false,
      display: value,
      error: `Datumsformat ${format} ist nicht hinterlegt – Rohwert wird angezeigt.`,
    };
  }
  const m = handler.pattern.exec(value);
  if (!m) return invalid(value, `„${value}“ passt nicht zum Datumsformat ${format}.`);
  const result = handler.convert(value, m);
  if (typeof result === 'string') return invalid(value, result);
  return { valid: true, recognized: true, display: result.display, iso: result.iso };
}
