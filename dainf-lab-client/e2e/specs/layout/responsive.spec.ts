import { makeCategory } from '../../fixtures/data';
import { expect, test } from '../../fixtures/test';
import { CrudPage } from '../../pages/crud-page';
import type { Page } from '@playwright/test';

const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 820, height: 1180 };
const DESKTOP = { width: 1440, height: 900 };

/** Nenhuma rolagem horizontal da página: o conteúdo cabe na largura da tela. */
const noHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
};

const sidebarVisible = async (page: Page) => {
  const box = await page.locator('app-menu').boundingBox();
  const vw = page.viewportSize()!.width;
  return !!box && box.x + box.width > 0 && box.x < vw && box.width > 0;
};

test.describe('Responsividade — celular (375px)', () => {
  test.use({ viewport: MOBILE });

  test('menu lateral começa recolhido e o hambúrguer abre e fecha', async ({ page, loginAs }) => {
    await loginAs('ROLE_ADMIN');
    await page.goto('/dashboard');
    await expect(page.locator('app-stat').first()).toBeVisible();
    expect(await sidebarVisible(page)).toBe(false);

    await page.locator('.layout-menu-button').click();
    await expect.poll(() => sidebarVisible(page)).toBe(true);
    await expect(page.locator('app-menu').getByText('Categorias', { exact: true })).toBeVisible();

    await page.locator('.layout-mask').click({ position: { x: MOBILE.width - 10, y: 400 } });
    await expect.poll(() => sidebarVisible(page)).toBe(false);
  });

  test('escolher um item do menu navega e recolhe o menu', async ({ page, loginAs }) => {
    await loginAs('ROLE_ADMIN');
    await page.goto('/dashboard');
    await page.locator('.layout-menu-button').click();

    await page.locator('app-menu').getByText('Categorias', { exact: true }).click();

    await expect(page).toHaveURL(/\/category$/);
    await expect.poll(() => sidebarVisible(page)).toBe(false);
  });

  test('dashboard empilha os cartões em uma coluna sem rolagem horizontal', async ({ page, loginAs }) => {
    await loginAs('ROLE_ADMIN');
    await page.goto('/dashboard');
    const cards = page.locator('app-stat');
    await expect(cards).toHaveCount(4);

    const a = await cards.nth(0).boundingBox();
    const b = await cards.nth(1).boundingBox();
    expect(Math.abs(a!.x - b!.x)).toBeLessThan(2); // mesma coluna
    expect(b!.y).toBeGreaterThan(a!.y);
    await noHorizontalOverflow(page);
  });

  test('cadastro continua utilizável: lista, filtros e novo registro', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('categories', [makeCategory(1, 'Cabos'), makeCategory(2, 'Sensores')] as any);
    const crud = new CrudPage(page, 'category');
    await crud.goto();

    await expect(crud.row('Cabos')).toBeVisible();
    await expect(crud.newButton).toBeVisible();
    await crud.openFilters();
    await crud.closeFilters();

    await crud.newButton.click();
    await expect(crud.dialog).toBeVisible();
    const box = await crud.dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(MOBILE.width + 1);
    await expect(crud.saveButton).toBeInViewport();
    await crud.cancelButton.click();
    await expect(crud.dialog).toBeHidden();
  });

  test('login cabe na tela', async ({ page, api }) => {
    void api;
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test('atalhos do topo (tema, carrinho, perfil) continuam acessíveis', async ({ page, loginAs }) => {
    await loginAs('ROLE_STUDENT');
    await page.goto('/dashboard');

    await expect(page.locator('.layout-topbar')).toBeVisible();
    await page.locator('.layout-topbar-menu-button').click();
    await expect(page.locator('.layout-topbar-menu')).toBeVisible();
  });
});

test.describe('Responsividade — tablet (820px)', () => {
  test.use({ viewport: TABLET });

  test('menu lateral recolhido e conteúdo sem rolagem horizontal', async ({ page, loginAs }) => {
    await loginAs('ROLE_ADMIN');
    await page.goto('/dashboard');
    await expect(page.locator('app-stat')).toHaveCount(4);

    expect(await sidebarVisible(page)).toBe(false);
    await noHorizontalOverflow(page);
  });

  test('cartões do dashboard ficam em duas colunas', async ({ page, loginAs }) => {
    await loginAs('ROLE_ADMIN');
    await page.goto('/dashboard');
    const cards = page.locator('app-stat');
    await expect(cards).toHaveCount(4);

    const a = await cards.nth(0).boundingBox();
    const b = await cards.nth(1).boundingBox();
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2); // lado a lado
  });
});

test.describe('Responsividade — desktop (1440px)', () => {
  test.use({ viewport: DESKTOP });

  test('menu lateral fixo visível e cartões em uma linha', async ({ page, loginAs }) => {
    await loginAs('ROLE_ADMIN');
    await page.goto('/dashboard');
    const cards = page.locator('app-stat');
    await expect(cards).toHaveCount(4);

    expect(await sidebarVisible(page)).toBe(true);
    const ys = await Promise.all([0, 1, 2, 3].map(async (i) => (await cards.nth(i).boundingBox())!.y));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
    await noHorizontalOverflow(page);
  });
});
