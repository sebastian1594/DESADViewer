import type { ReactNode } from 'react';
import type { DesadvMessage } from '../../parser';
import { codeText, measurementText } from '../../ui/format';
import { Coded, DateText } from '../Coded';
import { SegLink } from '../SegmentLink';
import { Card, KeyValues } from './Card';

export function TransportCard({ message }: { message: DesadvMessage }) {
  const empty =
    message.transports.length + message.equipment.length + message.deliveryTerms.length + message.locations.length + message.notes.length === 0;

  return (
    <Card title="Transport und Lieferung">
      {empty && <p className="muted">Keine Transportangaben in der Nachricht.</p>}

      {message.transports.map((t) => (
        <div className="sub-block" key={t.segmentIndex}>
          <h3>
            🚚 Transport{t.stage && <span className="muted"> · {codeText(t.stage)}</span>} <SegLink index={t.segmentIndex} />
          </h3>
          <KeyValues
            rows={[
              ['Verkehrszweig', t.mode ? <Coded value={t.mode} /> : t.modeText],
              ['Transportmittel', t.meansType && <Coded value={t.meansType} />],
              ['Frachtführer', (t.carrierName || t.carrierId) && [t.carrierName, t.carrierId && `(${t.carrierId})`].filter(Boolean).join(' ')],
              [
                'Kennzeichen',
                t.vehicleId && (
                  <>
                    <span className="mono">{t.vehicleId}</span>
                    {t.vehicleNationality && <span className="muted"> · {codeText(t.vehicleNationality)}</span>}
                  </>
                ),
              ],
              ['Fahrzeug', t.vehicleName],
              ['Fahrt-/Transportnr.', t.journeyId],
              ...t.references.map((r): [ReactNode, ReactNode] => [<Coded value={r.qualifier} showCode={false} fallback="Referenz" />, r.value]),
              ...t.locations.map((l): [ReactNode, ReactNode] => [
                <Coded value={l.qualifier} showCode={false} fallback="Ort" />,
                <>
                  {[l.id, l.name].filter(Boolean).join(' – ')}
                  {l.dates.map((d) => (
                    <span key={d.segmentIndex} className="muted">
                      {' '}
                      · <DateText entry={d} />
                    </span>
                  ))}
                </>,
              ]),
            ]}
          />
        </div>
      ))}

      {message.equipment.map((eq) => (
        <div className="sub-block" key={eq.segmentIndex}>
          <h3>
            📦 Equipment · <Coded value={eq.qualifier} showCode={false} fallback="Equipment" /> <SegLink index={eq.segmentIndex} />
          </h3>
          <KeyValues
            rows={[
              ['Kennung', eq.id && <span className="mono">{eq.id}</span>],
              ['Größe/Typ', eq.sizeType],
              ['Plomben', eq.seals.length > 0 && eq.seals.join(', ')],
              ...eq.measurements.map((m): [ReactNode, ReactNode] => [codeText(m.dimension) || 'Messwert', measurementText(m)]),
            ]}
          />
        </div>
      ))}

      {message.deliveryTerms.map((term) => (
        <div className="sub-block" key={term.segmentIndex}>
          <h3>
            📄 Lieferbedingung <SegLink index={term.segmentIndex} />
          </h3>
          <KeyValues
            rows={[
              ['Bedingung', term.code && <Coded value={term.code} />],
              ['Ort/Text', term.text],
              ...term.locations.map((l): [ReactNode, ReactNode] => [<Coded value={l.qualifier} showCode={false} fallback="Ort" />, l.id ?? l.name]),
            ]}
          />
        </div>
      ))}

      {message.locations.length > 0 && (
        <div className="sub-block">
          <h3>📍 Orte</h3>
          <KeyValues
            rows={message.locations.map((l): [ReactNode, ReactNode] => [
              <Coded value={l.qualifier} showCode={false} fallback="Ort" />,
              [l.id, l.name].filter(Boolean).join(' – '),
            ])}
          />
        </div>
      )}

      {message.notes.length > 0 && (
        <div className="sub-block">
          <h3>💬 Hinweise</h3>
          {message.notes.map((n) => (
            <p key={n.segmentIndex} className="note">
              {n.subject && <span className="muted small">{codeText(n.subject)}: </span>}
              {n.text}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
