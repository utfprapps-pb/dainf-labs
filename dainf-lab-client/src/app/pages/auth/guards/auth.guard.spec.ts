import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { TokenService } from '../services/token.service';

describe('AuthGuard', () => {
  let tokenService: TokenService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TokenService,
        provideRouter([]),
      ],
    });
    tokenService = TestBed.inject(TokenService);
    router = TestBed.inject(Router);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      AuthGuard({} as any, {} as any)
    );
  }

  it('returns true when a token is present', () => {
    tokenService.setToken('valid-token');
    expect(runGuard()).toBeTrue();
  });

  it('returns a UrlTree (not false) when no token is present', () => {
    const result = runGuard();
    expect(result).toBeInstanceOf(UrlTree);
  });

  it('redirects to /login when no token is present', () => {
    const result = runGuard() as UrlTree;
    const loginTree = router.createUrlTree(['/login']);
    expect(result.toString()).toBe(loginTree.toString());
  });

  it('returns true after a token is set', () => {
    // No token → would block
    expect(runGuard()).toBeInstanceOf(UrlTree);
    // Set token → allows
    tokenService.setToken('late-token');
    expect(runGuard()).toBeTrue();
  });

  it('blocks again after the token is cleared', () => {
    tokenService.setToken('valid-token');
    expect(runGuard()).toBeTrue();
    tokenService.clearToken();
    expect(runGuard()).toBeInstanceOf(UrlTree);
  });
});
