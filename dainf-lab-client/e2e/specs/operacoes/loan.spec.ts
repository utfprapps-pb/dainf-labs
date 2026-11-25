import { makeItem, makeUser, pad } from '../../fixtures/data';
import type { Role } from '../../fixtures/roles';
import { expect, test } from '../../fixtures/test';
import type { MockApi } from '../../mock-api/mock-api';
import { CrudPage } from '../../pages/crud-page';
import { crudSuite } from '../../pages/crud-suite';
import { ddmmyyyy, fillDate, pickFromSearchSelect, selectOption, toast } from '../../pages/primeng';

const borrower = (i: number, over: Record<string, any> = {}) =>
  makeUser('ROLE_STUDENT', { id: 100 + i, nome: `Mutuário ${pad(i)}`, documento: `20${pad(i)}00`, ...over });

const loan = (i: number, over: Record<string, any> = {}) => ({
  id: i,
  borrower: borrower(i),
  loanDate: '2026-11-10T12:00:00Z',
  deadline: '2026-11-20T12:00:00Z',
  observation: '',
  status: 'ONGOING',
  items: [{ id: i, quantity: 3, shouldReturn: true, item: makeItem(1, { name: 'Arduino' }) }],
  ...over,
});

const seedLoans = (api: MockApi, loans: Record<string, any>[]) => api.db.seed('loans', loans as any);

test.beforeEach(async ({ api }) => {
  api.db.seed('items', [makeItem(1, { name: 'Arduino' }), makeItem(2, { name: 'Protoboard' })] as any);
  api.db.seed('users', [borrower(1), borrower(2), borrower(3)] as any);
});

crudSuite({
  route: 'loan',
  collection: 'loans',
  title: 'Empréstimos',
  make: (i) => loan(i),
  label: (i) => `Mutuário ${pad(i)}`,
  deletable: false,
});

const itemsGrid = (crud: CrudPage) => crud.dialog.locator('p-fieldset', { hasText: 'Itens' });

async function addItem(page: import('@playwright/test').Page, crud: CrudPage, name: string, qty: number) {
  const grid = itemsGrid(crud);
  await pickFromSearchSelect(page, grid.locator('app-search-select'), name);
  await grid.locator('p-input-number input, p-inputNumber input').fill(String(qty));
  await grid.getByRole('button', { name: 'Adicionar' }).click();
}

test.describe('Empréstimos — listagem', () => {
  test('mostra mutuário, datas e status traduzido', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seedLoans(api, [
      loan(1, { status: 'ONGOING' }),
      loan(2, { status: 'OVERDUE', deadline: '2026-10-01T12:00:00Z' }),
      loan(3, { status: 'COMPLETED' }),
    ]);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    await expect(crud.row('Mutuário 001')).toContainText('10/11/2026');
    await expect(crud.row('Mutuário 001')).toContainText('20/11/2026');
    await expect(crud.row('Mutuário 001')).toContainText('Em aberto');
    await expect(crud.row('Mutuário 002')).toContainText('Atrasado');
    await expect(crud.row('Mutuário 002')).toContainText('01/10/2026');
    await expect(crud.row('Mutuário 003')).toContainText('Finalizado');
  });

  test('filtros: código, RA/SIAPE e status', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seedLoans(api, [
      loan(1, { status: 'ONGOING' }),
      loan(2, { status: 'OVERDUE' }),
      loan(3, { status: 'COMPLETED' }),
    ]);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();
    await crud.openFilters();

    await crud.filterField('Código').fill('2');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Mutuário 002')).toHaveCount(1);
    await crud.filterField('Código').fill('');

    await crud.drawer.locator('#ra_siape').fill('000300');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Mutuário 003')).toHaveCount(1);
    await crud.drawer.locator('#ra_siape').fill('');

    const status = crud.drawer.locator('app-input-container', { hasText: 'Status' }).locator('app-static-select');
    await selectOption(page, status, 'Atrasado');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Mutuário 002')).toHaveCount(1);
    await selectOption(page, status, 'Finalizado');
    await expect(crud.row('Mutuário 003')).toHaveCount(1);
  });

  test('filtro por mutuário (busca de usuário)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seedLoans(api, [loan(1), loan(2), loan(3)]);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();
    await crud.openFilters();

    await pickFromSearchSelect(page, crud.drawer.locator('app-search-select'), 'Mutuário 002');

    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Mutuário 002')).toHaveCount(1);
    expect(api.callsTo('POST', '/loans/search').at(-1)!.body.filters).toContainEqual({
      field: 'borrower.id',
      value: 102,
      type: 'EQUALS',
    });
  });

  test('filtro por data do empréstimo envia intervalo do dia (BETWEEN)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seedLoans(api, [loan(1), loan(2, { loanDate: '2026-11-12T12:00:00Z' })]);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();
    await crud.openFilters();

    await fillDate(crud.drawer.locator('p-datepicker'), '12/11/2026');

    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Mutuário 002')).toHaveCount(1);
    const f = api.callsTo('POST', '/loans/search').at(-1)!.body.filters.find((x: any) => x.field === 'loanDate');
    expect(f.type).toBe('BETWEEN');
    expect(f.value).toHaveLength(2);
  });
});

test.describe('Empréstimos — criar (laboratório)', () => {
  test('cria empréstimo com mutuário, prazo e itens', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    seedLoans(api, []);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    await crud.openNew();
    await expect(crud.dialog.locator('p-datepicker').first().locator('input')).toHaveValue(ddmmyyyy(new Date()));
    await pickFromSearchSelect(page, crud.dialog.locator('app-search-select').first(), 'Mutuário 002');
    await fillDate(crud.dialog.locator('p-datepicker').nth(1), '30/12/2030');
    await crud.dialog.locator('textarea').fill('Para a feira de ciências');
    await addItem(page, crud, 'Arduino', 2);
    await addItem(page, crud, 'Protoboard', 1);
    await expect(itemsGrid(crud).locator('tbody tr')).toHaveCount(2);
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    const body = api.callsTo('POST', '/loans')[0].body;
    expect(body.borrower.nome).toBe('Mutuário 002');
    expect(body.deadline).toContain('2030-12-30');
    expect(body.observation).toBe('Para a feira de ciências');
    expect(body.items.map((i: any) => [i.item.name, i.quantity])).toEqual([
      ['Arduino', 2],
      ['Protoboard', 1],
    ]);
    await expect(crud.row('Mutuário 002')).toHaveCount(1);
  });

  test('exige mutuário, prazo e itens', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    seedLoans(api, []);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    await crud.openNew();
    await crud.save();

    await expect(toast(page, 'verifique os campos do formulário')).toBeVisible();
    expect(api.callsTo('POST', '/loans')).toHaveLength(0);
  });

  test('prazo anterior à data do empréstimo é rejeitado', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    seedLoans(api, []);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    await crud.openNew();
    await pickFromSearchSelect(page, crud.dialog.locator('app-search-select').first(), 'Mutuário 001');
    await fillDate(crud.dialog.locator('p-datepicker').nth(1), '01/01/2000');
    await addItem(page, crud, 'Arduino', 1);
    await crud.save();

    await expect(toast(page, 'verifique os campos do formulário')).toBeVisible();
    expect(api.callsTo('POST', '/loans')).toHaveLength(0);
  });

  test('quantidade abaixo de 1 é ajustada para 1 ao adicionar o item', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    seedLoans(api, []);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    await crud.openNew();
    await addItem(page, crud, 'Arduino', 0);

    await expect(itemsGrid(crud).locator('tbody tr')).toHaveCount(1);
    await expect(itemsGrid(crud).locator('tbody tr')).toContainText('Arduino');
    await expect(itemsGrid(crud).locator('tbody tr td').nth(1)).toHaveText('1');
  });

  test('erro do servidor (estoque insuficiente) mantém o dialog aberto', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    seedLoans(api, []);
    api.failNext('POST', '/loans', 422, { message: 'Estoque insuficiente para Arduino' });
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    await crud.openNew();
    await pickFromSearchSelect(page, crud.dialog.locator('app-search-select').first(), 'Mutuário 001');
    await fillDate(crud.dialog.locator('p-datepicker').nth(1), '30/12/2030');
    await addItem(page, crud, 'Arduino', 99);
    await crud.save();

    await expect(toast(page, 'Estoque insuficiente para Arduino')).toBeVisible();
    await expect(crud.dialog).toBeVisible();
  });

  test('editar abre o empréstimo com itens e mutuário bloqueados', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    seedLoans(api, [loan(1)]);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    await crud.openEdit('Mutuário 001');

    await expect(crud.dialog.locator('p-datepicker').first().locator('input')).toHaveValue('10/11/2026');
    await expect(crud.dialog.locator('p-datepicker').nth(1).locator('input')).toHaveValue('20/11/2026');
    await expect(itemsGrid(crud).locator('tbody tr')).toContainText('Arduino');
    await expect(itemsGrid(crud).getByRole('button', { name: 'Adicionar' })).toHaveCount(0);
    await expect(crud.dialog.locator('app-search-select input').first()).toBeDisabled();
  });
});

test.describe('Empréstimos — visão do aluno', () => {
  const asStudent = async (loginAs: (r?: Role) => Promise<MockApi>) => loginAs('ROLE_STUDENT');

  test('não vê "Novo" nem "Pendências" e usa "ver" em vez de editar/devolver', async ({ page, loginAs }) => {
    const api = await asStudent(loginAs);
    seedLoans(api, [loan(1)]);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    await expect(crud.newButton).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pendências' })).toHaveCount(0);
    const row = crud.rows.first();
    await expect(row.locator('button:has(.pi-eye)')).toBeVisible();
    await expect(row.locator('button:has(.pi-pencil)')).toHaveCount(0);
    await expect(row.locator('button:has(.pi-undo)')).toHaveCount(0);
  });

  test('"ver" abre o empréstimo somente leitura (sem Salvar)', async ({ page, loginAs }) => {
    const api = await asStudent(loginAs);
    seedLoans(api, [loan(1)]);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    await crud.rows.first().locator('button:has(.pi-eye)').click();

    await expect(crud.dialog).toBeVisible();
    await expect(crud.saveButton).toHaveCount(0);
    await expect(itemsGrid(crud).locator('tbody tr')).toContainText('Arduino');
    await expect(itemsGrid(crud).getByRole('button', { name: 'Adicionar' })).toHaveCount(0);
  });

  test('o filtro por mutuário não aparece para o aluno', async ({ page, loginAs }) => {
    const api = await asStudent(loginAs);
    seedLoans(api, [loan(1)]);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    await crud.openFilters();
    await expect(crud.drawer.getByText('Mutuário')).toHaveCount(0);
    await expect(crud.drawer.getByText('RA/SIAPE')).toBeVisible();
  });
});

test.describe('Empréstimos — pendências', () => {
  const pending = (api: MockApi) => {
    api.on('GET', '/loans/borrower/102/pending', () => ({
      body: [
        { itemId: 1, itemName: 'Arduino', pendingQuantity: 3 },
        { itemId: 2, itemName: 'Protoboard', pendingQuantity: 1 },
      ],
    }));
    api.on('GET', '/loans/borrower/103/pending', () => ({ body: [] }));
    api.on('GET', '/loans/item/1/active', () => ({
      body: [
        { loanItemId: 1, loanId: 1, quantity: 2, borrowerId: 101, loanDate: '2026-11-10', deadline: '2026-11-20' },
        { loanItemId: 2, loanId: 2, quantity: 3, borrowerId: 102, loanDate: '2026-11-11', deadline: '2026-11-21' },
      ],
    }));
  };

  const openPending = async (page: import('@playwright/test').Page, crud: CrudPage, who: string) => {
    await page.getByRole('button', { name: 'Pendências' }).click();
    const dlg = page.locator('.p-dialog', { hasText: 'Pendências por usuário' });
    await expect(dlg).toBeVisible();
    await pickFromSearchSelect(page, dlg.locator('app-search-select'), who);
    return dlg;
  };

  test('lista pendências do mutuário escolhido', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    seedLoans(api, [loan(2)]);
    pending(api);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    const dlg = await openPending(page, crud, 'Mutuário 002');

    await expect(dlg.locator('tbody tr')).toHaveCount(2);
    await expect(dlg).toContainText('Arduino');
    await expect(dlg).toContainText('Protoboard');
    await dlg.getByRole('button', { name: 'Fechar' }).click();
    await expect(dlg).toBeHidden();
  });

  test('mutuário sem pendências mostra mensagem', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    seedLoans(api, [loan(1)]);
    pending(api);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    const dlg = await openPending(page, crud, 'Mutuário 003');

    await expect(dlg.getByText('Nenhuma pendência encontrada para este usuário.')).toBeVisible();
  });

  test('"Ver empréstimos" filtra pelos empréstimos do mutuário e permite editar', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    seedLoans(api, [loan(1), loan(2)]);
    pending(api);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    const dlg = await openPending(page, crud, 'Mutuário 002');
    await dlg.locator('tbody tr', { hasText: 'Arduino' }).getByRole('button', { name: 'Ver empréstimos' }).click();

    const loans = page.locator('.p-dialog', { hasText: 'Empréstimos: Arduino' });
    await expect(loans.locator('tbody tr')).toHaveCount(1); // só o do mutuário 102
    await expect(loans.locator('tbody tr')).toContainText('21/11/2026');
    await loans.locator('button:has(.pi-pencil)').click();

    await expect(crud.dialog).toBeVisible();
    expect(api.callsTo('GET', '/loans/2')).toHaveLength(1);
  });

  test('"Ver empréstimos" → devolver abre o dialog de devolução do empréstimo', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    seedLoans(api, [loan(1), loan(2)]);
    pending(api);
    const crud = new CrudPage(page, 'loan');
    await crud.goto();

    const dlg = await openPending(page, crud, 'Mutuário 002');
    await dlg.locator('tbody tr', { hasText: 'Arduino' }).getByRole('button', { name: 'Ver empréstimos' }).click();
    await page.locator('.p-dialog', { hasText: 'Empréstimos: Arduino' }).locator('button:has(.pi-undo)').click();

    await expect(page.locator('.p-dialog', { hasText: 'Registrar Devolução' })).toBeVisible();
  });
});
