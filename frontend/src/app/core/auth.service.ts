import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './config';
import type { User } from './models';

const TOKEN_KEY = 'xlamp_token';
const USER_KEY = 'xlamp_user';

interface AuthResponse {
  user: User;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  // stanje se cita iz localStorage pri stvaranju servisa, da osvjezavanje
  // stranice ne izbaci korisnika van
  private tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private userSignal = signal<User | null>(readStoredUser());

  readonly user = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.tokenSignal() !== null);
  readonly isAdmin = computed(() => this.userSignal()?.role === 'ADMIN');

  get token(): string | null {
    return this.tokenSignal();
  }

  async login(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${API_URL}/auth/login`, { username, password }),
    );
    this.store(res);
  }

  async register(username: string, email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${API_URL}/auth/register`, { username, email, password }),
    );
    this.store(res);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    this.router.navigate(['/prijava']);
  }

  private store(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.tokenSignal.set(res.token);
    this.userSignal.set(res.user);
  }
}

/// ostatak prethodne sesije zna biti neispravan JSON (rucno diranje storagea,
/// promjena oblika podatka)
function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}
