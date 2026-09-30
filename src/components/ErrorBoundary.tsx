import { Component, type ReactNode } from 'react';

interface State {
  error?: Error;
}

/** Fängt unerwartete Anzeigefehler ab, damit nicht die ganze Seite leer bleibt. */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="alert alert-err" role="alert">
        <strong>Die Datei konnte nicht vollständig dargestellt werden.</strong>
        <p>Das ist ein Fehler in DESADViewer, nicht unbedingt in Ihrer Datei. Technische Meldung: {this.state.error.message}</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            this.setState({ error: undefined });
            this.props.onReset();
          }}
        >
          Zurück zur Eingabe
        </button>
      </div>
    );
  }
}
