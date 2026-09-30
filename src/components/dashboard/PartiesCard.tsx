import type { DesadvMessage, Party } from '../../parser';
import { addressLines, codeText, partyTitle } from '../../ui/format';
import { Coded } from '../Coded';
import { SegLink } from '../SegmentLink';
import { Card } from './Card';

const ROLE_TITLES: [keyof DesadvMessage['summary']['roles'], string][] = [
  ['supplier', 'Lieferant'],
  ['buyer', 'Käufer'],
  ['shipTo', 'Lieferadresse'],
  ['carrier', 'Spediteur'],
];

export function PartiesCard({ message }: { message: DesadvMessage }) {
  const roles = message.summary.roles;
  const roleIndices = new Set(Object.values(roles).filter((i): i is number => i !== undefined));
  const others = message.parties.filter((_, i) => !roleIndices.has(i));

  return (
    <Card title="Beteiligte">
      <div className="party-grid">
        {ROLE_TITLES.map(([role, title]) => {
          const index = roles[role];
          return index === undefined ? (
            <div className="party party-missing" key={role}>
              <div className="party-role">{title}</div>
              <p className="muted small">nicht angegeben</p>
            </div>
          ) : (
            <PartyView key={role} party={message.parties[index]} title={title} />
          );
        })}
        {others.map((p) => (
          <PartyView key={p.segmentIndex} party={p} />
        ))}
      </div>
    </Card>
  );
}

function PartyView({ party, title }: { party: Party; title?: string }) {
  return (
    <div className="party">
      <div className="party-role">
        {title ? (
          <>
            {title}
            {party.qualifier && (
              <span className="party-qualifier" title={codeText(party.qualifier)}>
                <code className="raw">NAD {party.qualifier.code}</code>
              </span>
            )}
          </>
        ) : (
          <Coded value={party.qualifier} fallback="Beteiligter" />
        )}
      </div>
      <div className="party-name">
        {partyTitle(party)} <SegLink index={party.segmentIndex} />
      </div>
      {addressLines(party).map((line, i) => (
        <div key={i}>{line}</div>
      ))}
      {party.id && (
        <div className="muted small party-id">
          Kennung: <span className="mono">{party.id}</span>
          {party.idAgency && <> ({codeText(party.idAgency)})</>}
        </div>
      )}
      {party.locations.map((loc) => (
        <div key={loc.segmentIndex} className="small">
          <Coded value={loc.qualifier} showCode={false} fallback="Ort" />: <strong>{loc.id ?? loc.name}</strong>
          {loc.id && loc.name && <> – {loc.name}</>}
        </div>
      ))}
      {party.references.map((ref) => (
        <div key={ref.segmentIndex} className="small">
          <Coded value={ref.qualifier} showCode={false} fallback="Referenz" />: {ref.value}
        </div>
      ))}
      {party.contacts.map((c) => (
        <div key={c.segmentIndex} className="party-contact small">
          <div>
            👤 {c.name ?? c.departmentCode ?? 'Kontakt'}
            {c.function && <span className="muted"> · {codeText(c.function)}</span>}
          </div>
          {c.communications.map((com) => (
            <div key={com.segmentIndex}>
              <span className="muted">{codeText(com.channel) || 'Kontakt'}:</span> {com.number}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
