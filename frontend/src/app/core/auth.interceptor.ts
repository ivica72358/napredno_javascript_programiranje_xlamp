import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/// dodaje Bearer token na svaki zahtjev i odjavljuje korisnika na 401
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      // prijava koja padne s 401 je pogresna lozinka, a ne istekla sesija - odjava
      // bi tu samo obrisala prazno stanje i sakrila poruku o gresci
      const isLoginAttempt = req.url.endsWith('/auth/login');
      if (err.status === 401 && !isLoginAttempt) {
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};
