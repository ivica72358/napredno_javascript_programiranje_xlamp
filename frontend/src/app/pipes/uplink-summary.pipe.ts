import { Pipe, PipeTransform } from '@angular/core';
import type { DecodedUplink } from '../core/models';

/// dekodirani uplink u jedan redak za tablicu
@Pipe({ name: 'uplinkSummary' })
export class UplinkSummaryPipe implements PipeTransform {
  transform(decoded: DecodedUplink | null | undefined): string {
    if (!decoded) return '—';

    switch (decoded.type) {
      case 'STATUS': {
        const dijelovi = [`svjetlina ${decoded.brightness} %`];
        if (decoded.temperature !== null && decoded.temperature !== undefined) {
          dijelovi.push(`${decoded.temperature} °C`);
        } else {
          // temperatura se cita preko DALI sabirnice; izostanak znaci da komunikacija
          // s driverom ne radi
          dijelovi.push('DALI greška');
        }
        dijelovi.push(`profil ${decoded.profileIndex}`);
        return dijelovi.join(', ');
      }

      case 'ENERGY': {
        const values = decoded.values ?? {};
        const broj = Object.keys(values).length;
        const istaknuto = values['activePower'] ?? values['supplyVoltage'] ?? Object.values(values)[0];
        return istaknuto ? `${istaknuto.display} (+ još ${broj - 1})` : `${broj} parametara`;
      }

      case 'ALARM':
        return decoded.cleared ? 'greška otklonjena' : (decoded.errors ?? []).join('; ');

      case 'BOOT':
        return `firmware ${decoded.firmwareVersion}, svjetlina ${decoded.brightness} %`;

      default:
        return 'nepoznat format';
    }
  }
}
