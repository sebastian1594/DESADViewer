/**
 * Packstruktur als aufklappbarer Baum (z. B. Sendung → Palette → Karton → Artikel).
 */
import { useMemo, useState, type ReactNode } from 'react';
import type { DesadvMessage, Identifier, PackageNode, PackEntry } from '../../parser';
import { codeText, fmtNumber, measurementText, quantityText } from '../../ui/format';
import { Coded } from '../Coded';
import { SegLink } from '../SegmentLink';
import { Card } from './Card';

function collectIds(nodes: PackageNode[], depth = 0, out: { id: number; depth: number }[] = []) {
  for (const n of nodes) {
    out.push({ id: n.segmentIndex, depth });
    collectIds(n.children, depth + 1, out);
  }
  return out;
}

export function PackageTree({ message }: { message: DesadvMessage }) {
  const all = useMemo(() => collectIds(message.packages), [message]);
  // Kleine Bäume ganz aufklappen, große nur die obersten Ebenen.
  const initial = useMemo(() => new Set(all.filter((n) => all.length <= 60 || n.depth < 2).map((n) => n.id)), [all]);
  const [open, setOpen] = useState<Set<number>>(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    // Neue Nachricht gewählt → Aufklappzustand zurücksetzen
    setPrevInitial(initial);
    setOpen(initial);
  }

  const unpacked = message.lineItems.map((item, i) => ({ item, i })).filter(({ item }) => item.packageId === undefined);

  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card
      title="Packstruktur"
      actions={
        all.length > 0 && (
          <>
            <button type="button" className="btn btn-small" onClick={() => setOpen(new Set(all.map((n) => n.id)))}>
              Alle aufklappen
            </button>
            <button type="button" className="btn btn-small" onClick={() => setOpen(new Set())}>
              Alle zuklappen
            </button>
          </>
        )
      }
    >
      {message.packages.length === 0 ? (
        <p className="muted">Die Nachricht enthält keine Packstück-Hierarchie (CPS-Segmente).</p>
      ) : (
        <ul className="tree" role="tree">
          {message.packages.map((node) => (
            <TreeNode key={node.segmentIndex} node={node} message={message} open={open} toggle={toggle} />
          ))}
        </ul>
      )}
      {unpacked.length > 0 && message.packages.length > 0 && (
        <p className="muted small">{unpacked.length} Position(en) sind keinem Packstück zugeordnet.</p>
      )}
    </Card>
  );
}

interface NodeProps {
  node: PackageNode;
  message: DesadvMessage;
  open: Set<number>;
  toggle: (id: number) => void;
}

function packIcon(pack: PackEntry | undefined): string {
  const code = pack?.type?.known ? pack.type.code : undefined;
  if (code === 'PX') return '🟫';
  if (code === 'CT' || code === 'BX' || code === 'CS') return '📦';
  return pack ? '📦' : '🗂️';
}

function nodeTitle(node: PackageNode): string {
  const pack = node.packs[0];
  if (!pack) return node.parentId === undefined ? 'Sendung' : 'Ebene';
  const type = pack.type ? (pack.type.known ? codeText(pack.type) : pack.typeDescription ?? `Packmittel ${pack.type.code}`) : pack.typeDescription ?? 'Packstück';
  return `${pack.count !== undefined ? fmtNumber(pack.count) : pack.rawCount ?? '?'} × ${type}`;
}

function TreeNode({ node, message, open, toggle }: NodeProps) {
  const isOpen = open.has(node.segmentIndex);
  const hasContent = node.children.length > 0 || node.lineItemIndices.length > 0 || node.packs.length > 0 || node.notes.length > 0;
  const sscc = node.packs.flatMap((p) => p.markings.flatMap((m) => m.identifiers)).find((g) => g.qualifier?.code === 'BJ');

  return (
    <li role="treeitem" aria-expanded={hasContent ? isOpen : undefined}>
      <div className="tree-row-wrap">
      <button type="button" className="tree-row" onClick={() => toggle(node.segmentIndex)} disabled={!hasContent}>
        <span className="tree-caret">{hasContent ? (isOpen ? '▾' : '▸') : '·'}</span>
        <span className="tree-icon" aria-hidden="true">
          {packIcon(node.packs[0])}
        </span>
        <span className="tree-title">{nodeTitle(node)}</span>
        <span className="tree-meta">
          Ebene {node.id}
          {node.level && <> · {codeText(node.level)}</>}
          {sscc && <> · SSCC {sscc.ranges[0]?.from}</>}
          {node.lineItemIndices.length > 0 && <> · {node.lineItemIndices.length} Pos.</>}
        </span>
      </button>
      <SegLink index={node.segmentIndex} />
      {node.packs.map((pack) => (
        <SegLink key={pack.segmentIndex} index={pack.segmentIndex} />
      ))}
      </div>

      {isOpen && hasContent && (
        <div className="tree-body">
          {node.packs.map((pack) => (
            <PackDetails key={pack.segmentIndex} pack={pack} />
          ))}
          {node.notes.map((n) => (
            <p key={n.segmentIndex} className="note small">
              {n.text}
            </p>
          ))}
          {node.lineItemIndices.length > 0 && (
            <ul className="tree-items">
              {node.lineItemIndices.map((i) => {
                const item = message.lineItems[i];
                return (
                  <li key={item.segmentIndex}>
                    <span className="tree-icon" aria-hidden="true">
                      🔩
                    </span>
                    <span className="mono">{item.itemNumber ?? '–'}</span>
                    {item.description && <span> {item.description}</span>}
                    <strong className="tree-qty"> {quantityText(item.despatchQuantity)}</strong>
                    {item.batchNumbers.length > 0 && <span className="muted small"> · Charge {item.batchNumbers.join(', ')}</span>}{' '}
                    <SegLink index={item.segmentIndex} />
                  </li>
                );
              })}
            </ul>
          )}
          {node.children.length > 0 && (
            <ul className="tree" role="group">
              {node.children.map((child) => (
                <TreeNode key={child.segmentIndex} node={child} message={message} open={open} toggle={toggle} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function identifierText(g: Identifier): string {
  return g.ranges.map((r) => (r.to ? `${r.from} – ${r.to}` : r.from)).join(', ');
}

function PackDetails({ pack }: { pack: PackEntry }) {
  const facts: ReactNode[] = [];
  if (pack.type && !pack.type.known) facts.push(<Coded key="t" value={pack.type} />);
  if (pack.typeDescription && pack.type?.known) facts.push(<span key="d">{pack.typeDescription}</span>);
  for (const q of pack.quantities) facts.push(<span key={`q${q.segmentIndex}`}>{codeText(q.qualifier) || 'Menge'}: <strong>{quantityText(q)}</strong></span>);
  for (const m of pack.measurements) facts.push(<span key={`m${m.segmentIndex}`}>{codeText(m.dimension) || 'Messwert'}: <strong>{measurementText(m)}</strong></span>);
  for (const r of pack.references) facts.push(<span key={`r${r.segmentIndex}`}>{codeText(r.qualifier) || 'Referenz'}: {r.value}</span>);
  for (const h of pack.handling) facts.push(<span key={`h${h.segmentIndex}`}>Handhabung: {h.text ?? h.code}</span>);
  const markings = pack.markings.filter((m) => m.identifiers.length > 0 || m.marks.length > 0);

  if (facts.length === 0 && markings.length === 0) return null;
  return (
    <div className="pack-details small">
      {facts.length > 0 && <div className="pack-facts">{facts}</div>}
      {markings.map((m) => (
        <div key={m.segmentIndex} className="pack-marking">
          🏷️ {m.instruction ? <Coded value={m.instruction} showCode={false} /> : m.marks.join(' ')}
          {m.identifiers.map((g) => (
            <div key={g.segmentIndex} className="pack-ids">
              <span className="muted">{codeText(g.qualifier) || 'Nummer'}:</span> <span className="mono">{identifierText(g)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
