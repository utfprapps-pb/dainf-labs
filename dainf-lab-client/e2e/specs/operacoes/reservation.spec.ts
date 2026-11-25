import { makeItem, makeUser, pad } from '../../fixtures/data';
import { expect, test } from '../../fixtures/test';
import type { MockApi } from '../../mock-api/mock-api';
import { CrudPage } from '../../pages/crud-page';
import { crudSuite } from '../../pages/crud-suite';
import { fillDate, pickFromSearchSelect, toast } from '../../pages/primeng';

const owner = makeUser('ROLE_STUDENT', { id: 5, nome: 'Aluno Teste', documento: '2012345' });

const reservation = (i: number, over: Record<string, any> = {}) => ({
  id: i,
  description: `Reserva ${pad(i)}`,
  observation: '',
  reservationDate: '2026-11-10T12:00:00Z',
  withdrawalDate: '2026-11-15T12:00:00Z',
  user: owner,
  items: [{ id: i, quantity: 2, item: makeItem(1, { name: 'Arduino' }) }],
  ...over,
});

test.beforeEach(async ({ api }) => {
  api.db.seed('items', [makeItem(1, { name: 'Arduino' }), makeItem(2, { name: 'Protoboard' })] as any);
});

// O solicitante é a coluna única por linha; cada reserva do suite tem um solicitante distinto.
crudSuite({
  route: 'reservation',
  collection: 'reservations',
  title: 'Reservas',
  make: (i) => reservation(i, { user: makeUser('ROLE_STUDENT', { id: 100 + i, nome: `Solicitante ${pad(i)}` }) }),
  label: (i) => `Solicitante ${pad(i)}`,
  deletable: false,
});

const form = (crud: CrudPage) => crud.dialog;
const itemsGrid = (crud: CrudPage) => crud.dialog.locator('p-fieldset', { hasText: 'Itens da Reserva' });

async function addItem(page: import('@playwright/test').Page, crud: CrudPage, name: string, qty: number) {
  const grid = itemsGrid(crud);
  await pickFromSearchSelect(page, grid.locator('app-search-select'), name);
  await grid.locator('p-inputNumber input, p-input-number input').fill(String(qty));
  await grid.getByRole('button', { name: 'Adicionar' }).click();
}

test.describe('Reservas — específico', () => {
  test('lista datas formatadas e o usuário', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('reservations', [reservation(1)] as any);
    const crud = new CrudPage(page, 'reservation');
    await crud.goto();

    const row = crud.rows.first();
    await expect(row).toContainText('10/11/2026');
    await expect(row).toContainText('15/11/2026');
    await expect(row).toContainText('Aluno Teste');
  });

  test('aluno cria reserva com itens', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('reservations', []);
    const crud = new CrudPage(page, 'reservation');
    await crud.goto();

    await crud.openNew();
    await fillDate(form(crud).locator('p-datepicker').first(), '20/11/2026');
    await fillDate(form(crud).locator('p-datepicker').nth(1), '25/11/2026');
    await form(crud).locator('#description').fill('Projeto de IoT');
    await addItem(page, crud, 'Arduino', 3);
    await addItem(page, crud, 'Protoboard', 1);
    await expect(itemsGrid(crud).locator('tbody tr')).toHaveCount(2);
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    const body = api.callsTo('POST', '/reservations')[0].body;
    expect(body.description).toBe('Projeto de IoT');
    expect(body.reservationDate).toContain('2026-11-20');
    expect(body.withdrawalDate).toContain('2026-11-25');
    expect(body.items.map((i: any) => [i.item.name, i.quantity])).toEqual([
      ['Arduino', 3],
      ['Protoboard', 1],
    ]);
    await expect(crud.rows).toHaveCount(1);
  });

  test('exige datas e ao menos um item', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('reservations', []);
    const crud = new CrudPage(page, 'reservation');
    await crud.goto();

    await crud.openNew();
    await crud.save();

    await expect(toast(page, 'verifique os campos do formulário')).toBeVisible();
    expect(api.callsTo('POST', '/reservations')).toHaveLength(0);
  });

  test('retirada anterior à reserva é rejeitada', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('reservations', []);
    const crud = new CrudPage(page, 'reservation');
    await crud.goto();

    await crud.openNew();
    await fillDate(form(crud).locator('p-datepicker').first(), '25/11/2026');
    await fillDate(form(crud).locator('p-datepicker').nth(1), '20/11/2026');
    await addItem(page, crud, 'Arduino', 1);
    await crud.save();

    await expect(toast(page, 'verifique os campos do formulário')).toBeVisible();
    expect(api.callsTo('POST', '/reservations')).toHaveLength(0);
  });

  test('item da reserva exige quantidade mínima 1', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('reservations', []);
    const crud = new CrudPage(page, 'reservation');
    await crud.goto();

    await crud.openNew();
    await addItem(page, crud, 'Arduino', 0);

    await expect(itemsGrid(crud).locator('tbody tr').filter({ hasNot: page.locator('td[colspan]') })).toHaveCount(0);
  });

  test('editar carrega datas e itens da reserva', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('reservations', [reservation(1)] as any);
    const crud = new CrudPage(page, 'reservation');
    await crud.goto();

    await crud.openEdit('Aluno Teste');
    await expect(form(crud).locator('p-datepicker').first().locator('input')).toHaveValue('10/11/2026');
    await expect(form(crud).locator('p-datepicker').nth(1).locator('input')).toHaveValue('15/11/2026');
    await expect(itemsGrid(crud).locator('tbody tr')).toContainText('Arduino');

    await form(crud).locator('#description').fill('Descrição nova');
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    expect(api.callsTo('PUT', '/reservations/1')[0].body.description).toBe('Descrição nova');
  });

  test('filtra por código', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('reservations', [reservation(1), reservation(2), reservation(3)] as any);
    const crud = new CrudPage(page, 'reservation');
    await crud.goto();

    await crud.openFilters();
    await crud.filterField('Código').fill('2');

    await expect(crud.rows).toHaveCount(1);
    await expect(crud.rows.first()).toContainText('2');
  });
});

test.describe('Reservas — gerar empréstimo', () => {
  const seedReservation = (api: MockApi) => api.db.seed('reservations', [reservation(1)] as any);

  test('aluno não vê "Gerar Empréstimo"', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    seedReservation(api);
    const crud = new CrudPage(page, 'reservation');
    await crud.goto();

    await expect(crud.rows.first().locator('button:has(.pi-pencil)')).toBeVisible();
    await expect(crud.rows.first().locator('button:has(.pi-sign-out)')).toHaveCount(0);
  });

  test('laboratório gera empréstimo: vai para /loan com o formulário pré-preenchido', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    seedReservation(api);
    api.db.seed('loans', []);
    const crud = new CrudPage(page, 'reservation');
    await crud.goto();

    await crud.rows.first().locator('button:has(.pi-sign-out)').click();

    await expect(page).toHaveURL(/\/loan$/);
    const loan = new CrudPage(page, 'loan');
    await expect(loan.dialog).toBeVisible();
    await expect(loan.dialog.locator('app-search-select input').first()).toHaveValue('Aluno Teste');
    await expect(loan.dialog.locator('p-fieldset', { hasText: 'Itens' }).locator('tbody tr')).toContainText('Arduino');
  });
});

test.describe('Reservas — a partir do carrinho', () => {
  test('"Criar Reserva" abre o formulário com os itens do carrinho e limpa o carrinho ao salvar', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.cart = [{ id: 1, quantity: 2, item: makeItem(1, { name: 'Arduino' }) }];
    api.db.seed('reservations', []);
    await page.goto('/dashboard');

    await page.locator('app-topbar button:has(.pi-shopping-cart)').click();
    await page.locator('.p-popover').getByRole('button', { name: 'Criar Reserva' }).click();

    const crud = new CrudPage(page, 'reservation');
    await expect(page).toHaveURL(/\/reservation$/);
    await expect(crud.dialog).toBeVisible();
    await expect(itemsGrid(crud).locator('tbody tr')).toContainText('Arduino');

    await fillDate(form(crud).locator('p-datepicker').first(), '20/11/2026');
    await fillDate(form(crud).locator('p-datepicker').nth(1), '25/11/2026');
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    expect(api.callsTo('POST', '/reservations')[0].body.items[0]).toMatchObject({ quantity: 2, item: { id: 1 } });
    await expect.poll(() => api.callsTo('PUT', '/carts').at(-1)?.body).toEqual([]);
  });
});
