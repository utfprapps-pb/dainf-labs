import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    localStorage.clear();
    service = new TokenService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('setToken', () => {
    it('stores the token in localStorage', () => {
      service.setToken('my-token');
      expect(localStorage.getItem('access_token')).toBe('my-token');
    });

    it('overwrites a previously stored token', () => {
      service.setToken('old-token');
      service.setToken('new-token');
      expect(localStorage.getItem('access_token')).toBe('new-token');
    });
  });

  describe('getToken', () => {
    it('returns null when nothing is stored', () => {
      expect(service.getToken()).toBeNull();
    });

    it('returns the token set via setToken', () => {
      service.setToken('my-token');
      expect(service.getToken()).toBe('my-token');
    });

    it('reads token from localStorage when in-memory value is null', () => {
      localStorage.setItem('access_token', 'persisted-token');
      // New instance has no in-memory value but localStorage has the token
      const freshInstance = new TokenService();
      expect(freshInstance.getToken()).toBe('persisted-token');
    });

    it('prefers the in-memory value over localStorage', () => {
      service.setToken('memory-token');
      // Tamper with localStorage behind the service's back
      localStorage.setItem('access_token', 'stale-storage-token');
      expect(service.getToken()).toBe('memory-token');
    });
  });

  describe('clearToken', () => {
    it('removes the token from localStorage', () => {
      service.setToken('my-token');
      service.clearToken();
      expect(localStorage.getItem('access_token')).toBeNull();
    });

    it('makes getToken return null after clearing', () => {
      service.setToken('my-token');
      service.clearToken();
      expect(service.getToken()).toBeNull();
    });

    it('does not throw when called with no token stored', () => {
      expect(() => service.clearToken()).not.toThrow();
    });
  });

  describe('persistence across instances', () => {
    it('token set in one instance is visible to a new instance via localStorage', () => {
      service.setToken('shared-token');
      const anotherInstance = new TokenService();
      expect(anotherInstance.getToken()).toBe('shared-token');
    });

    it('token cleared in one instance is gone in a new instance', () => {
      service.setToken('shared-token');
      service.clearToken();
      const anotherInstance = new TokenService();
      expect(anotherInstance.getToken()).toBeNull();
    });
  });
});
