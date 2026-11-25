import { test as base, expect } from '@playwright/test';
import MCR from 'monocart-coverage-reports';
import { MockApi } from '../mock-api/mock-api';
import { coverageOptions } from '../coverage/options';
import type { Role } from './roles';

interface Fixtures {
  /** API falsa já instalada na página (sem sessão). */
  api: MockApi;
  /** Define a sessão (token) e o perfil do usuário e devolve a API. */
  loginAs: (role?: Role) => Promise<MockApi>;
  /** Liga a coleta de cobertura V8 (só com E2E_COVERAGE=1). */
  coverage: void;
}

const COVERAGE = !!process.env['E2E_COVERAGE'];

export const test = base.extend<Fixtures, { workerCoverage: MCR | undefined }>({
  // acumula a cobertura de todos os testes do worker e grava um relatório "raw" por worker
  workerCoverage: [
    async ({}, use, workerInfo) => {
      if (!COVERAGE) return use(undefined);
      const mcr = MCR(coverageOptions(`worker-${workerInfo.workerIndex}-${workerInfo.parallelIndex}`));
      await use(mcr);
      await mcr.generate();
    },
    { scope: 'worker', auto: true },
  ],

  coverage: [
    async ({ page, workerCoverage }, use) => {
      if (!workerCoverage) return use();
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
      await use();
      const entries = await page.coverage.stopJSCoverage();
      await workerCoverage.add(entries);
    },
    { auto: true },
  ],

  api: async ({ page }, use) => {
    const api = new MockApi();
    await api.install(page);
    await use(api);
  },

  loginAs: async ({ page, api }, use) => {
    await use(async (role: Role = 'ROLE_ADMIN') => {
      api.role = role;
      api.user = { ...api.user, role };
      api.db.update('users', api.user.id, { role });
      await page.addInitScript(() => localStorage.setItem('access_token', 'fake-jwt-token'));
      return api;
    });
  },
});

export { expect };
