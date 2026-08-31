import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { UplinkService } from '../../core/uplink.service';
import { LampService } from '../../core/lamp.service';
import { RealtimeService } from '../../core/realtime.service';
import { BrightnessPipe } from '../../pipes/brightness.pipe';
import { LastSeenPipe } from '../../pipes/last-seen.pipe';
import { SignalQualityPipe } from '../../pipes/signal-quality.pipe';
import { UplinkSummaryPipe } from '../../pipes/uplink-summary.pipe';
import { porukaGreske } from '../login/login';
import type { EnergyValue, Lamp, Uplink } from '../../core/models';

/// koliko redaka lista drzi kad uplinkovi stizu uzivo
const MAX_REDAKA = 100;

@Component({
  selector: 'app-uplinks',
  imports: [BrightnessPipe, LastSeenPipe, SignalQualityPipe, UplinkSummaryPipe],
  templateUrl: './uplinks.html',
  styleUrl: './uplinks.scss',
})
export class Uplinks implements OnInit {
  private uplinkService = inject(UplinkService);
  private lampService = inject(LampService);
  protected realtime = inject(RealtimeService);

  protected uplinkovi = signal<Uplink[]>([]);
  protected lampe = signal<Lamp[]>([]);
  protected ucitavanje = signal(true);
  protected greska = signal<string | null>(null);

  protected filtriranaLampa = signal<number | null>(null);
  protected prosiren = signal<number | null>(null);
  /// broj uplinkova pristiglih uzivo otkako je stranica otvorena
  protected novih = signal(0);

  constructor() {
    effect(() => {
      const novi = this.realtime.lastUplink();
      if (!novi) return;

      // filter po lampi vrijedi i za zive dogadaje, inace bi u filtriranoj listi
      // odjednom osvanuo redak druge lampe
      const filter = this.filtriranaLampa();
      if (filter !== null && novi.lampId !== filter) return;

      this.uplinkovi.update((lista) => [novi, ...lista].slice(0, MAX_REDAKA));
      this.novih.update((n) => n + 1);
    });
  }

  ngOnInit(): void {
    this.lampService.list({ pageSize: 100 }).subscribe({
      next: (r) => this.lampe.set(r.data),
      error: () => { /* filter po lampi je pomocna funkcija, ne rusi ekran */ },
    });
    this.ucitaj();
  }

  protected ucitaj(): void {
    this.ucitavanje.set(true);
    this.greska.set(null);
    this.novih.set(0);

    this.uplinkService
      .list({ pageSize: MAX_REDAKA, lampId: this.filtriranaLampa() ?? undefined })
      .subscribe({
        next: (r) => {
          this.uplinkovi.set(r.data);
          this.ucitavanje.set(false);
        },
        error: (e) => {
          this.greska.set(porukaGreske(e));
          this.ucitavanje.set(false);
        },
      });
  }

  protected filtriraj(vrijednost: string): void {
    this.filtriranaLampa.set(vrijednost ? Number(vrijednost) : null);
    this.ucitaj();
  }

  protected prosiri(id: number): void {
    this.prosiren.update((trenutni) => (trenutni === id ? null : id));
  }

  protected obrisi(id: number): void {
    this.uplinkService.remove(id).subscribe({
      next: () => this.uplinkovi.update((lista) => lista.filter((u) => u.id !== id)),
      error: (e) => this.greska.set(porukaGreske(e)),
    });
  }

  /// objekt s energetskim vrijednostima u niz, za @for u predlosku
  protected energetskeVrijednosti(uplink: Uplink): EnergyValue[] {
    return Object.values(uplink.decoded?.values ?? {});
  }
}
