import { useMemo, useState } from 'react';
import type { DesadvMessage, LineItem } from '../../parser';
import { codeText, fmtNumber, unitText } from '../../ui/format';
import { Coded } from '../Coded';
import { SegLink } from '../SegmentLink';
import { Card } from './Card';

function searchText(item: LineItem): string {
  return [
    item.lineNumber,
    item.itemNumber,
    item.description,
    ...item.additionalIds.map((a) => a.id),
    ...item.batchNumbers,
    item.materialNumber?.value,
    item.orderNumber?.value,
    item.orderReference?.number,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function LineItemsTable({ message }: { message: DesadvMessage }) {
  const [filter, setFilter] = useState('');
  const items = message.lineItems;
  const index = useMemo(() => items.map(searchText), [items]);
  const needle = filter.trim().toLowerCase();
  const visible = items.filter((_, i) => !needle || index[i].includes(needle));

  return (
    <Card
      title={`Positionen (${items.length})`}
      actions={
        items.length > 5 && (
          <input
            type="search"
            className="search"
            placeholder="Suchen (Artikel, Charge …)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Positionen durchsuchen"
          />
        )
      }
    >
      {items.length === 0 ? (
        <p className="muted">Die Nachricht enthält keine Positionen (LIN-Segmente).</p>
      ) : (
        <div className="table-wrap">
          <table className="items">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Materialnr.</th>
                <th>Bezeichnung</th>
                <th className="num">Menge</th>
                <th>Einheit</th>
                <th>Charge</th>
                <th>Bestellnr.</th>
                <th>Packstück</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <ItemRow key={item.segmentIndex} item={item} />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    Keine Position passt zur Suche „{filter}“.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ItemRow({ item }: { item: LineItem }) {
  const q = item.despatchQuantity;
  const otherQuantities = item.quantities.filter((x) => x !== q);

  return (
    <tr>
      <td>
        {item.lineNumber ?? '–'}
        <div>
          <SegLink index={item.segmentIndex} />
        </div>
        {item.parentLineNumber && <div className="muted small">zu Pos. {item.parentLineNumber}</div>}
      </td>
      <td>
        {item.materialNumber ? (
          <>
            <div>
              <strong className="mono">{item.materialNumber.value}</strong> <SegLink index={item.materialNumber.segmentIndex} />
            </div>
            <div className="small found-in" title="Materialnr. = Artikelnummer des Käufers (IN/BP), sonst Hauptnummer aus LIN">
              gefunden in {item.materialNumber.source}
            </div>
          </>
        ) : (
          <span className="muted">–</span>
        )}
        {[
          ...(item.itemNumber && item.itemNumber !== item.materialNumber?.value ? [{ id: item.itemNumber, type: item.itemNumberType, tag: 'LIN' }] : []),
          ...item.additionalIds.filter((a) => a.id !== item.materialNumber?.value).map((a) => ({ id: a.id, type: a.type, tag: 'PIA' })),
        ].map((n, i) => (
          <div key={i} className="small">
            <span className="muted">
              {n.tag} · {codeText(n.type) || 'Nr.'}:
            </span>{' '}
            <span className="mono">{n.id}</span>
          </div>
        ))}
      </td>
      <td>
        {item.description ?? <span className="muted">–</span>}
        {item.descriptions.slice(1).map((d) => (
          <div key={d.segmentIndex} className="small muted">
            {d.text}
          </div>
        ))}
        {item.countryOfOrigin && (
          <div className="small muted">
            Ursprung: <Coded value={item.countryOfOrigin} showCode={false} />
          </div>
        )}
        {item.notes.map((n) => (
          <div key={n.segmentIndex} className="small note">
            {n.text}
          </div>
        ))}
      </td>
      <td className="num">
        {q ? (
          q.value !== undefined ? (
            <strong>{fmtNumber(q.value)}</strong>
          ) : (
            <span className="badge badge-err" title="Keine gültige Zahl">
              {q.rawValue || 'fehlt'}
            </span>
          )
        ) : (
          <span className="muted">–</span>
        )}
        {q && q.qualifier?.code !== '12' && <div className="small muted">{codeText(q.qualifier)}</div>}
        {otherQuantities.map((x) => (
          <div key={x.segmentIndex} className="small muted">
            {codeText(x.qualifier)}: {x.value !== undefined ? fmtNumber(x.value) : x.rawValue} {unitText(x.unit)}
          </div>
        ))}
      </td>
      <td>{q?.unit ? <Coded value={q.unit} showCode={false} /> : <span className="muted">–</span>}</td>
      <td>{item.batchNumbers.length > 0 ? <span className="mono">{item.batchNumbers.join(', ')}</span> : <span className="muted">–</span>}</td>
      <td>
        {item.orderNumber ? (
          <>
            <span className="mono">{item.orderNumber.value}</span>
            {item.orderNumber.line && <span className="muted"> / {item.orderNumber.line}</span>} <SegLink index={item.orderNumber.segmentIndex} />
            <div className="small found-in">gefunden in {item.orderNumber.source}</div>
          </>
        ) : (
          <span className="muted">–</span>
        )}
      </td>
      <td>{item.packageId ?? <span className="muted">–</span>}</td>
    </tr>
  );
}
