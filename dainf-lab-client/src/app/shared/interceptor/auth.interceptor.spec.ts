import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { TokenService } from '@/pages/auth/services/token.service';
import { AuthService, AuthResponse } from '@/pages/auth/services/auth.service';
import { EnvironmentService } from '../services/config.service';

const API_URL = 'http://localhost:8080/api';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let tokenService: TokenService;
  let router: Router;
  let mockAuthService: jasmine.SpyObj<Pick<AuthService, 'refresh'>>;

  beforeEach(() => {
    mockAuthService = {
      refresh: jasmine.createSpy('refresh'),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        TokenService,
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: EnvironmentService,
          useValue: { apiUrl: API_URL },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    tokenService = TestBed.inject(TokenService);
    router = TestBed.inject(Router);
    localStorage.clear();
  });

  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  // -------------------------------------------------------------------------
  // Request enrichment
  // -------------------------------------------------------------------------

  it('adds Authorization header for API calls when token is present', () => {
    tokenService.setToken('my-access-token');
    http.get(`${API_URL}/items`).subscribe();

    const req = controller.expectOne(`${API_URL}/items`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-access-token');
    req.flush({});
  });

  it('does not add Authorization header for API calls when no token', () => {
    http.get(`${API_URL}/items`).subscribe();

    const req = controller.expectOne(`${API_URL}/items`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('sets withCredentials: true for API calls (so refresh cookie is sent)', () => {
    http.get(`${API_URL}/items`).subscribe();

    const req = controller.expectOne(`${API_URL}/items`);
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });

  it('sets withCredentials: true for API calls even without a token', () => {
    // No token in storage — refresh cookie must still be sent
    http.post(`${API_URL}/auth/refresh`, {}).subscribe({ error: () => {} });

    const req = controller.expectOne(`${API_URL}/auth/refresh`);
    expect(req.request.withCredentials).toBeTrue();
    req.flush({}, { status: 200, statusText: 'OK' });
  });

  it('sets withCredentials: false for non-API calls', () => {
    http.get('http://other-service.com/data').subscribe({ error: () => {} });

    const req = controller.expectOne('http://other-service.com/data');
    expect(req.request.withCredentials).toBeFalse();
    req.flush({});
  });

  // -------------------------------------------------------------------------
  // 401 handling — successful refresh
  // -------------------------------------------------------------------------

  it('on 401 calls refresh and retries the original request with new token', () => {
    tokenService.setToken('expired-token');
    mockAuthService.refresh.and.returnValue(
      of({ token: 'new-token', expiresIn: 3600 } as AuthResponse)
    );

    let responseBody: any;
    http.get(`${API_URL}/items`).subscribe((res) => (responseBody = res));

    // First attempt — server rejects with 401
    const first = controller.expectOne(`${API_URL}/items`);
    first.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    // Interceptor must retry with the refreshed token
    const retry = controller.expectOne(`${API_URL}/items`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    retry.flush({ data: 'ok' });

    expect(responseBody).toEqual({ data: 'ok' });
  });

  it('stores the new token after a successful refresh', () => {
    tokenService.setToken('expired-token');
    mockAuthService.refresh.and.returnValue(
      of({ token: 'refreshed-token', expiresIn: 3600 } as AuthResponse)
    );

    http.get(`${API_URL}/items`).subscribe();

    controller.expectOne(`${API_URL}/items`).flush(
      'Unauthorized', { status: 401, statusText: 'Unauthorized' }
    );
    controller.expectOne(`${API_URL}/items`).flush({});

    expect(tokenService.getToken()).toBe('refreshed-token');
  });

  // -------------------------------------------------------------------------
  // 401 handling — refresh fails
  // -------------------------------------------------------------------------

  it('on 401 from /auth/refresh clears token and navigates to /login', () => {
    spyOn(router, 'navigate');
    tokenService.setToken('some-token');

    http.post(`${API_URL}/auth/refresh`, {}).subscribe({ error: () => {} });

    controller.expectOne(`${API_URL}/auth/refresh`).flush(
      'Unauthorized', { status: 401, statusText: 'Unauthorized' }
    );

    expect(tokenService.getToken()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('on 401 from /auth/login clears token and navigates to /login', () => {
    spyOn(router, 'navigate');
    tokenService.setToken('some-token');

    http.post(`${API_URL}/auth/login`, {}).subscribe({ error: () => {} });

    controller.expectOne(`${API_URL}/auth/login`).flush(
      'Unauthorized', { status: 401, statusText: 'Unauthorized' }
    );

    expect(tokenService.getToken()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('when refresh call itself fails clears token and navigates to /login', () => {
    spyOn(router, 'navigate');
    tokenService.setToken('expired-token');
    mockAuthService.refresh.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401 }))
    );

    http.get(`${API_URL}/items`).subscribe({ error: () => {} });

    controller.expectOne(`${API_URL}/items`).flush(
      'Unauthorized', { status: 401, statusText: 'Unauthorized' }
    );

    expect(tokenService.getToken()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  // -------------------------------------------------------------------------
  // Non-401 errors
  // -------------------------------------------------------------------------

  it('passes non-401 errors through without attempting refresh', () => {
    let capturedError: HttpErrorResponse | undefined;
    http.get(`${API_URL}/items`).subscribe({ error: (e) => (capturedError = e) });

    controller.expectOne(`${API_URL}/items`).flush(
      'Server Error', { status: 500, statusText: 'Internal Server Error' }
    );

    expect(mockAuthService.refresh).not.toHaveBeenCalled();
    expect(capturedError?.status).toBe(500);
  });

  it('passes 403 errors through without attempting refresh', () => {
    let capturedError: HttpErrorResponse | undefined;
    http.get(`${API_URL}/items`).subscribe({ error: (e) => (capturedError = e) });

    controller.expectOne(`${API_URL}/items`).flush(
      'Forbidden', { status: 403, statusText: 'Forbidden' }
    );

    expect(mockAuthService.refresh).not.toHaveBeenCalled();
    expect(capturedError?.status).toBe(403);
  });
});
