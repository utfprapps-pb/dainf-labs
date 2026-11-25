import { menuFor, type Role } from '../../fixtures/roles';
import { expect, test } from '../../fixtures/test';

const ROLES: Role[] = ['ROLE_ADMIN', 'ROLE_LAB_TECHNICIAN', 'ROLE_PROFESSOR', 'ROLE_STUDENT'];

for (const role of ROLES) {
  test(`menu lateral mostra apenas o que ${role} pode acessar`, async ({ page, loginAs }) => {
    await loginAs(role);
    await page.goto('/dashboard');

    const menu = page.locator('app-menu');
    const expected = menuFor(role).items.flatMap((g) => g.items.map((i) => i.label));
    const all = menuFor('ROLE_ADMIN').items.flatMap((g) => g.items.map((i) => i.label));

    for (const label of expected) {
      await expect(menu.getByText(label, { exact: true })).toBeVisible();
    }
    for (const label of all.filter((l) => !expected.includes(l))) {
      await expect(menu.getByText(label, { exact: true })).toHaveCount(0);
    }
  });
}

test('clicar em um item do menu navega para a rota', async ({ page, loginAs }) => {
  await loginAs('ROLE_ADMIN');
  await page.goto('/dashboard');

  await page.locator('app-menu').getByText('Categorias', { exact: true }).click();
  await expect(page).toHaveURL(/\/category$/);
});

test('menu do usuário: perfil e logout', async ({ page, loginAs }) => {
  const api = await loginAs('ROLE_ADMIN');
  await page.goto('/dashboard');

  await page.locator('app-user-dropdown button').click();
  await expect(page.getByText('maria@utfpr.edu.br')).toBeVisible();
  await page.getByRole('menuitem', { name: 'Meu perfil' }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await page.locator('app-user-dropdown button').click();
  // O overlay anterior do p-menu (appendTo=body) pode ainda estar no DOM; usa o mais recente.
  await page.getByRole('menuitem', { name: 'Logout' }).last().click();

  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
  expect(api.callsTo('POST', '/auth/logout')).toHaveLength(1);
});
