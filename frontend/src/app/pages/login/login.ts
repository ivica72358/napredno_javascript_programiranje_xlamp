import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import type { ApiErrorBody } from '../../core/models';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: '../auth-forma.scss',
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected greska = signal<string | null>(null);
  protected radi = signal(false);

  protected forma = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required]],
  });

  protected async posalji(): Promise<void> {
    // markAllAsTouched jer se greske prikazuju tek na dodirnutom polju - bez
    // ovoga prazan obrazac na klik ne kaze nista
    this.forma.markAllAsTouched();
    if (this.forma.invalid || this.radi()) return;

    this.radi.set(true);
    this.greska.set(null);

    try {
      const { username, password } = this.forma.getRawValue();
      await this.auth.login(username, password);

      // guard je zapamtio kamo je korisnik htio prije preusmjeravanja na prijavu
      const povratak = this.route.snapshot.queryParamMap.get('povratak');
      this.router.navigateByUrl(povratak || '/lampe');
    } catch (e) {
      this.greska.set(porukaGreske(e));
    } finally {
      this.radi.set(false);
    }
  }
}

export function porukaGreske(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'Poslužitelj nije dostupan. Radi li backend?';
    const body = e.error as ApiErrorBody | undefined;
    if (body?.details) return Object.values(body.details).join(' ');
    if (body?.error) return body.error;
  }
  return 'Došlo je do greške. Pokušajte ponovno.';
}
