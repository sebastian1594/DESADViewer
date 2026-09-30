/**
 * Sprung vom Dashboard zum erklärten Segment.
 * Die App stellt über den Context die Funktion `showSegment` bereit;
 * jede Karte kann dann einfach <SegLink index={…} /> verwenden.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { RawSegment } from '../parser';

interface SegmentNav {
  segments: RawSegment[];
  showSegment: (index: number) => void;
}

const SegmentNavContext = createContext<SegmentNav | null>(null);

export function SegmentNavProvider({ value, children }: { value: SegmentNav; children: ReactNode }) {
  return <SegmentNavContext.Provider value={value}>{children}</SegmentNavContext.Provider>;
}

interface Props {
  index: number | undefined;
  /** Eigene Beschriftung statt des Segmentkennzeichens */
  label?: string;
}

export function SegLink({ index, label }: Props) {
  const nav = useContext(SegmentNavContext);
  if (!nav || index === undefined) return null;
  const seg = nav.segments[index];
  if (!seg) return null;
  return (
    <button
      type="button"
      className="seglink"
      onClick={(e) => {
        e.stopPropagation();
        nav.showSegment(index);
      }}
      title={`Segment ${seg.tag} (Zeile ${seg.line}) im Reiter „Segmente erklärt“ anzeigen`}
    >
      {label ?? seg.tag} ›
    </button>
  );
}
