import type { DesadvMessage, ParseResult } from '../../parser';
import { codeText } from '../../ui/format';
import { describeCode } from '../../knowledge';
import { SegLink } from '../SegmentLink';

/** Gut sichtbare Anzeige von Nachrichtentyp, Version, Subset und Übertragungsdaten. */
export function VersionBanner({ result, message }: { result: ParseResult; message: DesadvMessage }) {
  const id = message.identifier;
  const type = describeCode('0065', id.type);
  const interchange = result.interchanges.find(
    (x) => x.segmentIndex < message.segmentRange.start && (x.trailerIndex === undefined || x.trailerIndex > message.segmentRange.start),
  );

  return (
    <section className="version-banner">
      <div className="version-main">
        <div className="version-type">
          {id.type || '?'}
          {type?.known && <span className="version-type-label"> · {type.label}</span>}
        </div>
        <div className="version-dir" title={message.version.directoryLabel}>
          {message.version.directory}
        </div>
        <SegLink index={message.segmentRange.start} label="UNH-Segment ansehen" />
        <div className="version-sub">
          {message.version.directoryLabel}
          {id.agency && <> · Organisation {id.agency}</>}
        </div>
        {message.version.subset && (
          <div className="version-subset">
            <span className={`badge ${message.version.subset.known ? 'badge-accent' : 'badge-warn'}`}>Subset {message.version.subset.code}</span>{' '}
            {message.version.subset.known ? (
              <span title={message.version.subset.description}>{message.version.subset.name}</span>
            ) : (
              <span className="muted">nicht in den Erklär-Daten hinterlegt</span>
            )}
          </div>
        )}
        {(id.subsetId || id.implementationGuide) && (
          <div className="version-sub">
            {id.subsetId && <>Nachrichten-Subset (S016): {id.subsetId} </>}
            {id.implementationGuide && <>Richtlinie (S017): {id.implementationGuide}</>}
          </div>
        )}
      </div>

      <dl className="version-meta">
        {interchange ? (
          <>
            <div>
              <dt>Absender</dt>
              <dd>
                {interchange.sender?.id ?? '–'}
                {interchange.sender?.qualifier && <span className="muted small"> ({codeText(interchange.sender.qualifier)})</span>}
              </dd>
            </div>
            <div>
              <dt>Empfänger</dt>
              <dd>
                {interchange.recipient?.id ?? '–'}
                {interchange.recipient?.qualifier && <span className="muted small"> ({codeText(interchange.recipient.qualifier)})</span>}
              </dd>
            </div>
            <div>
              <dt>Übertragung</dt>
              <dd>
                {interchange.preparedAt && !interchange.preparedAt.valid ? (
                  <span title={interchange.preparedAt.error}>
                    <span className="badge badge-err">ungültig</span> <code>{interchange.preparedAt.display}</code>
                  </span>
                ) : (
                  (interchange.preparedAt?.display ?? '–')
                )}{' '}
                · Ref. {interchange.controlRef ?? '–'}
                {interchange.testIndicator && <span className="badge badge-warn">Test</span>}
              </dd>
            </div>
            <div>
              <dt>Zeichensatz</dt>
              <dd>
                {interchange.syntax ? (
                  <span title={codeText(interchange.syntax)}>
                    <code>{interchange.syntax.code}</code>
                    {!interchange.syntax.known && <span className="badge badge-warn">unbekannt</span>}
                  </span>
                ) : (
                  '–'
                )}
                {interchange.syntaxVersion && <span className="muted small"> · Syntax {interchange.syntaxVersion}</span>}
                {interchange.syntax?.known && <div className="muted small">{codeText(interchange.syntax).replace(/^Zeichensatz \w+ /, '')}</div>}
              </dd>
            </div>
          </>
        ) : (
          <div>
            <dt>Übertragung</dt>
            <dd className="muted">ohne UNB-Kopf</dd>
          </div>
        )}
        <div>
          <dt>Nachrichtenreferenz</dt>
          <dd>{message.reference || '–'}</dd>
        </div>
        <div>
          <dt>Trennzeichen</dt>
          <dd>
            <code className="delims">
              {result.delimiters.segment} {result.delimiters.element} {result.delimiters.component} {result.delimiters.release}
            </code>
            <span className="muted small"> {result.hasServiceStringAdvice ? '(aus UNA)' : '(Standard)'}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
