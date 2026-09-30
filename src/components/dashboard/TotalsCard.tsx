import type { DesadvMessage } from '../../parser';
import { SUMMARY_RULES } from '../../knowledge';
import { codeText, fmtNumber, measurementText, unitText } from '../../ui/format';
import { Coded } from '../Coded';
import { SegLink } from '../SegmentLink';
import { Card } from './Card';

export function TotalsCard({ message }: { message: DesadvMessage }) {
  const s = message.summary;
  const lineControl = message.controlTotals.find((c) => c.qualifier && SUMMARY_RULES.lineCountControl.includes(c.qualifier.code));
  const lineCountOk = !lineControl || lineControl.value === s.lineItemCount;
  const otherMeasurements = message.measurements.filter((m) => m !== s.grossWeight && m !== s.netWeight);
  const packageTotal = s.packageCounts.reduce((sum, p) => sum + p.count, 0);

  return (
    <Card title="Gewichte und Summen">
      <div className="stats">
        <div className="stat">
          <span className="stat-label">Positionen</span>
          <span className="stat-value">{s.lineItemCount}</span>
          {lineControl && (
            <span className={`stat-note ${lineCountOk ? 'ok' : 'warn'}`}>
              {lineCountOk ? '✓ stimmt mit CNT überein' : `⚠ CNT meldet ${lineControl.rawValue}`}
            </span>
          )}
        </div>
        <div className="stat">
          <span className="stat-label">Packstücke</span>
          <span className="stat-value">{packageTotal > 0 ? fmtNumber(packageTotal) : '–'}</span>
          <span className={`stat-note${s.packageCounts.some((p) => p.invalidCount) ? ' warn' : ''}`}>
            {s.packageCounts.some((p) => p.invalidCount) ? '⚠ nicht alle Anzahlen lesbar' : 'laut PAC-Segmenten'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Bruttogewicht</span>
          <span className="stat-value">{s.grossWeight ? measurementText(s.grossWeight) : '–'}</span>
          <SegLink index={s.grossWeight?.segmentIndex} />
        </div>
        <div className="stat">
          <span className="stat-label">Nettogewicht</span>
          <span className="stat-value">{s.netWeight ? measurementText(s.netWeight) : '–'}</span>
          <SegLink index={s.netWeight?.segmentIndex} />
        </div>
      </div>

      {s.packageCounts.length > 0 && (
        <>
          <h3>Packstücke nach Art</h3>
          <ul className="plain-list">
            {s.packageCounts.map((p, i) => (
              <li key={i}>
                <strong>{p.invalidCount && p.count === 0 ? '?' : fmtNumber(p.count)} ×</strong> {p.type ? <Coded value={p.type} /> : null}
                {p.description && <span className="muted"> {p.description}</span>}
                {p.invalidCount && <span className="badge badge-warn">Anzahl teilweise ungültig</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {s.quantityTotals.length > 0 && (
        <>
          <h3>Liefermenge gesamt</h3>
          <ul className="plain-list">
            {s.quantityTotals.map((t, i) => (
              <li key={i}>
                <strong>{fmtNumber(t.total)}</strong> {unitText(t.unit) || <span className="muted">(ohne Einheit)</span>}
              </li>
            ))}
          </ul>
          {s.quantityTotals.length > 1 && <p className="muted small">Mengen mit unterschiedlichen Einheiten werden getrennt summiert.</p>}
        </>
      )}

      {(otherMeasurements.length > 0 || message.controlTotals.length > 0) && (
        <>
          <h3>Weitere Angaben</h3>
          <ul className="plain-list">
            {otherMeasurements.map((m) => (
              <li key={m.segmentIndex}>
                {codeText(m.dimension) || 'Messwert'}: <strong>{measurementText(m)}</strong> <SegLink index={m.segmentIndex} />
              </li>
            ))}
            {message.controlTotals.map((c) => (
              <li key={c.segmentIndex}>
                Kontrollsumme <Coded value={c.qualifier} showCode={false} />: <strong>{c.rawValue}</strong> {unitText(c.unit)} <SegLink index={c.segmentIndex} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
