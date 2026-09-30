import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  id?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, id, actions, className, children }: Props) {
  return (
    <section className={`card${className ? ` ${className}` : ''}`} id={id}>
      <div className="card-head">
        <h2>{title}</h2>
        {actions && <div className="card-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Zweispaltige Liste „Bezeichnung: Wert“; leere Werte werden ausgelassen. */
export function KeyValues({ rows }: { rows: [ReactNode, ReactNode | undefined | null | false][] }) {
  const visible = rows.filter(([, v]) => v !== undefined && v !== null && v !== false && v !== '');
  if (visible.length === 0) return <p className="muted">Keine Angaben.</p>;
  return (
    <dl className="kv">
      {visible.map(([k, v], i) => (
        <div className="kv-row" key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
