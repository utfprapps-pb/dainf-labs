import { makeItem, makeUser, pad } from '../../fixtures/data';
import { expect, test } from '../../fixtures/test';
import { CrudPage } from '../../pages/crud-page';
import { crudSuite } from '../../pages/crud-suite';
import { ddmmyyyy, fillDate, pickFromSearchSelect, toast } from '../../pages/primeng';
import type { Page } from '@playwright/test';

const staff = (i: number) => makeUser('ROLE_LAB_TECHNICIAN', { id: 50 + i, nome: `Responsável ${pad(i)}`, documento: `30${pad(i)}00` });

test.beforeEach(async ({ api }) => {
  api.db.seed('items', [makeItem(1, { name: 'Arduino' }), makeItem(2, { name: 'Protoboard' })] as any);
});

const itemsGrid = (crud: CrudPage, legend: string) => crud.dialog.locator('p-fieldset', { hasText: legend });

async function addItem(page: Page, crud: CrudPage, legend: string, name: string, qty: number) {
  const g = itemsGrid(crud, legend);
  await pickFromSearchSelect(page, g.locator('app-search-select'), name);
  await g.locator('p-inputNumber input, p-input-number input').first().fill(String(qty));
  await g.getByRole('button', { name: 'Adicionar' }).click();
}

// ───────────────────────── Solicitações de compra ─────────────────────────

const solicitation = (i: number, over: Record<string, any> = {}) => ({
  id: i,
  date: '2026-11-10T12:00:00Z',
  user: staff(i),
  observation: `Precisamos de ${i} peças`,
  items: [{ id: i, quantity: 4, item: makeItem(1, { name: 'Arduino' }) }],
  ...over,
});

crudSuite({
  route: 'purchase-solicitation',
  collection: 'solicitations',
  title: 'Solicitações de Compras',
  role: 'ROLE_LAB_TECHNICIAN',
  make: (i) => solicitation(i),
  label: (i) => `Responsável ${pad(i)}`,
});

test.describe('Solicitações de compra — específico', () => {
  test('lista data, responsável e observação', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('solicitations', [solicitation(1)] as any);
    const crud = new CrudPage(page, 'purchase-solicitation');
    await crud.goto();

    await expect(crud.rows.first()).toContainText('10/11/2026');
    await expect(crud.rows.first()).toContainText('Responsável 001');
    await expect(crud.rows.first()).toContainText('Precisamos de 1 peças');
  });

  test('cria solicitação (data padrão = hoje) com itens', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('solicitations', []);
    const crud = new CrudPage(page, 'purchase-solicitation');
    await crud.goto();

    await crud.openNew();
    await expect(crud.dialog.locator('p-datepicker input')).toHaveValue(ddmmyyyy(new Date()));
    await crud.dialog.locator('textarea').fill('Reposição de estoque');
    await addItem(page, crud, 'Itens da Compra', 'Arduino', 10);
    await addItem(page, crud, 'Itens da Compra', 'Protoboard', 5);
    await expect(itemsGrid(crud, 'Itens da Compra').locator('tbody tr')).toHaveCount(2);
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    const body = api.callsTo('POST', '/solicitations')[0].body;
    expect(body.observation).toBe('Reposição de estoque');
    expect(body.items.map((i: any) => [i.item.name, i.quantity])).toEqual([
      ['Arduino', 10],
      ['Protoboard', 5],
    ]);
  });

  test('exige ao menos um item', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('solicitations', []);
    const crud = new CrudPage(page, 'purchase-solicitation');
    await crud.goto();

    await crud.openNew();
    await crud.save();

    await expect(toast(page, 'verifique os campos do formulário')).toBeVisible();
    expect(api.callsTo('POST', '/solicitations')).toHaveLength(0);
  });

  test('editar carrega itens e permite alterar a observação', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('solicitations', [solicitation(1)] as any);
    const crud = new CrudPage(page, 'purchase-solicitation');
    await crud.goto();

    await crud.openEdit('Responsável 001');
    await expect(itemsGrid(crud, 'Itens da Compra').locator('tbody tr')).toContainText('Arduino');
    await crud.dialog.locator('textarea').fill('Atualizado');
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    expect(api.callsTo('PUT', '/solicitations/1')[0].body.observation).toBe('Atualizado');
  });

  test('filtra por código e responsável', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('solicitations', [solicitation(1), solicitation(2), solicitation(3)] as any);
    api.db.seed('users', [staff(1), staff(2), staff(3)] as any);
    const crud = new CrudPage(page, 'purchase-solicitation');
    await crud.goto();
    await crud.openFilters();

    await crud.filterField('Código').fill('2');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Responsável 002')).toHaveCount(1);
    await crud.filterField('Código').fill('');
    await expect(crud.rows).toHaveCount(3);

    await pickFromSearchSelect(page, crud.drawer.locator('app-search-select'), 'Responsável 003');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Responsável 003')).toHaveCount(1);
  });

  test('aluno não acessa solicitações de compra', async ({ page, loginAs }) => {
    await loginAs('ROLE_STUDENT');
    await page.goto('/purchase-solicitation');
    await expect(page).not.toHaveURL(/\/purchase-solicitation$/);
  });
});

// ───────────────────────────── Saídas de estoque ─────────────────────────────

const issue = (i: number, over: Record<string, any> = {}) => ({
  id: i,
  date: '2026-11-10T12:00:00Z',
  user: staff(i),
  observation: `Saída ${i}`,
  items: [{ id: i, quantity: 2, item: makeItem(1, { name: 'Arduino' }) }],
  ...over,
});

crudSuite({
  route: 'issue',
  collection: 'issues',
  title: 'Saídas de Estoque',
  role: 'ROLE_LAB_TECHNICIAN',
  make: (i) => issue(i),
  label: (i) => `Responsável ${pad(i)}`,
  deletable: false, // Saídas não permite exclusão
});

test.describe('Saídas de estoque — específico', () => {
  test('lista data, responsável e observações', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('issues', [issue(1)] as any);
    const crud = new CrudPage(page, 'issue');
    await crud.goto();

    await expect(crud.rows.first()).toContainText('10/11/2026');
    await expect(crud.rows.first()).toContainText('Responsável 001');
    await expect(crud.rows.first()).toContainText('Saída 1');
    await expect(crud.rows.first().locator('button:has(.pi-trash)')).toHaveCount(0);
  });

  test('registra saída com data e itens', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('issues', []);
    const crud = new CrudPage(page, 'issue');
    await crud.goto();

    await crud.openNew();
    await fillDate(crud.dialog.locator('p-datepicker'), '21/11/2026');
    await crud.dialog.locator('#observation').fill('Descarte por defeito');
    await addItem(page, crud, 'Itens da Saída', 'Arduino', 3);
    await expect(itemsGrid(crud, 'Itens da Saída').locator('tbody tr')).toHaveCount(1);
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    const body = api.callsTo('POST', '/issues')[0].body;
    expect(body.date).toContain('2026-11-21');
    expect(body.observation).toBe('Descarte por defeito');
    expect(body.items[0]).toMatchObject({ quantity: 3, item: { name: 'Arduino' } });
  });

  test('exige data e ao menos um item', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('issues', []);
    const crud = new CrudPage(page, 'issue');
    await crud.goto();

    await crud.openNew();
    await crud.save();

    await expect(toast(page, 'verifique os campos do formulário')).toBeVisible();
    expect(api.callsTo('POST', '/issues')).toHaveLength(0);
  });

  test('erro do servidor (estoque insuficiente) mantém o dialog aberto', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('issues', []);
    api.failNext('POST', '/issues', 422, { message: 'Estoque insuficiente' });
    const crud = new CrudPage(page, 'issue');
    await crud.goto();

    await crud.openNew();
    await fillDate(crud.dialog.locator('p-datepicker'), '21/11/2026');
    await addItem(page, crud, 'Itens da Saída', 'Arduino', 999);
    await crud.save();

    await expect(toast(page, 'Estoque insuficiente')).toBeVisible();
    await expect(crud.dialog).toBeVisible();
  });

  test('editar abre os itens em modo leitura (sem Adicionar)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('issues', [issue(1)] as any);
    const crud = new CrudPage(page, 'issue');
    await crud.goto();

    await crud.openEdit('Responsável 001');

    await expect(crud.dialog.locator('p-datepicker input')).toHaveValue('10/11/2026');
    await expect(itemsGrid(crud, 'Itens da Saída').locator('tbody tr')).toContainText('Arduino');
    await expect(itemsGrid(crud, 'Itens da Saída').getByRole('button', { name: 'Adicionar' })).toHaveCount(0);
  });

  test('filtra por código, responsável e RA/SIAPE', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('issues', [issue(1), issue(2), issue(3)] as any);
    api.db.seed('users', [staff(1), staff(2), staff(3)] as any);
    const crud = new CrudPage(page, 'issue');
    await crud.goto();
    await crud.openFilters();

    await crud.filterField('Código').fill('2');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Responsável 002')).toHaveCount(1);
    await crud.filterField('Código').fill('');

    await crud.filterField('RA/SIAPE').fill('000300');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Responsável 003')).toHaveCount(1);
    await crud.filterField('RA/SIAPE').fill('');

    await pickFromSearchSelect(page, crud.drawer.locator('app-search-select'), 'Responsável 001');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Responsável 001')).toHaveCount(1);
  });

  test('filtro por data envia intervalo do dia (BETWEEN)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('issues', [issue(1), issue(2, { date: '2026-11-12T12:00:00Z' })] as any);
    const crud = new CrudPage(page, 'issue');
    await crud.goto();
    await crud.openFilters();

    await fillDate(crud.drawer.locator('p-datepicker'), '12/11/2026');

    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Responsável 002')).toHaveCount(1);
    const f = api.callsTo('POST', '/issues/search').at(-1)!.body.filters.find((x: any) => x.field === 'date');
    expect(f.type).toBe('BETWEEN');
  });

  test('aluno não acessa saídas', async ({ page, loginAs }) => {
    await loginAs('ROLE_STUDENT');
    await page.goto('/issue');
    await expect(page).not.toHaveURL(/\/issue$/);
  });
});
