import { AuthService } from '@/pages/auth/services/auth.service';
import { TokenService } from '@/pages/auth/services/token.service';
import { HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, switchMap, throwError } from 'rxjs';
import { EnvironmentService } from '../services/config.service';

export function authInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const enviroment = inject(EnvironmentService);
  const router = inject(Router);
  const authToken = tokenService.getToken();

  const isApi = isAPICall(req.url, enviroment.apiUrl);
  const authReq = isApi
    ? req.clone({
        ...(authToken && { setHeaders: { Authorization: `Bearer ${authToken}` } }),
        withCredentials: true,
      })
    : req.clone({ withCredentials: false });

  return next(authReq).pipe(
    catchError((error) =>
      handleRefresh(req, next, error, authService, tokenService, router),
    ),
  );
}

function isAPICall(path: string, apiUrl: string) {
  return path.includes(apiUrl);
}

function handleRefresh(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  error: any,
  authService: AuthService,
  tokenService: TokenService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  if (error.status !== 401) return throwError(() => error);

  if (req.url.includes('/auth/refresh') || req.url.includes('/auth/login')) {
    tokenService.clearToken();
    router.navigate(['/login']);
    return throwError(() => error);
  }

  return authService.refresh().pipe(
    switchMap((res) => {
      tokenService.setToken(res.token);
      const newReq = req.clone({
        setHeaders: { Authorization: `Bearer ${res.token}` },
        withCredentials: true,
      });
      return next(newReq);
    }),
    catchError((refreshError) => {
      tokenService.clearToken();
      router.navigate(['/login']);
      return throwError(() => refreshError);
    }),
  );
}
