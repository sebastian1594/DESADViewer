/**
 * Ein Knopf „Exportieren ▾“ mit Auswahlmenü (PDF, Excel, CSV, JSON, XML).
 * Alles wird im Browser erzeugt – nichts wird hochgeladen.
 */
import { useEffect, useRef, useState } from 'react';
import { createExport, downloadFile, EXPORT_FORMATS, type ExportFormat } from '../export';
import type { ParseResult } from '../parser';

interface Props {
  result: ParseResult;
  messageIndex: number;
  source: string;
}

export function ExportBar({ result, messageIndex, source }: Props) {
  const [busy, setBusy] = useState<ExportFormat>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const menu = useRef<HTMLDetailsElement>(null);
  const multi = result.messages.length > 1;

  // Menü schließen bei Klick daneben oder Escape-Taste
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      const el = menu.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  async function run(format: ExportFormat) {
    if (menu.current) menu.current.open = false;
    setBusy(format);
    setMessage(undefined);
    try {
      const file = await createExport(format, result, messageIndex, { source, exportedAt: new Date() });
      downloadFile(file);
      setMessage({ ok: true, text: `„${file.filename}“ gespeichert (Download-Ordner)` });
    } catch (e) {
      setMessage({ ok: false, text: `Export fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="export">
      <details className="export-menu" ref={menu}>
        <summary className="btn">{busy ? 'Erstelle …' : 'Exportieren ▾'}</summary>
        <div className="export-list" role="menu">
          {EXPORT_FORMATS.map((f) => (
            <button key={f.format} type="button" role="menuitem" className="export-item" disabled={busy !== undefined} onClick={() => void run(f.format)}>
              <strong>{f.label}</strong>
              <span className="muted small">
                {f.description}
                {multi && (f.wholeFile ? ' (alle Lieferavise)' : ` (nur Lieferavis ${messageIndex + 1})`)}
              </span>
            </button>
          ))}
        </div>
      </details>
      {message && (
        <span className={`small ${message.ok ? 'export-done' : 'export-error'}`} role="status">
          {message.ok ? '✓ ' : ''}
          {message.text}
        </span>
      )}
    </div>
  );
}
