import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../core/user.service';
import { AuthService } from '../../core/auth.service';
import { porukaGreske } from '../login/login';
import type { Role, User } from '../../core/models';

/// ekran ima dva lica prema ulozi prijavljenog: ADMIN -> tablica svih
/// korisnika s dodavanjem, uredivanjem i brisanjem USER -> samo vlastiti
@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule],
  templateUrl: './users.html',
})
export class Users implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  protected auth = inject(AuthService);

  protected korisnici = signal<User[]>([]);
  protected ucitavanje = signal(true);
  protected greska = signal<string | null>(null);
  protected poruka = signal<string | null>(null);
  protected spremanje = signal(false);
  protected brisemId = signal<number | null>(null);

  /// null = zatvoreno, 0 = novi korisnik, >0 = uredivanje postojeceg
  protected obrazacZa = signal<number | null>(null);

  protected novaForma = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50),
      Validators.pattern(/^[a-zA-Z0-9_.-]+$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['USER' as Role, [Validators.required]],
  });

  protected izmjenaForma = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    // prazno = zadrzi postojecu lozinku
    password: ['', [Validators.minLength(8)]],
    role: ['USER' as Role],
  });

  ngOnInit(): void {
    if (this.auth.isAdmin()) this.ucitaj();
    else this.ucitajVlastiti();
  }

  private ucitaj(): void {
    this.ucitavanje.set(true);
    this.greska.set(null);
    this.userService.list().subscribe({
      next: (r) => {
        this.korisnici.set(r.data);
        this.ucitavanje.set(false);
      },
      error: (e) => {
        this.greska.set(porukaGreske(e));
        this.ucitavanje.set(false);
      },
    });
  }

  private ucitajVlastiti(): void {
    const id = this.auth.user()?.id;
    if (!id) return;

    this.userService.get(id).subscribe({
      next: (u) => {
        this.korisnici.set([u]);
        this.ucitavanje.set(false);
      },
      error: (e) => {
        this.greska.set(porukaGreske(e));
        this.ucitavanje.set(false);
      },
    });
  }

  // ── Obrasci ──────────────────────────────────────────────────────────────

  protected novi(): void {
    this.novaForma.reset({ username: '', email: '', password: '', role: 'USER' });
    this.obrazacZa.set(0);
  }

  protected uredi(k: User): void {
    this.izmjenaForma.reset({ email: k.email, password: '', role: k.role });
    this.obrazacZa.set(k.id);
  }

  protected zatvori(): void {
    this.obrazacZa.set(null);
    this.greska.set(null);
  }

  protected spremi(): void {
    const id = this.obrazacZa();
    if (id === null || this.spremanje()) return;

    const forma = id === 0 ? this.novaForma : this.izmjenaForma;
    forma.markAllAsTouched();
    if (forma.invalid) return;

    this.spremanje.set(true);
    this.greska.set(null);

    const zahtjev =
      id === 0
        ? this.userService.create(this.novaForma.getRawValue())
        : this.userService.update(id, ocistiIzmjenu(this.izmjenaForma.getRawValue(), this.auth.isAdmin()));

    zahtjev.subscribe({
      next: () => {
        this.spremanje.set(false);
        this.obrazacZa.set(null);
        this.javi(id === 0 ? 'Korisnik je dodan.' : 'Promjene su spremljene.');
        if (this.auth.isAdmin()) this.ucitaj();
        else this.ucitajVlastiti();
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
    this.userService.remove(id).subscribe({
      next: () => {
        this.brisemId.set(null);
        this.javi('Korisnik je obrisan.');
        this.ucitaj();
      },
      error: (e) => {
        this.brisemId.set(null);
        this.greska.set(porukaGreske(e));
      },
    });
  }

  /// brisanje vlastitog racuna backend odbija - bez ovoga bi gumb postojao samo
  /// zato da vrati gresku
  protected smijeObrisati(k: User): boolean {
    return this.auth.isAdmin() && k.id !== this.auth.user()?.id;
  }

  private javi(tekst: string): void {
    this.poruka.set(tekst);
    setTimeout(() => this.poruka.set(null), 3500);
  }
}

/// prazna polja se izbacuju iz zahtjeva: prazna lozinka znaci "ne mijenjaj",
/// a poslana bi bila odbijena kao prekratka
function ocistiIzmjenu(
  vrijednosti: { email: string; password: string; role: Role },
  jeAdmin: boolean,
): { email: string; password?: string; role?: Role } {
  const rezultat: { email: string; password?: string; role?: Role } = { email: vrijednosti.email };
  if (vrijednosti.password) rezultat.password = vrijednosti.password;
  if (jeAdmin) rezultat.role = vrijednosti.role;
  return rezultat;
}
