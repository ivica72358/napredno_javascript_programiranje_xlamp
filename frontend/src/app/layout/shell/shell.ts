import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { RealtimeService } from '../../core/realtime.service';
import { SystemService } from '../../core/system.service';

/// okvir prijavljenog dijela aplikacije: bocna navigacija + podrucje za rutu
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnInit {
  protected auth = inject(AuthService);
  protected realtime = inject(RealtimeService);
  protected system = inject(SystemService);

  protected readonly veze = computed(() => [
    { put: '/lampe', naziv: 'Svjetiljke', ikona: '💡' },
    { put: '/karta', naziv: 'Karta', ikona: '🗺️' },
    { put: '/telemetrija', naziv: 'Telemetrija', ikona: '📡' },
    { put: '/naredbe', naziv: 'Naredbe', ikona: '⚡' },
    // obicnom korisniku ekran prikazuje samo njegov profil, pa bi ga naziv
    // "Korisnici" slao na popis koji nikad nece vidjeti
    { put: '/korisnici', naziv: this.auth.isAdmin() ? 'Korisnici' : 'Moj profil', ikona: '👤' },
  ]);

  ngOnInit(): void {
    this.system.ucitaj();
  }
}
