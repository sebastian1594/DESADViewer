/**
 * Reiter „Segmente erklärt“: die Rohnachricht Segment für Segment,
 * jedes aufklappbar mit Klartext-Erklärung (Datenelemente, Codes).
 */
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Delimiters, Issue, ParseResult, RawSegment, SegmentPlacement, UnplacedSegment } from '../parser';
import { describeSegment } from '../knowledge';
import { explainSegment, GROUP_LABELS, segmentSummary, type ExplainedComponent } from '../ui/explain';
import { Coded } from './Coded';

const PAGE_SIZE = 300;

export interface SegmentFocus {
  index: number;
  /** Zähler, damit derselbe Sprung erneut ausgelöst werden kann */
  nonce: number;
}

interface Props {
  result: ParseResult;
  focus?: SegmentFocus;
  onBack?: () => void;
}

/** Zusatzinfos je Segment (Nachricht, Version, Lage, Hinweise) */
interface SegmentInfo {
  messageIndex?: number;
  directory?: string;
  placement?: SegmentPlacement;
  issues: Issue[];
  unplaced?: UnplacedSegment['reason'];
  summary?: string;
}

const UNPLACED_TEXT: Record<UnplacedSegment['reason'], string> = {
  'unknown-segment': 'Dieses Segment ist in den Erklär-Daten nicht beschrieben.',
  'unexpected-position': 'Dieses Segment steht an einer Stelle, an der es laut Nachrichtenaufbau nicht erwartet wird. Es wird im Dashboard nicht ausgewertet.',
  'not-evaluated': 'Dieses Segment ist gültig, wird im Dashboard aber (noch) nicht ausgewertet.',
};

const UNPLACED_BADGE: Record<UnplacedSegment['reason'], string> = {
  'unknown-segment': 'unbekannt',
  'unexpected-position': 'unerwartete Stelle',
  'not-evaluated': 'nicht ausgewertet',
};

export function SegmentsView({ result, focus, onBack }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<string>('all');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [pendingScroll, setPendingScroll] = useState<number>();
  const [flash, setFlash] = useState<number>();

  // Infos je Segment einmal vorberechnen
  const infos = useMemo(() => {
    const list: SegmentInfo[] = result.segments.map(() => ({ issues: [] }));
    result.messages.forEach((m, mi) => {
      for (let i = m.segmentRange.start; i <= m.segmentRange.end; i++) {
        list[i].messageIndex = mi;
        list[i].directory = m.version.directory;
        list[i].placement = m.segmentPlacement[i];
      }
      for (const u of m.unplacedSegments) list[u.segmentIndex].unplaced = u.reason;
    });
    for (const issue of result.issues) {
      if (issue.segmentIndex !== undefined && list[issue.segmentIndex]) list[issue.segmentIndex].issues.push(issue);
    }
    result.segments.forEach((s, i) => {
      list[i].summary = segmentSummary(s, list[i].directory);
    });
    return list;
  }, [result]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      result.segments.filter((s, i) => {
        const info = infos[i];
        if (scope === 'outside' && info.messageIndex !== undefined) return false;
        if (scope !== 'all' && scope !== 'outside' && info.messageIndex !== Number(scope)) return false;
        if (onlyIssues && info.issues.length === 0 && !info.unplaced) return false;
        if (needle && !`${s.raw} ${info.summary ?? ''}`.toLowerCase().includes(needle)) return false;
        return true;
      }),
    [result, infos, scope, onlyIssues, needle],
  );
  const visible = filtered.slice(0, limit);

  // Sprung vom Dashboard: Filter lösen, aufklappen, hinscrollen, kurz hervorheben
  useEffect(() => {
    if (!focus) return;
    setQuery('');
    setScope('all');
    setOnlyIssues(false);
    setLimit((l) => Math.max(l, Math.ceil((focus.index + 1) / PAGE_SIZE) * PAGE_SIZE));
    setExpanded((prev) => new Set(prev).add(focus.index));
    setPendingScroll(focus.index);
    setFlash(focus.index);
    const timer = window.setTimeout(() => setFlash(undefined), 2500);
    return () => window.clearTimeout(timer);
  }, [focus]);

  useEffect(() => {
    if (pendingScroll === undefined) return;
    document.getElementById(`seg-${pendingScroll}`)?.scrollIntoView({ block: 'center' });
    setPendingScroll(undefined);
  }, [pendingScroll, visible]);

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const hasOutside = infos.some((i) => i.messageIndex === undefined);
  const d = result.delimiters;

  return (
    <div className="segments-view">
      {onBack && (
        <button type="button" className="btn back-btn" onClick={onBack}>
          ← Zurück zur Übersicht
        </button>
      )}

      <section className="card">
        <h2>Segmente erklärt</h2>
        <p className="muted">
          Hier sehen Sie die Nachricht so, wie sie in der Datei steht – Segment für Segment. Klicken Sie auf ein Segment, um die
          Bedeutung jedes Datenelements zu sehen. Eingerückte Segmente gehören zur darüberstehenden Gruppe.
        </p>
        <div className="legend small">
          So lesen Sie die Rohdaten:
          <span>
            <span className="raw-sep-seg">{d.segment}</span> Ende eines Segments
          </span>
          <span>
            <span className="raw-sep-el">{d.element}</span> trennt Datenelemente
          </span>
          <span>
            <span className="raw-sep-comp">{d.component}</span> trennt Komponenten
          </span>
          <span>
            <span className="raw-esc">{d.release}</span> Escape-Zeichen: nächstes Zeichen gilt als normaler Text
          </span>
          <span className="muted">{result.hasServiceStringAdvice ? '(Zeichen aus dem UNA-Segment)' : '(Standardzeichen)'}</span>
        </div>

        <div className="seg-toolbar">
          <input
            type="search"
            className="search"
            placeholder="Suchen, z. B. NAD oder 4500012345"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            aria-label="Segmente durchsuchen"
          />
          {(result.messages.length > 1 || hasOutside) && (
            <select className="select seg-scope" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Bereich">
              <option value="all">Alle Segmente</option>
              {result.messages.map((m, i) => (
                <option key={i} value={String(i)}>
                  Nachricht {i + 1}: {m.header.documentNumber ?? m.reference}
                </option>
              ))}
              {hasOutside && <option value="outside">Umschlag (UNA/UNB/UNZ …)</option>}
            </select>
          )}
          <label className="check">
            <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Nur Segmente mit Hinweisen
          </label>
          <span className="seg-toolbar-actions">
            <button type="button" className="btn btn-small" onClick={() => setExpanded(new Set(visible.map((s) => s.index)))}>
              Alle aufklappen
            </button>
            <button type="button" className="btn btn-small" onClick={() => setExpanded(new Set())}>
              Alle zuklappen
            </button>
          </span>
        </div>
        <p className="muted small">
          {filtered.length === result.segments.length
            ? `${result.segments.length} Segmente`
            : `${filtered.length} von ${result.segments.length} Segmenten passen zum Filter`}
        </p>

        <ol className="seg-list">
          {visible.map((s) => {
            const info = infos[s.index];
            const message = info.messageIndex !== undefined ? result.messages[info.messageIndex] : undefined;
            const startsMessage = message && message.segmentRange.start === s.index && result.messages.length > 1;
            return (
              <li key={s.index} className="seg-item">
                {startsMessage && (
                  <div className="seg-message-divider">
                    Nachricht {info.messageIndex! + 1} · {message.header.documentNumber ?? message.reference} · {message.version.directory}
                  </div>
                )}
                <SegmentRow
                  seg={s}
                  info={info}
                  delimiters={d}
                  expanded={expanded.has(s.index)}
                  flash={flash === s.index}
                  onToggle={toggle}
                />
              </li>
            );
          })}
        </ol>
        {filtered.length === 0 && <p className="muted">Kein Segment passt zum Filter.</p>}
        {filtered.length > limit && (
          <button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Weitere {Math.min(PAGE_SIZE, filtered.length - limit)} Segmente anzeigen ({filtered.length - limit} verbleibend)
          </button>
        )}
      </section>
    </div>
  );
}

interface RowProps {
  seg: RawSegment;
  info: SegmentInfo;
  delimiters: Delimiters;
  expanded: boolean;
  flash: boolean;
  onToggle: (index: number) => void;
}

const SegmentRow = memo(function SegmentRow({ seg, info, delimiters, expanded, flash, onToggle }: RowProps) {
  const depth = info.placement?.depth ?? 0;
  const worst = info.issues.some((i) => i.severity === 'error') ? 'error' : info.issues.some((i) => i.severity === 'warning') ? 'warning' : info.issues.length > 0 ? 'info' : undefined;
  const name = explainName(seg.tag);

  return (
    <div id={`seg-${seg.index}`} className={`seg-row${expanded ? ' open' : ''}${flash ? ' flash' : ''}`} style={{ marginLeft: `${Math.min(depth, 6) * 18}px` }}>
      <button type="button" className="seg-head" onClick={() => onToggle(seg.index)} aria-expanded={expanded}>
        <span className="seg-caret" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
        <span className={`seg-tag${name ? '' : ' seg-tag-unknown'}`}>{seg.tag}</span>
        <span className="seg-name">
          {name ?? 'unbekanntes Segment'}
          {info.summary && <span className="seg-summary"> · {info.summary}</span>}
        </span>
        <span className="seg-flags">
          {info.unplaced && <span className={`badge ${info.unplaced === 'not-evaluated' ? 'badge-neutral' : 'badge-warn'}`}>{UNPLACED_BADGE[info.unplaced]}</span>}
          {worst && <span className={`badge ${worst === 'error' ? 'badge-err' : worst === 'warning' ? 'badge-warn' : 'badge-info'}`}>{info.issues.length} Hinweis{info.issues.length === 1 ? '' : 'e'}</span>}
          <span className="seg-line">Z. {seg.line}</span>
        </span>
      </button>
      <div className="seg-raw">
        <RawText raw={seg.raw} tag={seg.tag} d={delimiters} />
      </div>
      {expanded && <SegmentDetails seg={seg} info={info} />}
    </div>
  );
});

function explainName(tag: string): string | undefined {
  return describeSegment(tag)?.name;
}

/** Rohtext mit farbigen Trennzeichen */
function RawText({ raw, tag, d }: { raw: string; tag: string; d: Delimiters }) {
  if (tag === 'UNA') return <code>{raw}</code>;
  const parts: ReactNode[] = [];
  let buf = '';
  let key = 0;
  const flush = () => {
    if (buf) parts.push(<span key={key++}>{buf}</span>);
    buf = '';
  };
  const releaseActive = d.release !== ' ';
  let inTag = true;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (releaseActive && ch === d.release && i + 1 < raw.length) {
      flush();
      parts.push(
        <span key={key++} className="raw-esc" title="Escape-Zeichen">
          {ch}
        </span>,
      );
      buf += raw[++i];
      continue;
    }
    const cls = ch === d.segment ? 'raw-sep-seg' : ch === d.element ? 'raw-sep-el' : ch === d.component ? 'raw-sep-comp' : undefined;
    if (cls) {
      if (inTag) {
        parts.push(
          <strong key={key++} className="raw-tag">
            {buf}
          </strong>,
        );
        buf = '';
        inTag = false;
      } else flush();
      parts.push(
        <span key={key++} className={cls}>
          {ch}
        </span>,
      );
    } else buf += ch;
  }
  if (inTag) parts.push(<strong key={key++} className="raw-tag">{buf}</strong>);
  else flush();
  return <code className="raw-text">{parts}</code>;
}

function SegmentDetails({ seg, info }: { seg: RawSegment; info: SegmentInfo }) {
  const explained = useMemo(() => explainSegment(seg, info.directory), [seg, info.directory]);
  const def = explained.def;
  const issues = def ? info.issues : info.issues.filter((i) => i.code !== 'UNKNOWN_SEGMENT');

  return (
    <div className="seg-details">
      {def ? (
        <p>
          <strong>{def.name}</strong> <span className="muted">({def.en})</span> – {def.description}
          {def.note && <span className="muted small"> {def.note}</span>}
        </p>
      ) : (
        <p className="alert alert-warn-soft">
          Das Segment „{seg.tag}“ ist in den Erklär-Daten nicht beschrieben. Die Werte werden unten roh nach ihrer Position gezeigt.
        </p>
      )}

      <p className="muted small">
        Zeile {seg.line} · Segment Nr. {seg.index + 1} in der Datei
        {info.messageIndex !== undefined && <> · Nachricht {info.messageIndex + 1}</>}
        {info.directory && <> · Version {info.directory}</>}
        {info.placement && <> · gehört zu: {GROUP_LABELS[info.placement.group]}</>}
        {info.messageIndex === undefined && <> · Umschlag (außerhalb einer Nachricht)</>}
      </p>

      {/* Bei unbekannten Segmenten sagt der gelbe Kasten oben schon alles – keine Wiederholung */}
      {info.unplaced && info.unplaced !== 'unknown-segment' && <p className="note small">{UNPLACED_TEXT[info.unplaced]}</p>}

      {issues.length > 0 && (
        <ul className="issues seg-issues">
          {issues.map((issue, i) => (
            <li key={i} className={`issue issue-${issue.severity}`}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      {explained.elements.length === 0 ? (
        <p className="muted small">Das Segment enthält keine Datenelemente.</p>
      ) : (
        <div className="table-wrap">
          <table className="seg-table">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Datenelement</th>
                <th>Wert</th>
                <th>Bedeutung</th>
              </tr>
            </thead>
            <tbody>
              {explained.elements.map((el) => {
                const title = (
                  <>
                    {el.def ? (
                      <>
                        <code className="el-id">{el.def.id}</code> {el.def.name}
                      </>
                    ) : (
                      <span className="badge badge-neutral">nicht beschrieben</span>
                    )}
                    {el.def?.note && <div className="muted small">{el.def.note}</div>}
                  </>
                );
                if (el.empty) {
                  return (
                    <tr key={el.position} className="row-empty">
                      <td>{el.position}</td>
                      <td>{title}</td>
                      <td colSpan={2} className="muted small">
                        leer
                      </td>
                    </tr>
                  );
                }
                if (!el.isComposite) {
                  const c = el.components[0];
                  return (
                    <tr key={el.position}>
                      <td>{el.position}</td>
                      <td>{title}</td>
                      <td>
                        <ValueCell value={c.value} />
                      </td>
                      <td>
                        <Meaning c={c} />
                      </td>
                    </tr>
                  );
                }
                return [
                  <tr key={el.position} className="row-composite">
                    <td>{el.position}</td>
                    <td colSpan={3}>{title}</td>
                  </tr>,
                  ...el.components
                    .filter((c) => c.value !== '')
                    .map((c) => (
                      <tr key={`${el.position}.${c.position}`} className="row-component">
                        <td className="muted">
                          {el.position}.{c.position}
                        </td>
                        <td>
                          {c.def ? (
                            <>
                              <code className="el-id">{c.def.id}</code> {c.def.name}
                            </>
                          ) : (
                            <span className="badge badge-neutral">nicht beschrieben</span>
                          )}
                        </td>
                        <td>
                          <ValueCell value={c.value} />
                        </td>
                        <td>
                          <Meaning c={c} />
                        </td>
                      </tr>
                    )),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ValueCell({ value }: { value: string }) {
  if (value === ' ') return <code className="value">(Leerzeichen)</code>;
  return <code className="value">{value}</code>;
}

function Meaning({ c }: { c: ExplainedComponent }) {
  return (
    <>
      {c.coded && <Coded value={c.coded} showCode={false} />}
      {c.hint && <span className={c.hintIsError ? 'hint-error' : 'hint'}>{c.coded ? ' · ' : ''}{c.hint}</span>}
    </>
  );
}
