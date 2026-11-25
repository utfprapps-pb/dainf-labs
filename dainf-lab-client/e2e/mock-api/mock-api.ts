import type { Page, Route } from '@playwright/test';
import { makeUser, type TestUser } from '../fixtures/data';
import { menuFor, type Role } from '../fixtures/roles';
import { InMemoryDb } from './in-memory-db';

export const API_ORIGIN = 'http://api.test';
export const API_URL = `${API_ORIGIN}/api`;

export interface RecordedCall {
  method: string;
  path: string;
  body: any;
}

interface Failure {
  method: string;
  path: string | RegExp;
  status: number;
  body?: unknown;
  times: number;
}

interface Result {
  status?: number;
  body?: unknown;
}

type Handler = (ctx: {
  method: string;
  segments: string[];
  query: URLSearchParams;
  body: any;
}) => Result | undefined | Promise<Result | undefined>;

/**
 * API falsa por teste. Camadas, em ordem de prioridade:
 *  1. falhas injetadas (`failNext`)
 *  2. handlers customizados (`on`)
 *  3. endpoints base (auth, menu, users/me, carts, configuration)
 *  4. CRUD genérico sobre o InMemoryDb
 */
export class MockApi {
  readonly db = new InMemoryDb();
  readonly calls: RecordedCall[] = [];
  user: TestUser;
  private failures: Failure[] = [];
  private handlers: { method: string; path: string | RegExp; fn: Handler }[] = [];
  cart: any[] = [];

  constructor(public role: Role = 'ROLE_ADMIN') {
    this.user = makeUser(role);
    this.db.seed('users', [this.user]);
  }

  /** Faz a(s) próxima(s) chamada(s) que casarem responderem com erro. */
  failNext(method: string, path: string | RegExp, status: number, body: unknown = {}, times = 1) {
    this.failures.push({ method: method.toUpperCase(), path, status, body, times });
  }

  /** Handler customizado para endpoints fora do CRUD (retorne undefined para seguir o fluxo padrão). */
  on(method: string, path: string | RegExp, fn: Handler) {
    this.handlers.unshift({ method: method.toUpperCase(), path, fn });
  }

  callsTo(method: string, path: string | RegExp) {
    return this.calls.filter((c) => c.method === method.toUpperCase() && this.pathMatches(path, c.path));
  }

  async install(page: Page) {
    await page.route('**/config/config.json', (route) => route.fulfill({ json: { apiUrl: API_URL } }));
    await page.route(`${API_ORIGIN}/**`, (route) => this.handle(route));
  }

  private pathMatches(pattern: string | RegExp, path: string) {
    return typeof pattern === 'string' ? path === pattern : pattern.test(path);
  }

  private async handle(route: Route) {
    const req = route.request();
    const method = req.method().toUpperCase();
    const url = new URL(req.url());
    const headers = this.cors(req.headers()['origin']);

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers });
    }

    const path = url.pathname.replace(/^\/api/, '');
    let body: any;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    this.calls.push({ method, path, body });

    const result = await this.resolve(method, path, url.searchParams, body);
    if (result.body === undefined) {
      return route.fulfill({ status: result.status ?? 204, headers });
    }
    return route.fulfill({ status: result.status ?? 200, headers, json: result.body });
  }

  private cors(origin?: string) {
    return {
      'access-control-allow-origin': origin ?? '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    };
  }

  private async resolve(method: string, path: string, query: URLSearchParams, body: any): Promise<Result> {
    const failure = this.failures.find(
      (f) => f.method === method && this.pathMatches(f.path, path) && f.times > 0,
    );
    if (failure) {
      failure.times--;
      return { status: failure.status, body: failure.body };
    }

    const segments = path.split('/').filter(Boolean);

    for (const h of this.handlers) {
      if (h.method === method && this.pathMatches(h.path, path)) {
        const out = await h.fn({ method, segments, query, body });
        if (out) return out;
      }
    }

    // GET /returns/by-loan/{id}: 204 (sem corpo) quando o empréstimo ainda não tem devolução.
    if (method === 'GET' && segments[0] === 'returns' && segments[1] === 'by-loan') {
      const ret = this.db.all('returns').find((r) => r.loan?.id === Number(segments[2]));
      return ret ? { body: ret } : { status: 204 };
    }
    // GET /loans/borrower/{id}/pending e /loans/item/{id}/active|history: listas vazias por padrão.
    if (method === 'GET' && segments[0] === 'loans' && segments[1] === 'borrower' && segments[3] === 'pending') {
      return { body: [] };
    }
    return (
      this.base(method, segments, body) ??
      this.crud(method, segments, body) ?? {
        status: 404,
        body: { message: `MockApi: rota não mockada ${method} /${segments.join('/')}` },
      }
    );
  }

  private base(method: string, segments: string[], body: any): Result | undefined {
    switch (`${method} /${segments.join('/')}`) {
      case 'POST /auth/login':
        return { body: { token: 'fake-jwt-token', expiresIn: 3600 } };
      case 'POST /auth/refresh':
        return { body: { token: 'fake-jwt-token-refreshed', expiresIn: 3600 } };
      case 'POST /auth/logout':
      case 'POST /auth/sign-up':
      case 'POST /auth/recovery':
      case 'POST /auth/reset-password':
      case 'POST /auth/confirm-email/resend':
      case 'GET /auth/confirm-email':
        return { body: {} };
      case 'GET /menu':
        return { body: menuFor(this.role) };
      case 'GET /users/me':
        return { body: this.user };
      case 'PUT /users/me':
        this.user = { ...this.user, ...body };
        return { body: this.user };
      case 'GET /carts':
        return { body: this.cart };
      case 'PUT /carts':
        this.cart = body ?? [];
        return { body: this.cart };
      case 'GET /configuration':
        return { body: {} };
      case 'GET /dashboard':
        return {
          body: {
            loanSummary: { ongoingCount: 3, overdueCount: 1, completedCount: 8, totalCount: 12 },
            loanCountByDays: [
              { day: '2026-11-01', total: 2 },
              { day: '2026-11-02', total: 4 },
            ],
            lowStockItems: [],
            recentOperations: [],
          },
        };
      default:
        return undefined;
    }
  }

  private crud(method: string, [collection, id, ...rest]: string[], body: any): Result | undefined {
    if (!collection) return undefined;
    // Endpoints extras comuns aos cadastros.
    if (method === 'POST' && id === 'search' && rest[0] === 'all') return { body: this.db.search(collection, body) };
    if (method === 'PUT' && rest[0] === 'active' && !Number.isNaN(Number(id))) {
      const row = this.db.update(collection, Number(id), { active: body?.active });
      return row ? { body: row } : { status: 404, body: { message: 'Registro não encontrado' } };
    }
    if (rest.length) return undefined;
    const notFound: Result = { status: 404, body: { message: 'Registro não encontrado' } };

    if (method === 'POST' && id === 'search') return { body: this.db.search(collection, body) };
    // O CrudController do backend devolve apenas o id no POST/PUT.
    if (method === 'POST' && id === undefined) return { status: 201, body: this.db.create(collection, body).id };

    const numId = Number(id);
    if (Number.isNaN(numId)) return undefined;

    if (method === 'GET') {
      const row = this.db.find(collection, numId);
      return row ? { body: row } : notFound;
    }
    if (method === 'PUT') {
      const row = this.db.update(collection, numId, body);
      return row ? { body: row.id } : notFound;
    }
    if (method === 'DELETE') {
      return this.db.remove(collection, numId) ? { status: 204 } : notFound;
    }
    return undefined;
  }
}
