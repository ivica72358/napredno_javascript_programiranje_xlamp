import { Pipe, PipeTransform } from '@angular/core';

/// svjetlina u postocima, s razlikom izmedu "0 %" i "ne znamo"
@Pipe({ name: 'brightness' })
export class BrightnessPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return `${value} %`;
  }
}
