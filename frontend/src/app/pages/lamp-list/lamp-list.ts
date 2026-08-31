import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LampService } from '../../core/lamp.service';
import { RealtimeService } from '../../core/realtime.service';
import { AuthService } from '../../core/auth.service';
import { BrightnessPipe } from '../../pipes/brightness.pipe';
import { LastSeenPipe } from '../../pipes/last-seen.pipe';
import { porukaGreske } from '../login/login';
import type { Lamp } from '../../core/models';

@Component({
  selector: 'app-lamp-list',
  imports: [ReactiveFormsModule, RouterLink, BrightnessPipe, LastSeenPipe],
  templateUrl: './lamp-list.html',
  styleUrl: './lamp-list.scss',
})
export class LampList implements OnInit {
  private fb = inject(FormBuilder);
  private lampService = inject(LampService);
  private realtime = inject(RealtimeService);
  protected auth = inject(AuthService);

  protected lampe = signal<Lamp[]>([]);
  protected ucitavanje = signal(true);
  protected greska = signal<string | null>(null);
  protected poruka = signal<string | null>(null);

  protected stranica = signal(1);
  protected ukupnoStranica = signal(1);
  protected ukupno = signal(0);
  protected pretraga = signal('');

  /// null = zatvoreno, 0 = nova lampa, >0 = uredivanje postojece
  protected obrazacZa = signal<number | null>(null);
  protected spremanje = signal(false);
  protected brisemId = signal<number | null>(null);

  protected forma = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    devEui: ['', [Validators.required, Validators.pattern(/^[0-9a-fA-F]{16}$/)]],
    latitude: [45.815399, [Validators.required, Validators.min(-90), Validators.max(90)]],
    longitude: [15.966568, [Validators.required, Validators.min(-180), Validators.max(180)]],
  });

  constructor() {
    // uplink mijenja lastSeen, svjetlinu i status
    effect(() => {
      const azurirana = this.realtime.lastLampUpdate();
      if (!azurirana) return;
      this.lampe.update((lista) =>
        lista.map((l) => (l.id === azurirana.id ? { ...l, ...azurirana } : l)),
      );
    });
  }

  ngOnInit(): void {
    this.ucitaj();
  }

  protected ucitaj(): void {
    this.ucitavanje.set(true);
    this.greska.set(null);

    this.lampService.list({ page: this.stranica(), search: this.pretraga() }).subscribe({
      next: (r) => {
        this.lampe.set(r.data);
        this.ukupnoStranica.set(r.totalPages);
        this.ukupno.set(r.total);
        this.ucitavanje.set(false);
      },
      error: (e) => {
        this.greska.set(porukaGreske(e));
        this.ucitavanje.set(false);
      },
    });
  }

  protected trazi(vrijednost: string): void {
    this.pretraga.set(vrijednost);
    this.stranica.set(1);
    this.ucitaj();
  }

  protected naStranicu(n: number): void {
    if (n < 1 || n > this.ukupnoStranica()) return;
    this.stranica.set(n);
    this.ucitaj();
  }

  // ── Obrazac ──────────────────────────────────────────────────────────────

  protected nova(): void {
    this.forma.reset({ name: '', devEui: '', latitude: 45.815399, longitude: 15.966568 });
    this.obrazacZa.set(0);
  }

  protected uredi(lampa: Lamp): void {
    this.forma.setValue({
      name: lampa.name,
      devEui: lampa.devEui,
      latitude: lampa.latitude,
      longitude: lampa.longitude,
    });
    this.obrazacZa.set(lampa.id);
  }

  protected zatvori(): void {
    this.obrazacZa.set(null);
    this.greska.set(null);
  }

  protected spremi(): void {
    this.forma.markAllAsTouched();
    if (this.forma.invalid || this.spremanje()) return;

    const id = this.obrazacZa();
    if (id === null) return;

    this.spremanje.set(true);
    this.greska.set(null);

    const podaci = { ...this.forma.getRawValue(), devEui: this.forma.getRawValue().devEui.toLowerCase() };
    const zahtjev = id === 0
      ? this.lampService.create(podaci)
      : this.lampService.update(id, podaci);

    zahtjev.subscribe({
      next: () => {
        this.spremanje.set(false);
        this.obrazacZa.set(null);
        this.javi(id === 0 ? 'Svjetiljka je dodana.' : 'Promjene su spremljene.');
        this.ucitaj();
      },
      error: (e) => {
        this.spremanje.set(false);
        this.greska.set(porukaGreske(e));
      },
    });
  }

  // ── Brisanje ─────────────────────────────────────────────────────────────

  protected potvrdiBrisanje(id: number): void {
    this.brisemId.set(id);
  }

  protected odustaniOdBrisanja(): void {
    this.brisemId.set(null);
  }

  protected obrisi(id: number): void {
    this.lampService.remove(id).subscribe({
      next: () => {
        this.brisemId.set(null);
        this.javi('Svjetiljka je obrisana.');
        this.ucitaj();
      },
      error: (e) => {
        this.brisemId.set(null);
        this.greska.set(porukaGreske(e));
      },
    });
  }

  private javi(tekst: string): void {
    this.poruka.set(tekst);
    setTimeout(() => this.poruka.set(null), 3500);
  }
}
