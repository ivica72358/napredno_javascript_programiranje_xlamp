import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from './config';

interface Health {
  status: string;
  mqtt: boolean;
  dryRun: boolean;
}

/// stanje poslužitelja koje mijenja znacenje onoga sto korisnik vidi
@Injectable({ providedIn: 'root' })
export class SystemService {
  private http = inject(HttpClient);

  readonly dryRun = signal(false);
  readonly mqtt = signal(false);

  ucitaj(): void {
    this.http.get<Health>(`${API_URL}/health`).subscribe({
      next: (h) => {
        this.dryRun.set(h.dryRun);
        this.mqtt.set(h.mqtt);
      },
      error: () => {
        this.mqtt.set(false);
      },
    });
  }
}
