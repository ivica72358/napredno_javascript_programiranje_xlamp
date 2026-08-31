import { Component, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LampService } from '../../core/lamp.service';
import { UplinkService } from '../../core/uplink.service';
import { DownlinkService } from '../../core/downlink.service';
import { RealtimeService } from '../../core/realtime.service';
import { SystemService } from '../../core/system.service';
import { NAREDBE, nazivNaredbe, opisNaredbe } from '../../core/naredbe';
import { BrightnessPipe } from '../../pipes/brightness.pipe';
import { LastSeenPipe } from '../../pipes/last-seen.pipe';
import { SignalQualityPipe } from '../../pipes/signal-quality.pipe';
import { UplinkSummaryPipe } from '../../pipes/uplink-summary.pipe';
import { porukaGreske } from '../login/login';
import type { CommandType, Downlink, Lamp, Uplink } from '../../core/models';

/// koliko zapisa povijesti dohvatiti
const POVIJEST = 15;

/// sve o jednoj svjetiljci na jednom mjestu: stanje, upravljanje i povijest
@Component({
  selector: 'app-lamp-detail',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    BrightnessPipe,
    LastSeenPipe,
    SignalQualityPipe,
    UplinkSummaryPipe,
  ],
  templateUrl: './lamp-detail.html',
  styleUrl: './lamp-detail.scss',
})
export class LampDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private lampService = inject(LampService);
  private uplinkService = inject(UplinkService);
  private downlinkService = inject(DownlinkService);
  private realtime = inject(RealtimeService);
  protected system = inject(SystemService);

  protected readonly naredbe = NAREDBE;
  protected nazivNaredbe = nazivNaredbe;

  protected lampa = signal<Lamp | null>(null);
  protected uplinkovi = signal<Uplink[]>([]);
  protected naredbePovijest = signal<Downlink[]>([]);

  protected ucitavanje = signal(true);
  protected greska = signal<string | null>(null);
  protected poruka = signal<string | null>(null);
  protected salje = signal(false);
  protected cekaPotvrdu = signal(false);

  protected forma = this.fb.nonNullable.group({
    command: ['REQUEST_STATUS' as CommandType, [Validators.required]],
    argument: [50, [Validators.min(0), Validators.max(100)]],
  });

  constructor() {
    // ziva telemetrija: uplink i promjena stanja stizu preko socketa
    effect(() => {
      const u = this.realtime.lastUplink();
      if (!u) return;
      const l = untracked(this.lampa);
      if (!l || u.lampId !== l.id) return;
      this.uplinkovi.update((lista) => [u, ...lista].slice(0, POVIJEST));
    });

    effect(() => {
    // untracked je OBAVEZAN: da se lampa cita praceno, upis bi ponovno
    // pokrenuo efekt i kartica bi se zamrznula
      const azurirana = this.realtime.lastLampUpdate();
      if (!azurirana) return;
      const l = untracked(this.lampa);
      if (!l || azurirana.id !== l.id) return;
      this.lampa.set({ ...l, ...azurirana });
    });

    effect(() => {
      const poslana = this.realtime.lastDownlinkSent();
      if (!poslana) return;
      this.naredbePovijest.update((lista) =>
        lista.map((d) => (d.id === poslana.id ? { ...d, ...poslana } : d)),
      );
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    // rucno upisan ili zastario URL: bolje vratiti na popis nego ostaviti prazan
    // ekran koji izgleda kao da se nesto ucitava
    if (!Number.isInteger(id) || id < 1) {
      this.router.navigate(['/lampe']);
      return;
    }

    this.ucitaj(id);
  }

  private ucitaj(id: number): void {
    this.lampService.get(id).subscribe({
      next: (l) => {
        this.lampa.set(l);
        this.ucitavanje.set(false);
      },
      error: (e) => {
        this.greska.set(porukaGreske(e));
        this.ucitavanje.set(false);
      },
    });

    this.uplinkService.list({ lampId: id, pageSize: POVIJEST }).subscribe({
      next: (r) => this.uplinkovi.set(r.data),
      error: () => this.uplinkovi.set([]),
    });

    this.ucitajNaredbe(id);
  }

  private ucitajNaredbe(id: number): void {
    this.downlinkService.list({ lampId: id, pageSize: POVIJEST }).subscribe({
      next: (r) => this.naredbePovijest.set(r.data),
      error: () => this.naredbePovijest.set([]),
    });
  }

  // ── Upravljanje ──────────────────────────────────────────────────────────

  protected get odabrana() {
    return opisNaredbe(this.forma.controls.command.value);
  }

  protected get trebaArgument(): boolean {
    return this.forma.controls.command.value === 'SET_BRIGHTNESS';
  }

  protected posalji(): void {
    if (this.salje()) return;

    // naredbe koje gase ili pale stvarnu svjetiljku traze jos jedan klik
    if (this.odabrana?.mijenjaSvjetlo && !this.cekaPotvrdu()) {
      this.cekaPotvrdu.set(true);
      return;
    }

    const l = this.lampa();
    if (!l) return;

    this.salje.set(true);
    this.greska.set(null);
    this.cekaPotvrdu.set(false);

    const { command, argument } = this.forma.getRawValue();

    this.downlinkService
      .send({ lampId: l.id, command, argument: this.trebaArgument ? argument : null })
      .subscribe({
        next: (d) => {
          this.salje.set(false);
          this.naredbePovijest.update((lista) => [d, ...lista].slice(0, POVIJEST));
          this.javi(
            d.isSent
              ? `${nazivNaredbe(command)} — poslano.`
              : `${nazivNaredbe(command)} — zapisano, ali nije poslano.`,
          );
        },
        error: (e) => {
          this.salje.set(false);
          this.greska.set(porukaGreske(e));
        },
      });
  }

  protected odustani(): void {
    this.cekaPotvrdu.set(false);
  }

  private javi(tekst: string): void {
    this.poruka.set(tekst);
    setTimeout(() => this.poruka.set(null), 4000);
  }
}
