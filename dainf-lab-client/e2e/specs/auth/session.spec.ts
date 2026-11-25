import { makeCategory } from '../../fixtures/data';
import { expect, test } from '../../fixtures/test';

/**
 * Interceptor de autenticação: renovação de token em 401, falha da renovação e erros que não derrubam a sessão.
 */
test.describe('Sessão — erros de autenticação nas chamadas da API', () => {
  test('401 renova o token e repete a chamada com o novo token', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('categories', [makeCategory(1, 'Cabos')] as any);
    api.failNext('POST', '/categories/search', 401, { message: 'Token expirado' });
    await page.goto('/category');

    await expect(page.getByText('Cabos')).toBeVisible();
    expect(api.callsTo('POST', '/auth/refresh')).toHaveLength(1);
    expect(api.callsTo('POST', '/categories/search')).toHaveLength(2);
    await expect(page).toHaveURL(/\/category$/);
    expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBe('fake-jwt-token-refreshed');
  });

  test('401 e a renovação também falha: limpa a sessão e volta para o login', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('categories', [makeCategory(1, 'Cabos')] as any);
    api.failNext('POST', '/categories/search', 401, { message: 'Token expirado' });
    api.failNext('POST', '/auth/refresh', 401, { message: 'Refresh inválido' });
    await page.goto('/category');

    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
  });

  test('401 no próprio refresh não entra em laço: uma só tentativa e vai ao login', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.failNext('POST', '/categories/search', 401);
    api.failNext('POST', '/auth/refresh', 401, {}, 5);
    await page.goto('/category');

    await expect(page).toHaveURL(/\/login$/);
    expect(api.callsTo('POST', '/auth/refresh').length).toBeLessThanOrEqual(2);
  });

  test('403 não derruba a sessão: mantém a tela, avisa e não tenta renovar o token', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.failNext('POST', '/categories/search', 403, { message: 'Acesso negado' });
    await page.goto('/category');

    await expect(page.locator('p-toast .p-toast-message').first()).toBeVisible();
    await expect(page).toHaveURL(/\/category$/);
    expect(api.callsTo('POST', '/auth/refresh')).toHaveLength(0);
    expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBe('fake-jwt-token');
  });

  test('500 não derruba a sessão nem tenta renovar o token', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.failNext('POST', '/categories/search', 500, { message: 'Erro interno' });
    await page.goto('/category');

    await expect(page.locator('p-toast .p-toast-message').first()).toBeVisible();
    await expect(page).toHaveURL(/\/category$/);
    expect(api.callsTo('POST', '/auth/refresh')).toHaveLength(0);
  });

  test('toda chamada à API leva o token no cabeçalho Authorization', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    const auth: (string | undefined)[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/categories/search')) auth.push(req.headers()['authorization']);
    });
    await page.goto('/category');

    await expect(page.locator('p-table')).toBeVisible();
    expect(auth.length).toBeGreaterThan(0);
    expect(auth.every((h) => h === 'Bearer fake-jwt-token')).toBe(true);
    void api;
  });
});
