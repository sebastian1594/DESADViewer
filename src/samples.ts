/**
 * Die Beispieldateien aus /samples, als Text in die App eingebunden.
 * Neue Beispieldatei: Datei in /samples ablegen und hier eintragen.
 */
import s1 from '../samples/01-d96a-einfach.edi?raw';
import s2 from '../samples/02-d07a-automotive-mehrstufig.edi?raw';
import s3 from '../samples/03-d10a-allgemein.edi?raw';
import s4 from '../samples/04-d01b-eigenes-una-escape.edi?raw';
import s5 from '../samples/05-fehlerhaft.edi?raw';
import s6 from '../samples/06-zwei-nachrichten.edi?raw';

export interface Sample {
  file: string;
  title: string;
  content: string;
}

export const SAMPLES: Sample[] = [
  { file: '01-d96a-einfach.edi', title: 'D.96A – einfaches Lieferavis (Handel/EANCOM)', content: s1 },
  { file: '02-d07a-automotive-mehrstufig.edi', title: 'D.07A – Automotive, Palette → Karton → Artikel', content: s2 },
  { file: '03-d10a-allgemein.edi', title: 'D.10A – Industrie, verschiedene Datumsformate', content: s3 },
  { file: '04-d01b-eigenes-una-escape.edi', title: 'D.01B – eigene Trennzeichen (UNA) und Escape-Zeichen', content: s4 },
  { file: '05-fehlerhaft.edi', title: 'Fehlerhafte Datei (zum Testen der Warnungen)', content: s5 },
  { file: '06-zwei-nachrichten.edi', title: 'Zwei Nachrichten in einer Datei', content: s6 },
];
