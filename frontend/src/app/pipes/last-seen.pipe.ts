import { Pipe, PipeTransform } from '@angular/core';

const MINUTA = 60_000;
const SAT = 60 * MINUTA;
const DAN = 24 * SAT;

/// vrijeme zadnjeg javljanja kao "prije 12 min"
@Pipe({ name: 'lastSeen' })
export class LastSeenPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return 'nikad';

    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return 'nikad';

    const diff = Date.now() - then;
    if (diff < 0) return 'upravo sad';
    if (diff < MINUTA) return 'upravo sad';
    if (diff < SAT) return `prije ${Math.floor(diff / MINUTA)} min`;
    if (diff < DAN) return `prije ${Math.floor(diff / SAT)} h`;

    const dana = Math.floor(diff / DAN);
    return dana === 1 ? 'prije 1 dan' : `prije ${dana} dana`;
  }
}
