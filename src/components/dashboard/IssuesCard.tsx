import type { Issue, ParseResult } from '../../parser';
import { SegLink } from '../SegmentLink';
import { Card } from './Card';

const LABELS: Record<Issue['severity'], string> = { error: 'Fehler', warning: 'Warnung', info: 'Hinweis' };
const ICONS: Record<Issue['severity'], string> = { error: '⛔', warning: '⚠️', info: 'ℹ️' };

/** Prüfergebnis: Fehler und Warnungen offen, Hinweise eingeklappt. */
export function IssuesCard({ issues, result }: { issues: Issue[]; result: ParseResult }) {
  const important = issues.filter((i) => i.severity !== 'info');
  const hints = issues.filter((i) => i.severity === 'info');

  return (
    <Card title="Prüfergebnis" id="pruefergebnis">
      {important.length === 0 ? (
        <p className="alert alert-ok">✓ Keine Fehler oder Warnungen. Zählungen und Referenzen im Umschlag stimmen.</p>
      ) : (
        <ul className="issues">
          {important.map((issue, i) => (
            <IssueRow key={i} issue={issue} result={result} />
          ))}
        </ul>
      )}
      {hints.length > 0 && (
        <details className="hints">
          <summary>
            {hints.length} Hinweis{hints.length === 1 ? '' : 'e'} anzeigen (z. B. Codes, die nicht in den Erklär-Daten stehen)
          </summary>
          <ul className="issues">
            {hints.map((issue, i) => (
              <IssueRow key={i} issue={issue} result={result} />
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function IssueRow({ issue, result }: { issue: Issue; result: ParseResult }) {
  const seg = issue.segmentIndex !== undefined ? result.segments[issue.segmentIndex] : undefined;
  return (
    <li className={`issue issue-${issue.severity}`}>
      <span className="issue-icon" aria-hidden="true">
        {ICONS[issue.severity]}
      </span>
      <div>
        <span className="issue-label">{LABELS[issue.severity]}:</span> {issue.message}
        {seg && (
          <div className="issue-seg small">
            Zeile {seg.line}: <code>{seg.raw.length > 90 ? `${seg.raw.slice(0, 90)} …` : seg.raw}</code>{' '}
            <SegLink index={seg.index} label="Segment erklärt" />
          </div>
        )}
      </div>
    </li>
  );
}
