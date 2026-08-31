import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DownlinkService } from '../../core/downlink.service';
import { LampService } from '../../core/lamp.service';
import { RealtimeService } from '../../core/realtime.service';
import { SystemService } from '../../core/system.service';
import { LastSeenPipe } from '../../pipes/last-seen.pipe';
import { porukaGreske } from '../login/login';
import { NAREDBE, nazivNaredbe, opisNaredbe } from '../../core/naredbe';
import type { OpisNaredbe } from '../../core/naredbe';
import type { CommandType, Downlink, Lamp } from '../../core/models';

@Component({
  selector: 'app-downlinks',
  imports: [ReactiveFormsModule, LastSeenPipe],
  templateUrl: './downlinks.html',
  styleUrl: './downlinks.scss',
})
export class Downlinks implements OnInit {
  private fb = inject(FormBuilder);
  private downlinkService = inject(DownlinkService);
  private lampService = inject(LampService);
  private realtime = inject(RealtimeService);
  protected system = inject(SystemService);

  protected readonly naredbe = NAREDBE;

  protected lampe = signal<Lamp[]>([]);
  protected povijest = signal<Downlink[]>([]);
  protected ucitavanje = signal(true);
  protected greska = signal<string | null>(null);
  protected poruka = signal<string | null>(null);
  protected salje = signal(false);

  /// naredba koja ceka potvrdu jer mijenja stanje rasvjete
  protected cekaPotvrdu = signal(false);
  protected uredujeId = signal<number | null>(null);

  protected forma = this.fb.nonNullable.group({
    lampId: [0, [Validators.required, Validators.min(1)]],
    command: ['REQUEST_STATUS' as CommandType, [Validators.required]],
    argument: [50, [Validators.min(0), Validators.max(100)]],
  });

  constructor() {
    effect(() => {
      const poslana = this.realtime.lastDownlinkSent();
      if (!poslana) return;
      this.povijest.update((lista) =>
        lista.map((d) => (d.id === poslana.id ? { ...d, ...poslana } : d)),
      );
    });
  }

  ngOnInit(): void {
    this.lampService.list({ pageSize: 100 }).subscribe({
      next: (r) => {
        this.lampe.set(r.data);
        if (r.data.length > 0) this.forma.controls.lampId.setValue(r.data[0].id);
      },
      error: (e) => this.greska.set(porukaGreske(e)),
    });
    this.ucitaj();
  }

  protected ucitaj(): void {
    this.ucitavanje.set(true);
    this.downlinkService.list({ pageSize: 50 }).subscribe({
      next: (r) => {
        this.povijest.set(r.data);
        this.ucitavanje.set(false);
      },
      error: (e) => {
        this.greska.set(porukaGreske(e));
        this.ucitavanje.set(false);
      },
    });
  }

  protected get trebaArgument(): boolean {
    return this.forma.controls.command.value === 'SET_BRIGHTNESS';
  }

  protected get odabranaNaredba(): OpisNaredbe | undefined {
    return opisNaredbe(this.forma.controls.command.value);
  }

  /// naredbe koje mijenjaju svjetlo traze jos jedan klik
  protected posalji(): void {
    this.forma.markAllAsTouched();
    if (this.forma.invalid || this.salje()) return;

    if (this.odabranaNaredba?.mijenjaSvjetlo && !this.cekaPotvrdu()) {
      this.cekaPotvrdu.set(true);
      return;
    }

    this.cekaPotvrdu.set(false);
    this.salje.set(true);
    this.greska.set(null);

    const { lampId, command, argument } = this.forma.getRawValue();
    const arg = command === 'SET_BRIGHTNESS' ? argument : null;
    const id = this.uredujeId();

    // izmjena vraca NOVI red s novim id-em, jer servis stari brise i stvara
    // zamjenu - zato se stari mice iz liste umjesto da se azurira na mjestu
    const zahtjev = id
      ? this.downlinkService.update(id, { command, argument: arg })
      : this.downlinkService.send({ lampId, command, argument: arg });

    zahtjev.subscribe({
      next: (d) => {
        this.salje.set(false);
        this.povijest.update((lista) => [d, ...lista.filter((x) => x.id !== id)]);
        this.javi(id ? 'Naredba je izmijenjena.' : this.ishod(d));
        this.uredujeId.set(null);
        // bez ovoga obrazac ostane zakljucan na istoj svjetiljci i sljedeca
        // naredba se ne moze poslati drugoj bez osvjezavanja stranice
        this.forma.controls.lampId.enable();
      },
      error: (e) => {
        this.salje.set(false);
        this.greska.set(porukaGreske(e));
      },
    });
  }

  /// ucitaj neposlanu naredbu u obrazac
  protected uredi(d: Downlink): void {
    this.uredujeId.set(d.id);
    this.cekaPotvrdu.set(false);
    this.greska.set(null);
    this.forma.patchValue({
      lampId: d.lampId,
      command: d.command,
      argument: d.argument ?? 50,
    });
    // lampa se ne mijenja pri izmjeni, backend prima samo naredbu i argument
    this.forma.controls.lampId.disable();
  }

  protected odustani(): void {
    this.cekaPotvrdu.set(false);
    if (this.uredujeId()) {
      this.uredujeId.set(null);
      this.forma.controls.lampId.enable();
    }
  }

  /// smije li se naredba jos mijenjati
  protected promjenjiva(d: Downlink): boolean {
    return !d.isSent && !d.cancelled;
  }

  protected otkazi(id: number): void {
    this.downlinkService.cancel(id).subscribe({
      next: (d) => {
        this.povijest.update((lista) => lista.map((x) => (x.id === id ? d : x)));
        this.javi('Naredba je otkazana.');
      },
      error: (e) => this.greska.set(porukaGreske(e)),
    });
  }

  protected obrisi(id: number): void {
    this.downlinkService.remove(id).subscribe({
      next: () => this.povijest.update((lista) => lista.filter((d) => d.id !== id)),
      error: (e) => this.greska.set(porukaGreske(e)),
    });
  }

  /// poruka nakon slanja
  private ishod(d: Downlink): string {
    if (d.isSent) return 'Naredba je predana mreži.';
    if (d.error) return 'Naredba nije poslana: ' + d.error;
    if (this.system.dryRun()) return 'Probni način — naredba je zapisana, ali nije poslana uređaju.';
    return 'Naredba je zapisana i čeka slanje.';
  }

  /// stanje naredbe za prikaz
  protected stanje(d: Downlink): { tekst: string; klasa: string } {
    if (d.cancelled) return { tekst: 'Otkazana', klasa: 'UNKNOWN' };
    if (d.isSent) return { tekst: 'Poslana', klasa: 'ONLINE' };
    if (d.error) return { tekst: 'Neuspjela', klasa: 'OFFLINE' };
    return { tekst: 'U redu čekanja', klasa: 'ERROR' };
  }

  protected nazivNaredbe = nazivNaredbe;

  private javi(tekst: string): void {
    this.poruka.set(tekst);
    setTimeout(() => this.poruka.set(null), 4000);
  }
}
