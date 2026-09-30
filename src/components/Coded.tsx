/**
 * Anzeige von Codes und Datumswerten mit Klartext.
 * Unbekannte Codes werden deutlich als „unbekannter Code“ gekennzeichnet.
 */
import type { CodedValue, DateEntry } from '../parser';

interface CodedProps {
  value: CodedValue | undefined;
  /** Rohcode zusätzlich klein anzeigen (Standard: ja) */
  showCode?: boolean;
  fallback?: string;
}

export function Coded({ value, showCode = true, fallback = '–' }: CodedProps) {
  if (!value) return <span className="muted">{fallback}</span>;

  if (!value.known) {
    const partner = Boolean(value.note);
    return (
      <span
        className="coded"
        title={value.note ?? `Code „${value.code}“ (Datenelement ${value.list}) ist in den Erklär-Daten nicht hinterlegt.`}
      >
        <span className={`badge ${partner ? 'badge-neutral' : 'badge-warn'}`}>{partner ? 'Partner-Code' : 'unbekannter Code'}</span>{' '}
        <code className="raw">{value.code}</code>
      </span>
    );
  }

  const tooltip = [value.en && `Original: ${value.en}`, value.description, value.versionNote].filter(Boolean).join('\n');
  return (
    <span className="coded" title={tooltip || undefined}>
      {value.label}
      {showCode && <code className="raw">{value.code}</code>}
      {value.versionNote && <span className="badge badge-info">Version prüfen</span>}
    </span>
  );
}

export function DateText({ entry }: { entry: DateEntry | undefined }) {
  if (!entry) return <span className="muted">–</span>;
  const f = entry.formatted;
  if (!f.valid) {
    return (
      <span className="date-invalid" title={f.error}>
        <span className="badge badge-err">ungültig</span> <code className="raw">{entry.value}</code>
      </span>
    );
  }
  if (!f.recognized) {
    return (
      <span title={f.error}>
        <code>{entry.value}</code> <span className="badge badge-neutral">Rohwert</span>
      </span>
    );
  }
  return <span title={`Rohwert ${entry.value}, Format ${entry.format?.code ?? '?'}`}>{f.display}</span>;
}
