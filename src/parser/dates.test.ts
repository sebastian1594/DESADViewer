import { describe, expect, it } from 'vitest';
import { formatEdiDate } from './dates';

describe('formatEdiDate', () => {
  it.each([
    ['20240315', '102', '15.03.2024', '2024-03-15'],
    ['202403151430', '203', '15.03.2024 14:30', '2024-03-15T14:30'],
    ['20240315143059', '204', '15.03.2024 14:30:59', '2024-03-15T14:30:59'],
    ['202411050700+0100', '205', '05.11.2024 07:00 (UTC+01:00)', '2024-11-05T07:00+01:00'],
    ['2024', '602', '2024', '2024'],
    ['202403', '610', '03.2024', '2024-03'],
    ['202445', '616', 'KW 45/2024', '2024-W45'],
    ['20241106-20241107', '718', '06.11.2024 – 07.11.2024', '2024-11-06/2024-11-07'],
    ['202411060800-202411071600', '719', '06.11.2024 08:00 – 07.11.2024 16:00', '2024-11-06T08:00/2024-11-07T16:00'],
  ])('%s (Format %s) → %s', (value, format, display, iso) => {
    const r = formatEdiDate(value, format);
    expect(r).toMatchObject({ valid: true, recognized: true, display, iso });
  });

  it('lässt zweistellige Jahre zweistellig (kein Raten des Jahrhunderts)', () => {
    expect(formatEdiDate('240315', '101')).toMatchObject({ display: '15.03.24', iso: undefined });
    expect(formatEdiDate('150324', '2')).toMatchObject({ display: '15.03.24' });
    expect(formatEdiDate('2403151430', '201')).toMatchObject({ display: '15.03.24 14:30' });
  });

  it('zeigt Uhrzeiten (401) an', () => {
    expect(formatEdiDate('0930', '401').display).toBe('09:30 Uhr');
  });

  it('erkennt ungültige Kalendertage', () => {
    expect(formatEdiDate('20241345', '102').valid).toBe(false);
    expect(formatEdiDate('20230229', '102').valid).toBe(false);
    expect(formatEdiDate('20240229', '102').valid).toBe(true); // Schaltjahr
  });

  it('erkennt ungültige Uhrzeiten', () => {
    expect(formatEdiDate('202403152561', '203').valid).toBe(false);
  });

  it('erkennt Werte, die nicht zum Format passen', () => {
    const r = formatEdiDate('2024111', '102');
    expect(r.valid).toBe(false);
    expect(r.error).toContain('passt nicht');
  });

  it('zeigt unbekannte Formate als Rohwert, ohne zu raten', () => {
    const r = formatEdiDate('20241101', '999');
    expect(r).toMatchObject({ valid: true, recognized: false, display: '20241101' });
  });

  it('zeigt Werte ohne Formatcode als Rohwert', () => {
    expect(formatEdiDate('20241101', undefined)).toMatchObject({ recognized: false, display: '20241101' });
  });
});
