import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { porukaGreske } from '../login/login';

/// lozinke se moraju podudarati
function lozinkeJednake(group: AbstractControl): ValidationErrors | null {
  const a = group.get('password')?.value;
  const b = group.get('potvrda')?.value;
  return a && b && a !== b ? { neJednake: true } : null;
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: '../auth-forma.scss',
})
export class Register {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected greska = signal<string | null>(null);
  protected radi = signal(false);

  protected forma = this.fb.nonNullable.group(
    {
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50),
        Validators.pattern(/^[a-zA-Z0-9_.-]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      // ista donja granica kao na backendu; razlicite granice znace da obrazac
      // propusti lozinku koju poslužitelj odbije
      password: ['', [Validators.required, Validators.minLength(8)]],
      potvrda: ['', [Validators.required]],
    },
    { validators: lozinkeJednake },
  );

  protected async posalji(): Promise<void> {
    this.forma.markAllAsTouched();
    if (this.forma.invalid || this.radi()) return;

    this.radi.set(true);
    this.greska.set(null);

    try {
      const { username, email, password } = this.forma.getRawValue();
      await this.auth.register(username, email, password);
      this.router.navigateByUrl('/lampe');
    } catch (e) {
      this.greska.set(porukaGreske(e));
    } finally {
      this.radi.set(false);
    }
  }
}
