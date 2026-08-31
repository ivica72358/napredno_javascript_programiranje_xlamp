import { Pipe, PipeTransform } from '@angular/core';

/// pragovi kvalitete LoRa veze u dBm
const ODLICAN = -80;
const DOBAR = -100;
const SLAB = -110;

export type SignalLevel = 'odlican' | 'dobar' | 'slab' | 'kritican' | 'nepoznat';

/// RSSI u ocjenu koju se da procitati bez poznavanja decibela
@Pipe({ name: 'signalQuality' })
export class SignalQualityPipe implements PipeTransform {
  transform(rssi: number | null | undefined, format: 'tekst' | 'razina' = 'tekst'): string {
    const level = classify(rssi);
    if (format === 'razina') return level;
    if (level === 'nepoznat') return '—';

    const labels: Record<SignalLevel, string> = {
      odlican: 'Odličan',
      dobar: 'Dobar',
      slab: 'Slab',
      kritican: 'Kritičan',
      nepoznat: '—',
    };
    return `${labels[level]} (${rssi} dBm)`;
  }
}

function classify(rssi: number | null | undefined): SignalLevel {
  if (rssi === null || rssi === undefined) return 'nepoznat';
  if (rssi >= ODLICAN) return 'odlican';
  if (rssi >= DOBAR) return 'dobar';
  if (rssi >= SLAB) return 'slab';
  return 'kritican';
}
