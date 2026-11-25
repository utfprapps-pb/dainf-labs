import { makeItem, makeUser } from '../../fixtures/data';
import { expect, test } from '../../fixtures/test';
import { installStockRules } from '../../fixtures/stock-rules';
import type { MockApi } from '../../mock-api/mock-api';
import { CrudPage } from '../../pages/crud-page';
import { fillDate, toast } from '../../pages/primeng';
import type { Page } from '@playwright/test';

const student = makeUser('ROLE_STUDENT', { id: 1, nome: 'Aluno Teste', documento: '2012345' });
const staff = makeUser('ROLE_LAB_TECHNICIAN', { id: 7, nome: 'Laboratorista Teste', documento: '3000100' });

/** Troca o usuário logado (mesmo token): o mock passa a responder /menu e /users/me do novo perfil. */
async function switchTo(api: MockApi, page: Page, user: ReturnType<typeof makeUser>, url: string) {
  api.role = user.role;
  api.user = user;
  await page.goto(url);
}

/** Toast de sucesso mais recente (toasts de etapas anteriores ainda podem estar na tela). */
const saved = (page: Page) => toast(page, 'Registro salvo com sucesso.').last();

async function setCell(dlg: ReturnType<Page['locator']>, name: string, col: 'returned' | 'issued', value: number) {
  const td = dlg.locator('tbody tr', { hasText: name }).locator('td').nth(col === 'returned' ? 4 : 5);
  await td.click();
  await td.locator('input').fill(String(value));
  await dlg.getByRole('heading', { name: 'Registrar Devolução' }).click();
}

test.describe('Fluxo completo: carrinho → reserva → empréstimo → devolução → histórico', () => {
  test('o estoque baixa no empréstimo, volta na devolução e tudo aparece no histórico', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    installStockRules(api);
    api.user = student;
    api.db.seed('users', [student, staff] as any);
    api.db.seed('items', [makeItem(1, { name: 'Arduino', quantity: 10 })] as any);
    api.db.seed('reservations', []);
    api.db.seed('loans', []);
    api.db.seed('returns', []);
    api.db.seed('inventory-transactions', []);

    // 1) Aluno monta o carrinho a partir do catálogo
    await page.goto('/item');
    await page.locator('.card .grid > div').filter({ hasText: 'Arduino' }).first().getByRole('button', { name: 'Ver detalhes' }).click();
    await page.locator('.p-dialog', { hasText: 'Arduino' }).getByRole('button', { name: 'Adicionar ao carrinho' }).click();
    await expect(toast(page, 'Arduino adicionado ao carrinho.')).toBeVisible();
    expect(api.cart).toHaveLength(1);

    // 2) ...e cria a reserva pelo carrinho
    await page.locator('app-topbar button:has(.pi-shopping-cart)').click();
    await page.locator('.p-popover').getByRole('button', { name: 'Criar Reserva' }).click();
    const reservation = new CrudPage(page, 'reservation');
    await expect(reservation.dialog).toBeVisible();
    await fillDate(reservation.dialog.locator('p-datepicker').first(), '20/11/2026');
    await fillDate(reservation.dialog.locator('p-datepicker').nth(1), '25/11/2026');
    await reservation.save();
    await expect(saved(page)).toBeVisible();
    expect(api.db.all('reservations')).toHaveLength(1);
    await expect.poll(() => api.cart).toEqual([]);

    // 3) Laboratório gera o empréstimo a partir da reserva
    await switchTo(api, page, staff, '/reservation');
    await reservation.waitForTable();
    // a lista recarrega quando o perfil termina de carregar; repete o clique até navegar
    await expect(async () => {
      await reservation.rows.first().locator('button:has(.pi-sign-out)').click({ timeout: 2000 });
      await expect(page).toHaveURL(/\/loan$/, { timeout: 2000 });
    }).toPass({ timeout: 15000 });
    const loan = new CrudPage(page, 'loan');
    await expect(loan.dialog).toBeVisible();
    await expect(loan.dialog.locator('app-search-select input').first()).toHaveValue('Aluno Teste');
    await fillDate(loan.dialog.locator('p-datepicker').nth(1), '30/12/2030');
    await loan.save();
    await expect(saved(page)).toBeVisible();

    // estoque baixou e o empréstimo está em aberto
    expect(api.db.find('items', 1)!.quantity).toBe(10 - api.db.all('loans')[0].items[0].quantity);
    await expect(loan.row('Aluno Teste')).toContainText('Em aberto');
    const borrowed = api.db.all('loans')[0].items[0].quantity as number;

    // 4) Devolução total
    await loan.rows.first().locator('button:has(.pi-undo)').click();
    const dlg = page.locator('.p-dialog', { hasText: 'Registrar Devolução' });
    await expect(dlg).toBeVisible();
    await setCell(dlg, 'Arduino', 'returned', borrowed);
    await dlg.getByRole('button', { name: 'Salvar' }).click();
    await expect(saved(page)).toBeVisible();

    // estoque voltou e o empréstimo foi finalizado
    expect(api.db.find('items', 1)!.quantity).toBe(10);
    await expect(loan.row('Aluno Teste')).toContainText('Finalizado');

    // 5) Histórico de estoque mostra as duas movimentações, com origem
    await page.goto('/inventory-history');
    const history = new CrudPage(page, 'inventory-history');
    await history.waitForTable();
    await expect(history.rows).toHaveCount(2);
    await expect(history.rows.filter({ hasText: 'Empréstimo #1' })).toContainText(String(10 - borrowed));
    await expect(history.rows.filter({ hasText: 'Devolução #1' })).toContainText('10');
    await expect(history.rows.filter({ hasText: 'Empréstimo #1' }).locator('.pi-arrow-down')).toHaveCount(1);
    await expect(history.rows.filter({ hasText: 'Devolução #1' }).locator('.pi-arrow-up')).toHaveCount(1);
  });

  test('devolução parcial mantém o empréstimo em aberto e o estoque só recupera o devolvido', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    installStockRules(api);
    api.user = staff;
    api.db.seed('users', [student, staff] as any);
    api.db.seed('items', [makeItem(1, { name: 'Arduino', quantity: 10 })] as any);
    api.db.seed('loans', []);
    api.db.seed('returns', []);
    api.db.seed('inventory-transactions', []);

    // empréstimo de 4 unidades criado pela tela
    await page.goto('/loan');
    const loan = new CrudPage(page, 'loan');
    await loan.waitForTable();
    await loan.openNew();
    await loan.dialog.locator('app-search-select').first().locator('.p-autocomplete-dropdown').click();
    await page.locator('.p-autocomplete-overlay').getByRole('option', { name: 'Aluno Teste' }).first().click();
    await fillDate(loan.dialog.locator('p-datepicker').nth(1), '30/12/2030');
    const grid = loan.dialog.locator('p-fieldset', { hasText: 'Itens' });
    await grid.locator('app-search-select .p-autocomplete-dropdown').click();
    await page.locator('.p-autocomplete-overlay').getByRole('option', { name: 'Arduino' }).first().click();
    await grid.locator('p-input-number input, p-inputNumber input').fill('4');
    await grid.getByRole('button', { name: 'Adicionar' }).click();
    await loan.save();
    await expect(saved(page)).toBeVisible();
    expect(api.db.find('items', 1)!.quantity).toBe(6);

    // devolve só 1 de 4
    await loan.rows.first().locator('button:has(.pi-undo)').click();
    const dlg = page.locator('.p-dialog', { hasText: 'Registrar Devolução' });
    await expect(dlg).toBeVisible();
    await setCell(dlg, 'Arduino', 'returned', 1);
    await dlg.getByRole('button', { name: 'Salvar' }).click();
    await expect(saved(page)).toBeVisible();

    expect(api.db.find('items', 1)!.quantity).toBe(7);
    await expect(loan.row('Aluno Teste')).toContainText('Em aberto');

    // reabrir a devolução mostra o que já foi devolvido (PUT na segunda vez)
    await loan.rows.first().locator('button:has(.pi-undo)').click();
    const again = page.locator('.p-dialog', { hasText: 'Registrar Devolução' });
    await expect(again).toBeVisible();
    await expect(again.locator('tbody tr', { hasText: 'Arduino' }).locator('td').nth(3)).toHaveText('3');
  });
});
