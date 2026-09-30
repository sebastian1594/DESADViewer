/**
 * Eingabe: Drag & Drop, Dateiauswahl, Text einfügen oder Beispiel laden.
 * Die Datei wird nur lokal im Browser gelesen – nichts wird hochgeladen.
 */
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { SAMPLES } from '../samples';
import { decodeBytes } from '../ui/decode';

export interface LoadedInput {
  name: string;
  text: string;
  encoding?: string;
}

interface Props {
  onLoad: (input: LoadedInput) => void;
  /** Fehlermeldungen aus dem letzten Einleseversuch */
  problem?: ReactNode;
}

const MAX_SIZE = 50 * 1024 * 1024;

export function InputPanel({ onLoad, problem }: Props) {
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState('');
  const [sampleFile, setSampleFile] = useState(SAMPLES[0].file);
  const [readError, setReadError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  async function readFile(file: File) {
    setReadError(undefined);
    if (file.size === 0) {
      setReadError(`Die Datei „${file.name}“ ist leer.`);
      return;
    }
    if (file.size > MAX_SIZE) {
      setReadError(`Die Datei „${file.name}“ ist größer als 50 MB. Das ist für ein Lieferavis ungewöhnlich groß.`);
      return;
    }
    try {
      const decoded = decodeBytes(new Uint8Array(await file.arrayBuffer()));
      if (decoded.binaryKind) {
        setReadError(`„${file.name}“ ist keine Textdatei (erkannt: ${decoded.binaryKind}). Bitte die EDIFACT-Datei selbst auswählen.`);
        return;
      }
      onLoad({ name: file.name, text: decoded.text, encoding: decoded.encoding });
    } catch {
      setReadError(`Die Datei „${file.name}“ konnte nicht gelesen werden.`);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
    else setReadError('Es wurde keine Datei erkannt. Bitte eine Datei (nicht einen Ordner oder Text) hierher ziehen.');
  }

  function loadSample() {
    const sample = SAMPLES.find((s) => s.file === sampleFile) ?? SAMPLES[0];
    setReadError(undefined);
    onLoad({ name: `Beispiel: ${sample.file}`, text: sample.content, encoding: 'UTF-8' });
  }

  return (
    <div className="input-panel">
      {(readError || problem) && (
        <div className="alert alert-err" role="alert">
          {readError ?? problem}
        </div>
      )}

      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <svg className="dropzone-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v12m0-12-4 4m4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
        </svg>
        <p className="dropzone-title">DESADV-Datei hierher ziehen</p>
        <p className="muted">oder</p>
        <button type="button" className="btn btn-primary" onClick={() => fileInput.current?.click()}>
          Datei auswählen …
        </button>
        <p className="muted small">Jede Dateiendung ist erlaubt (.edi, .txt, .desadv …). Die Datei verlässt Ihren Computer nicht.</p>
        <input
          ref={fileInput}
          type="file"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFile(file);
            e.target.value = '';
          }}
        />
      </div>

      <div className="input-alternatives">
        <section className="card">
          <h2>Text einfügen</h2>
          <textarea
            className="paste"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"UNA:+.? '\nUNB+UNOC:3+…\nUNH+1+DESADV:D:96A:UN'\n…"}
            spellCheck={false}
            aria-label="EDIFACT-Text"
          />
          <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => onLoad({ name: 'Eingefügter Text', text })}>
            Anzeigen
          </button>
        </section>

        <section className="card">
          <h2>Beispiel laden</h2>
          <p className="muted small">Erfundene Beispieldateien zum Ausprobieren.</p>
          <select className="select" value={sampleFile} onChange={(e) => setSampleFile(e.target.value)} aria-label="Beispieldatei">
            {SAMPLES.map((s) => (
              <option key={s.file} value={s.file}>
                {s.title}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={loadSample}>
            Beispiel laden
          </button>
        </section>
      </div>
    </div>
  );
}
