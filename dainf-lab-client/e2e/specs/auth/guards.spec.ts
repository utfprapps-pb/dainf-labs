import { ALL_ROUTES, routesFor, type Role } from '../../fixtures/roles';
import { expect, test } from '../../fixtures/test';

test.describe('Guards de rota', () => {
  test('sem token redireciona para /login', async ({ page, api: _api }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('rota inexistente cai em not-found', async ({ page, loginAs }) => {
    await loginAs('ROLE_ADMIN');
    await page.goto('/rota-que-nao-existe');
    await expect(page).toHaveURL(/\/not-found$/);
  });

  test('token expirado: 401 dispara refresh e a sessão continua', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.failNext('GET', '/menu', 401, {}, 1);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect.poll(() => api.callsTo('POST', '/auth/refresh').length).toBe(1);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('access_token')))
      .toBe('fake-jwt-token-refreshed');
    await expect(page.locator('app-menu')).toContainText('Dashboard');
  });

  test('refresh falhando derruba a sessão e volta para /login', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.failNext('GET', '/menu', 401, {}, 1);
    api.failNext('POST', '/auth/refresh', 401);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
  });
});

const ROLES: Role[] = ['ROLE_ADMIN', 'ROLE_LAB_TECHNICIAN', 'ROLE_PROFESSOR', 'ROLE_STUDENT'];

for (const role of ROLES) {
  test.describe(`Permissões de rota — ${role}`, () => {
    const allowed = routesFor(role);
    const denied = ALL_ROUTES.filter((r) => !allowed.includes(r));

    for (const route of allowed) {
      test(`acessa /${route}`, async ({ page, loginAs }) => {
        await loginAs(role);
        await page.goto(`/${route}`);
        await expect(page).toHaveURL(new RegExp(`/${route}$`));
      });
    }

    for (const route of denied) {
      test(`é bloqueado em /${route}`, async ({ page, loginAs }) => {
        await loginAs(role);
        await page.goto(`/${route}`);
        await expect(page).not.toHaveURL(new RegExp(`/${route}$`));
      });
    }
  });
}
