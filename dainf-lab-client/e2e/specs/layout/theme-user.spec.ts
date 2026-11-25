import { makeUser } from '../../fixtures/data';
import type { Role } from '../../fixtures/roles';
import { expect, test } from '../../fixtures/test';

const themeBtn = (page: import('@playwright/test').Page) => page.locator('.layout-config-menu > button').first();

test.describe('Tema', () => {
  test('alternar para escuro aplica a classe, troca o ícone e persiste no recarregar', async ({ page, loginAs }) => {
    await loginAs('ROLE_ADMIN');
    await page.goto('/dashboard');
    await expect(page.locator('html')).not.toHaveClass(/app-dark/);
    await expect(themeBtn(page).locator('.pi-sun')).toBeVisible();

    await themeBtn(page).click();

    await expect(page.locator('html')).toHaveClass(/app-dark/);
    await expect(themeBtn(page).locator('.pi-moon')).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/app-dark/);
  });

  test('alternar de volta para claro remove a classe', async ({ page, loginAs }) => {
    await loginAs('ROLE_ADMIN');
    await page.goto('/dashboard');

    await themeBtn(page).click();
    await expect(page.locator('html')).toHaveClass(/app-dark/);
    await themeBtn(page).click();

    await expect(page.locator('html')).not.toHaveClass(/app-dark/);
    await expect(themeBtn(page).locator('.pi-sun')).toBeVisible();
  });

  test('tema escuro continua legível no dashboard (gráfico e cartões renderizam)', async ({ page, loginAs }) => {
    await loginAs('ROLE_ADMIN');
    await page.goto('/dashboard');
    await themeBtn(page).click();

    await expect(page.locator('app-stat')).toHaveCount(4);
    await expect(page.locator('app-chart canvas')).toBeVisible();
  });
});

test.describe('Usuário logado — iniciais e rótulo do perfil', () => {
  const cases: [Role, string][] = [
    ['ROLE_ADMIN', 'Administrador'],
    ['ROLE_LAB_TECHNICIAN', 'Técnico de laboratório'],
    ['ROLE_PROFESSOR', 'Professor'],
    ['ROLE_STUDENT', 'Aluno'],
  ];

  for (const [role, label] of cases) {
    test(`${role} aparece como "${label}"`, async ({ page, loginAs }) => {
      await loginAs(role);
      await page.goto('/dashboard');

      await page.locator('app-user-dropdown button').first().click();
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    });
  }

  test('iniciais vêm do nome (duas primeiras letras)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.user = makeUser('ROLE_ADMIN', { nome: 'joana pereira lima' });
    await page.goto('/dashboard');

    await page.locator('app-user-dropdown button').first().click();
    await expect(page.locator('.p-popover, .p-menu, .p-tieredmenu').first()).toContainText('JP');
  });
});
