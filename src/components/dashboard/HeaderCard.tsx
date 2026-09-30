import type { ReactNode } from 'react';
import type { DateEntry, DesadvMessage } from '../../parser';
import { Coded, DateText } from '../Coded';
import { SegLink } from '../SegmentLink';
import { Card, KeyValues } from './Card';

/** Datum mit Sprung-Knopf; leer → „–“ */
function DateWithLink({ entry }: { entry: DateEntry | undefined }) {
  return (
    <>
      <DateText entry={entry} /> <SegLink index={entry?.segmentIndex} />
    </>
  );
}

export function HeaderCard({ message }: { message: DesadvMessage }) {
  const s = message.summary;
  const h = message.header;
  const shownDates = new Set([s.documentDate, s.despatchDate, s.arrivalDate]);
  const otherDates = message.dates.filter((d) => !shownDates.has(d));

  return (
    <Card title="Kopfdaten">
      <div className="headline-number">
        <span className="muted small">Lieferscheinnr. / Dokumentnr.</span>
        <span>
          <strong>{s.documentNumber ?? '–'}</strong> <SegLink index={h.segmentIndex} />
        </span>
      </div>
      <KeyValues
        rows={[
          ['Dokumentart', h.documentName ? <Coded value={h.documentName} /> : h.documentNameText],
          ['Funktion', h.messageFunction && <Coded value={h.messageFunction} />],
          ['Dokumentdatum', <DateWithLink entry={s.documentDate} />],
          ['Versanddatum', <DateWithLink entry={s.despatchDate} />],
          [s.arrivalDate?.qualifier?.label ?? 'Liefer-/Ankunftstermin', <DateWithLink entry={s.arrivalDate} />],
          ['Bestellnummer(n)', s.orderNumbers.length > 0 && s.orderNumbers.join(', ')],
        ]}
      />

      {(otherDates.length > 0 || message.references.length > 0) && (
        <>
          <h3>Weitere Termine und Referenzen</h3>
          <KeyValues
            rows={[
              ...otherDates.map((d): [ReactNode, ReactNode] => [<Coded value={d.qualifier} showCode={false} fallback="Datum" />, <DateWithLink entry={d} />]),
              ...message.references.map((r): [ReactNode, ReactNode] => [
                <Coded value={r.qualifier} showCode={false} fallback="Referenz" />,
                <>
                  {r.value}
                  {r.lineNumber && <span className="muted"> / Pos. {r.lineNumber}</span>} <SegLink index={r.segmentIndex} />
                  {r.dates.map((d) => (
                    <span key={d.segmentIndex} className="muted small">
                      {' '}
                      · {d.qualifier?.label ?? 'Datum'}: <DateText entry={d} />
                    </span>
                  ))}
                </>,
              ]),
            ]}
          />
        </>
      )}
    </Card>
  );
}
