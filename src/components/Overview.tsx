/**
 * Schlanke Übersicht (Standardansicht): eine Karte wie ein Lieferschein.
 * Von / An / Spedition, Termin, Bestellung, Positionen, Verpackung – sonst nichts.
 * Alles Weitere über die Links „Alle Details“ und „Segmente erklärt“ unter der Karte.
 */
import { useState } from 'react';
import type { DesadvMessage, PackageNode, Party, ParseResult } from '../parser';
import { packageCountsText, packTypeText, roleParty } from '../export/tables';
import { collectDateRows } from '../ui/dateRows';
import { fmtNumber, measurementText, partyTitle, quantityText, unitText } from '../ui/format';

interface Props {
  result: ParseResult;
  messageIndex: number;
  onSelectMessage: (index: number) => void;
  onShowDetails: () => void;
  onShowSegments: () => void;
}

/** „Firma, Ort“ */
function partyLine(p: Party | undefined): string | undefined {
  if (!p) return undefined;
  return [partyTitle(p), p.city].filter(Boolean).join(', ');
}

export function Overview({ result, messageIndex, onSelectMessage, onShowDetails, onShowSegments }: Props) {
  const [showProblems, setShowProblems] = useState(false);
  const m = result.messages[messageIndex];
  const s = m.summary;
  const problems = result.issues.filter((i) => i.severity !== 'info' && (i.messageIndex === undefined || i.messageIndex === messageIndex));

  const transportCarrier = m.transports.find((t) => t.carrierName || t.carrierId);
  /** [Beschriftung, Wert, optional Code-Hinweis wie „DTM 124“] */
  const rows: [string, string | undefined, string?][] = [
    ['Von', partyLine(roleParty(m, 'supplier'))],
    ['An', partyLine(roleParty(m, 'shipTo') ?? roleParty(m, 'buyer'))],
    ['Spedition', partyLine(roleParty(m, 'carrier')) ?? transportCarrier?.carrierName ?? transportCarrier?.carrierId],
    // Alle Datumsangaben der Nachricht, egal wo sie stehen
    ...collectDateRows(m).map((d): [string, string, string] => [d.label, d.values.join(', '), `DTM ${d.code ?? '?'}`]),
  ];

  return (
    <div className="overview">
      {result.messages.length > 1 && (
        <nav className="message-tabs" aria-label="Lieferavis auswählen">
          {result.messages.map((msg, i) => (
            <button
              type="button"
              key={i}
              className={`message-tab${i === messageIndex ? ' active' : ''}`}
              onClick={() => onSelectMessage(i)}
              aria-current={i === messageIndex}
            >
              {msg.header.documentNumber ?? `Lieferavis ${i + 1}`}
            </button>
          ))}
        </nav>
      )}

      <article className="ls-card">
        {/* ── Kopf ── */}
        <header className="ls-head">
          <div>
            <div className="ls-label">Lieferschein</div>
            <div className="ls-number">{s.documentNumber ?? '–'}</div>
          </div>
          <div className="ls-head-right">
            {problems.length === 0 ? (
              <div className="ls-ok">✓ Datei in Ordnung</div>
            ) : (
              <button type="button" className="ls-warn" onClick={() => setShowProblems(!showProblems)} aria-expanded={showProblems}>
                ⚠ {problems.length} Auffälligkeit{problems.length === 1 ? '' : 'en'}
              </button>
            )}
          </div>
        </header>
        {showProblems && problems.length > 0 && (
          <ul className="ls-problems">
            {problems.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
        )}

        {/* ── Von / An / Spedition / alle Datumsangaben ── */}
        <dl className="ls-rows">
          {rows
            .filter(([, v]) => v)
            .map(([k, v, hint]) => (
              <div key={`${k}|${hint ?? ''}`}>
                <dt>
                  {k}
                  {hint && <span className="ls-code"> {hint}</span>}
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>

        {/* ── Positionen ── */}
        {m.lineItems.length > 0 && (
          <div className="table-wrap">
            <table className="ls-table">
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Material</th>
                  <th>Bezeichnung</th>
                  <th className="num">Menge</th>
                  <th>Bestellung</th>
                </tr>
              </thead>
              <tbody>
                {m.lineItems.map((item) => {
                  const q = item.despatchQuantity;
                  return (
                    <tr key={item.segmentIndex}>
                      <td className="ls-pos">{item.lineNumber ?? '–'}</td>
                      <td className="ls-mat mono">{item.materialNumber?.value ?? '–'}</td>
                      <td className="ls-desc">{item.description ?? '–'}</td>
                      <td className="ls-qty num">
                        {q ? (q.value !== undefined ? fmtNumber(q.value) : `${q.rawValue || '?'} (ungültig)`) : '–'} {unitText(q?.unit)}
                      </td>
                      <td className="ls-order">
                        <span className="ls-order-label">Bestellung </span>
                        <strong className="mono">{item.orderNumber?.value ?? '–'}</strong>
                        {item.orderNumber?.line && <span className="muted"> / Pos. {item.orderNumber.line}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Verpackung ── */}
        <Packaging message={m} />
      </article>

      <p className="view-links">
        <button type="button" className="link-btn" onClick={onShowDetails}>
          Alle Details
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" className="link-btn" onClick={onShowSegments}>
          Segmente erklärt
        </button>
        <span className="muted">· EDIFACT {m.version.directory}</span>
      </p>
    </div>
  );
}

function Packaging({ message }: { message: DesadvMessage }) {
  const [open, setOpen] = useState(false);
  const s = message.summary;
  const parts = [s.packageCounts.length > 0 ? packageCountsText(message) : undefined, s.grossWeight && measurementText(s.grossWeight)].filter(Boolean);
  // Oberste Ebene ohne eigenes Packmittel (= „Sendung“) überspringen
  const roots = message.packages.flatMap((n) => (n.packs.length === 0 && n.lineItemIndices.length === 0 ? n.children : [n]));
  // Ohne Packmittel- oder Gewichtsangaben keine (leere) Verpackungszeile anzeigen
  if (parts.length === 0) return null;

  return (
    <div className="ls-pack">
      <div className="ls-pack-line">
        <span>
          <span className="ls-pack-label">Verpackung</span> {parts.join(' · ')}
        </span>
        {roots.length > 0 && (
          <button type="button" className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'Weniger ▴' : 'Mehr anzeigen ▾'}
          </button>
        )}
      </div>
      {open && (
        <ul className="ov-tree">
          {roots.map((n) => (
            <PackNode key={n.segmentIndex} node={n} message={message} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PackNode({ node, message }: { node: PackageNode; message: DesadvMessage }) {
  const sscc = node.packs
    .flatMap((p) => p.markings.flatMap((mk) => mk.identifiers))
    .find((g) => g.qualifier?.code === 'BJ')
    ?.ranges[0]?.from;
  const label = node.packs.length > 0 ? node.packs.map((p) => `${p.count !== undefined ? fmtNumber(p.count) : '?'} × ${packTypeText(p)}`).join(', ') : 'Packstück';

  return (
    <li>
      <span className="ov-tree-label">{label}</span>
      {sscc && <span className="muted small"> · SSCC {sscc}</span>}
      {(node.lineItemIndices.length > 0 || node.children.length > 0) && (
        <ul>
          {node.lineItemIndices.map((i) => {
            const item = message.lineItems[i];
            return (
              <li key={item.segmentIndex} className="ov-tree-item">
                Pos. {item.lineNumber} · {item.description ?? item.materialNumber?.value ?? ''} · {quantityText(item.despatchQuantity)}
              </li>
            );
          })}
          {node.children.map((c) => (
            <PackNode key={c.segmentIndex} node={c} message={message} />
          ))}
        </ul>
      )}
    </li>
  );
}
