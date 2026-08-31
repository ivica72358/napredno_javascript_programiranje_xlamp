import { AfterViewInit, Component, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { LampService } from '../../core/lamp.service';
import { RealtimeService } from '../../core/realtime.service';
import { BrightnessPipe } from '../../pipes/brightness.pipe';
import { LastSeenPipe } from '../../pipes/last-seen.pipe';
import { porukaGreske } from '../login/login';
import type { Lamp, LampStatus } from '../../core/models';

/// boja oznake po stanju
const BOJE: Record<LampStatus, string> = {
  ONLINE: '#4caf50',
  OFFLINE: '#f2545b',
  ERROR: '#ffb400',
  UNKNOWN: '#93a0bd',
};

/// zagreb, kad nema nijedne lampe s koordinatama
const POCETNI_POGLED: L.LatLngExpression = [45.815399, 15.966568];

@Component({
  selector: 'app-lamp-map',
  imports: [RouterLink, BrightnessPipe, LastSeenPipe],
  templateUrl: './lamp-map.html',
  styleUrl: './lamp-map.scss',
})
export class LampMap implements AfterViewInit, OnDestroy {
  private lampService = inject(LampService);
  private realtime = inject(RealtimeService);

  private karta?: L.Map;
  private promatrac?: ResizeObserver;
  private oznake = new Map<number, L.Marker>();

  protected lampe = signal<Lamp[]>([]);
  protected odabrana = signal<Lamp | null>(null);
  protected greska = signal<string | null>(null);
  protected ucitavanje = signal(true);

  constructor() {
    effect(() => {
      const azurirana = this.realtime.lastLampUpdate();
      if (!azurirana) return;

      this.lampe.update((lista) =>
        lista.map((l) => (l.id === azurirana.id ? { ...l, ...azurirana } : l)),
      );
      this.osvjeziOznaku(azurirana);

      // otvoreni panel mora pratiti promjenu, inace prikazuje zamrznuto stanje
      // untracked je OBAVEZAN - inace upis ponovno pokrene efekt, petlja
      if (untracked(this.odabrana)?.id === azurirana.id) {
        this.odabrana.update((o) => (o ? { ...o, ...azurirana } : o));
      }
    });
  }

  // karta se stvara tek kad DOM postoji - Leaflet mjeri spremnik pri
  // inicijalizaciji i na jos nepostojecem elementu ispadne 0x0 piksela
  ngAfterViewInit(): void {
    const spremnik = document.getElementById('karta')!;
    this.karta = L.map(spremnik, { center: POCETNI_POGLED, zoom: 13 });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.karta);

    // Leaflet zapamti dimenzije spremnika u trenutku stvaranja
    this.promatrac = new ResizeObserver(() => this.karta?.invalidateSize());
    this.promatrac.observe(spremnik);

    this.ucitaj();
  }

  ngOnDestroy(): void {
    this.promatrac?.disconnect();
    this.karta?.remove();
  }

  private ucitaj(): void {
    // pageSize 100: karta prikazuje sve odjednom, straniciranje na njoj nema
    // smisla
    this.lampService.list({ pageSize: 100 }).subscribe({
      next: (r) => {
        this.lampe.set(r.data);
        this.ucitavanje.set(false);
        r.data.forEach((l) => this.osvjeziOznaku(l));
        this.namjestiPogled(r.data);
      },
      error: (e) => {
        this.greska.set(porukaGreske(e));
        this.ucitavanje.set(false);
      },
    });
  }

  private ikona(lampa: Lamp): L.DivIcon {
    const boja = BOJE[lampa.status];
    return L.divIcon({
      className: 'lampa-oznaka',
      html: '<span style="background:' + boja + '"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  private osvjeziOznaku(lampa: Lamp): void {
    if (!this.karta) return;

    const postojeca = this.oznake.get(lampa.id);
    if (postojeca) {
      postojeca.setIcon(this.ikona(lampa));
      postojeca.setLatLng([lampa.latitude, lampa.longitude]);
      return;
    }

    const oznaka = L.marker([lampa.latitude, lampa.longitude], { icon: this.ikona(lampa) })
      .addTo(this.karta)
      .on('click', () => this.odabrana.set(this.lampe().find((l) => l.id === lampa.id) ?? lampa));

    this.oznake.set(lampa.id, oznaka);
  }

  /// namjesti pogled tako da sve lampe stanu u okvir
  private namjestiPogled(lampe: Lamp[]): void {
    if (!this.karta || lampe.length === 0) return;

    const granice = L.latLngBounds(lampe.map((l) => [l.latitude, l.longitude] as L.LatLngTuple));
    // maxZoom jer bi se kod jedne lampe karta priblizila do razine zgrade
    this.karta.fitBounds(granice, { padding: [50, 50], maxZoom: 16 });
  }

  protected zatvoriPanel(): void {
    this.odabrana.set(null);
  }

  protected fokusiraj(lampa: Lamp): void {
    this.karta?.setView([lampa.latitude, lampa.longitude], 17);
    this.odabrana.set(lampa);
  }
}
