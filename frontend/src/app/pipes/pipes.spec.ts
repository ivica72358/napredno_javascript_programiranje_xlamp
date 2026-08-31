import { describe, expect, it } from 'vitest';
import { BrightnessPipe } from './brightness.pipe';
import { SignalQualityPipe } from './signal-quality.pipe';
import { LastSeenPipe } from './last-seen.pipe';
import { UplinkSummaryPipe } from './uplink-summary.pipe';
import type { DecodedUplink } from '../core/models';

describe('BrightnessPipe', () => {
  const pipe = new BrightnessPipe();

  it('postotak uz oznaku', () => {
    expect(pipe.transform(42)).toBe('42 %');
  });

  // ovo je razlog zasto pipe uopce postoji: lampa koja se nije javila nije
  // isto sto i lampa za koju znamo da je ugasena
  it('null nije 0 %', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(0)).toBe('0 %');
  });
});

describe('SignalQualityPipe', () => {
  const pipe = new SignalQualityPipe();

  it('ocjena i vrijednost', () => {
    expect(pipe.transform(-58)).toBe('Odličan (-58 dBm)');
    expect(pipe.transform(-105)).toBe('Slab (-105 dBm)');
  });

  it('razina se koristi kao CSS klasa', () => {
    expect(pipe.transform(-58, 'razina')).toBe('odlican');
    expect(pipe.transform(-130, 'razina')).toBe('kritican');
    expect(pipe.transform(null, 'razina')).toBe('nepoznat');
  });
});

describe('LastSeenPipe', () => {
  const pipe = new LastSeenPipe();
  const prije = (ms: number) => new Date(Date.now() - ms).toISOString();

  it('relativno vrijeme', () => {
    expect(pipe.transform(prije(30_000))).toBe('upravo sad');
    expect(pipe.transform(prije(12 * 60_000))).toBe('prije 12 min');
    expect(pipe.transform(prije(3 * 3_600_000))).toBe('prije 3 h');
    expect(pipe.transform(prije(24 * 3_600_000))).toBe('prije 1 dan');
  });

  it('bez vrijednosti', () => {
    expect(pipe.transform(null)).toBe('nikad');
    expect(pipe.transform('bezveze')).toBe('nikad');
  });
});

describe('UplinkSummaryPipe', () => {
  const pipe = new UplinkSummaryPipe();

  it('status poruka', () => {
    const d = { type: 'STATUS', label: '', brightness: 80, temperature: 33, profileIndex: 1 };
    expect(pipe.transform(d as DecodedUplink)).toBe('svjetlina 80 %, 33 °C, profil 1');
  });

  // temperatura se cita preko DALI sabirnice, pa izostanak znaci prekid veze
  // s driverom - to mora biti vidljivo, a ne prazno polje
  it('status bez temperature javlja DALI gresku', () => {
    const d = { type: 'STATUS', label: '', brightness: 80, temperature: null, profileIndex: 1 };
    expect(pipe.transform(d as DecodedUplink)).toContain('DALI greška');
  });

  it('alarm', () => {
    const d = { type: 'ALARM', label: '', cleared: false, errors: ['DALI greška.'] };
    expect(pipe.transform(d as DecodedUplink)).toBe('DALI greška.');
  });

  it('bez poruke', () => {
    expect(pipe.transform(null)).toBe('—');
  });
});
