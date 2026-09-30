import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Content Security Policy für die fertige Seite: Der Browser erlaubt nur Dateien
 * von der eigenen Adresse und blockiert jede Verbindung zu fremden Servern.
 * So ist technisch sichergestellt, dass keine Daten die Seite verlassen.
 * (Nur beim Bauen aktiv – der Entwicklungsserver braucht Inline-Skripte.)
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'desadviewer-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(/(<meta charset="UTF-8" \/>)/, `$1\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  };
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  // Relative Pfade, damit die fertige Seite auch in einem Unterordner
  // (z. B. GitHub Pages: https://name.github.io/desadviewer/) funktioniert.
  base: './',
  build: {
    // ExcelJS (~930 kB) wird erst beim Excel-Export nachgeladen – die Startseite bleibt klein.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
