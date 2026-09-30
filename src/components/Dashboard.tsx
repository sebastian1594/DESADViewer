/**
 * Dashboard: übersichtliche Darstellung einer DESADV-Nachricht.
 * Enthält die Datei mehrere Nachrichten, kann oben umgeschaltet werden.
 */
import type { ParseResult } from '../parser';
import { HeaderCard } from './dashboard/HeaderCard';
import { IssuesCard } from './dashboard/IssuesCard';
import { LineItemsTable } from './dashboard/LineItemsTable';
import { PackageTree } from './dashboard/PackageTree';
import { PartiesCard } from './dashboard/PartiesCard';
import { TotalsCard } from './dashboard/TotalsCard';
import { TransportCard } from './dashboard/TransportCard';
import { VersionBanner } from './dashboard/VersionBanner';

interface Props {
  result: ParseResult;
  messageIndex: number;
  onSelectMessage: (index: number) => void;
}

export function Dashboard({ result, messageIndex, onSelectMessage }: Props) {
  const message = result.messages[messageIndex];
  const issues = result.issues.filter((i) => i.messageIndex === undefined || i.messageIndex === messageIndex);
  const count = (sev: string) => issues.filter((i) => i.severity === sev).length;
  const errors = count('error');
  const warnings = count('warning');

  return (
    <div className="dashboard">
      {result.messages.length > 1 && (
        <nav className="message-tabs" aria-label="Nachricht auswählen">
          <span className="muted small">Die Datei enthält {result.messages.length} Nachrichten:</span>
          {result.messages.map((m, i) => {
            const problems = result.issues.filter((x) => x.messageIndex === i && x.severity !== 'info').length;
            return (
              <button
                type="button"
                key={i}
                className={`message-tab${i === messageIndex ? ' active' : ''}`}
                onClick={() => onSelectMessage(i)}
                aria-current={i === messageIndex}
              >
                {i + 1}. {m.header.documentNumber ?? m.reference} <span className="muted small">({m.version.directory})</span>
                {problems > 0 && <span className="badge badge-warn">{problems}</span>}
              </button>
            );
          })}
        </nav>
      )}

      <VersionBanner result={result} message={message} />

      {(errors > 0 || warnings > 0) && (
        <a href="#pruefergebnis" className={`status-bar ${errors > 0 ? 'status-err' : 'status-warn'}`}>
          {errors > 0 && `${errors} Fehler`}
          {errors > 0 && warnings > 0 && ' · '}
          {warnings > 0 && `${warnings} Warnung${warnings === 1 ? '' : 'en'}`} – Details im Prüfergebnis unten ↓
        </a>
      )}

      <div className="grid-2">
        <HeaderCard message={message} />
        <TotalsCard message={message} />
      </div>
      <PartiesCard message={message} />
      <TransportCard message={message} />
      <PackageTree message={message} />
      <LineItemsTable message={message} />
      <IssuesCard issues={issues} result={result} />
    </div>
  );
}
