import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExportBar } from './components/ExportBar';
import { InputPanel, type LoadedInput } from './components/InputPanel';
import { Overview } from './components/Overview';
import { SegmentNavProvider } from './components/SegmentLink';
import { SegmentsView, type SegmentFocus } from './components/SegmentsView';
import { parseEdifact, type ParseResult } from './parser';

interface Loaded extends LoadedInput {
  result: ParseResult;
  /** Zähler je eingelesener Datei – setzt Ansichten beim Neuladen zurück */
  id: number;
}

/**
 * overview = schlanker Lieferschein (Standard)
 * details  = alle Angaben mit Codes und Sprung-Knöpfen (für Fachleute)
 * segments = „Segmente erklärt“ (Rohdaten zum Lernen)
 */
type View = 'overview' | 'details' | 'segments';

const VIEW_NAMES: Record<View, string> = { overview: 'Übersicht', details: 'Details', segments: 'Segmente erklärt' };

export default function App() {
  const [loaded, setLoaded] = useState<Loaded>();
  const [failed, setFailed] = useState<Loaded>();
  const [messageIndex, setMessageIndex] = useState(0);
  const [view, setView] = useState<View>('overview');
  /** Ansicht, aus der „Segmente erklärt“ geöffnet wurde (für „Zurück“) */
  const [cameFrom, setCameFrom] = useState<View>('overview');
  const [focus, setFocus] = useState<SegmentFocus>();
  /** Scrollposition vor einem Sprung zum Segment (für „Zurück“) */
  const returnScroll = useRef(0);
  const pendingScroll = useRef<number | undefined>(undefined);
  const loadCounter = useRef(0);

  function handleLoad(input: LoadedInput) {
    const result = parseEdifact(input.text);
    const entry = { ...input, result, id: ++loadCounter.current };
    if (result.messages.length === 0) {
      // Nichts Darstellbares gefunden → bei der Eingabe bleiben und Fehler zeigen
      setFailed(entry);
      setLoaded(undefined);
      return;
    }
    setFailed(undefined);
    setLoaded(entry);
    setMessageIndex(0);
    setView('overview');
    setFocus(undefined);
    window.scrollTo({ top: 0 });
  }

  function reset() {
    setLoaded(undefined);
    setFailed(undefined);
  }

  function goTo(next: View) {
    if (next === 'segments') {
      setCameFrom(view);
      returnScroll.current = window.scrollY;
    }
    pendingScroll.current = 0;
    setView(next);
  }

  function goBack() {
    pendingScroll.current = returnScroll.current;
    setView(cameFrom);
  }

  const nav = useMemo(
    () => ({
      segments: loaded?.result.segments ?? [],
      showSegment: (index: number) => {
        returnScroll.current = window.scrollY;
        setCameFrom('details');
        setView('segments');
        setFocus((prev) => ({ index, nonce: (prev?.nonce ?? 0) + 1 }));
      },
    }),
    [loaded],
  );

  // Nach einem Ansichtswechsel die gewünschte Scrollposition herstellen
  useLayoutEffect(() => {
    if (pendingScroll.current === undefined) return;
    window.scrollTo({ top: pendingScroll.current });
    pendingScroll.current = undefined;
  }, [view]);

  const problem = failed && (
    <>
      <strong>„{failed.name}“ konnte nicht als DESADV gelesen werden.</strong>
      <ul>
        {failed.result.issues
          .filter((i) => i.severity === 'error')
          .slice(0, 5)
          .map((i, n) => (
            <li key={n}>{i.message}</li>
          ))}
      </ul>
    </>
  );

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <button type="button" className="brand" onClick={reset} title="Zur Startseite">
            <span className="brand-mark">DESADV</span>iewer
          </button>
          <span className="privacy" title="Die Datei wird nur in Ihrem Browser verarbeitet. Nichts wird hochgeladen.">
            🔒 Alles bleibt lokal
          </span>
        </div>
      </header>

      <main className="page">
        {!loaded ? (
          <>
            <div className="intro">
              <h1>Lieferavise lesbar machen</h1>
              <p className="lead">
                DESADViewer zeigt EDIFACT-DESADV-Nachrichten (digitale Lieferscheine/Lieferavise) übersichtlich an – für jede
                Version, von D.93A bis D.20B.
              </p>
            </div>
            <InputPanel onLoad={handleLoad} problem={problem} />
          </>
        ) : (
          <>
            <div className="file-bar">
              <div className="file-name muted">{loaded.name.replace(/^Beispiel:\s*/, '')}</div>
              <div className="file-actions">
                <ExportBar result={loaded.result} messageIndex={messageIndex} source={loaded.name} />
                <button type="button" className="btn" onClick={reset}>
                  Neue Datei
                </button>
              </div>
            </div>

            {view !== 'overview' && (
              <button type="button" className="btn back-btn" onClick={view === 'segments' ? goBack : () => goTo('overview')}>
                ← Zurück {view === 'segments' ? `zu: ${VIEW_NAMES[cameFrom]}` : 'zur Übersicht'}
              </button>
            )}

            <ErrorBoundary onReset={reset}>
              <SegmentNavProvider value={nav}>
                <div hidden={view !== 'overview'}>
                  <Overview
                    key={loaded.id}
                    result={loaded.result}
                    messageIndex={messageIndex}
                    onSelectMessage={setMessageIndex}
                    onShowDetails={() => goTo('details')}
                    onShowSegments={() => goTo('segments')}
                  />
                </div>
                <div hidden={view !== 'details'}>
                  <Dashboard key={loaded.id} result={loaded.result} messageIndex={messageIndex} onSelectMessage={setMessageIndex} />
                  <p className="view-links">
                    <button type="button" className="link-btn" onClick={() => goTo('segments')}>
                      Segmente erklärt ansehen
                    </button>
                  </p>
                </div>
                <div hidden={view !== 'segments'}>
                  <SegmentsView key={loaded.id} result={loaded.result} focus={focus} />
                </div>
              </SegmentNavProvider>
            </ErrorBoundary>
          </>
        )}
      </main>

      <footer className="app-footer muted small">
        DESADViewer · Verarbeitung ausschließlich im Browser · keine Uploads, keine Analytics
      </footer>
    </>
  );
}
