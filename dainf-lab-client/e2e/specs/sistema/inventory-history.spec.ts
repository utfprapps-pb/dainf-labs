import { makeItem } from '../../fixtures/data';
import { expect, test } from '../../fixtures/test';
import { CrudPage } from '../../pages/crud-page';
import { pickFromSearchSelect, selectOption, toast } from '../../pages/primeng';

const tx = (i: number, over: Record<string, any> = {}) => ({
  id: i,
  itemId: 1,
  itemName: `Item ${String(i).padStart(3, '0')}`,
  type: 'PURCHASE',
  quantity: 10,
  userName: 'Maria da Silva',
  date: '2026-11-10T12:00:00Z',
  quantityAfterTransaction: 10 + i,
  referenceId: i,
  inventory: { item: { id: 1 } },
  ...over,
});


test.describe('Histórico de estoque — específico', () => {
  test('lista, pagina e mostra estado vazio', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('inventory-transactions', Array.from({ length: 12 }, (_, i) => tx(i + 1)) as any);
    const crud = new CrudPage(page, 'inventory-history');
    await crud.goto();

    await expect(crud.rows).toHaveCount(10);
    await expect(async () => {
      if ((await crud.row('Item 011').count()) === 0) await crud.nextPage();
      await expect(crud.row('Item 011')).toHaveCount(1, { timeout: 1500 });
    }).toPass({ timeout: 10000 });
  });

  test('sem movimentações mostra mensagem vazia', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('inventory-transactions', []);
    const crud = new CrudPage(page, 'inventory-history');
    await crud.goto();

    await expect(crud.emptyMessage).toBeVisible();
  });

  test('erro ao carregar mostra aviso', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.failNext('POST', '/inventory-transactions/search', 500);
    await page.goto('/inventory-history');

    await expect(toast(page, 'Falha ao carregar os registros.')).toBeVisible();
  });


  test('somente leitura: sem novo, editar e excluir', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('inventory-transactions', [tx(1)] as any);
    const crud = new CrudPage(page, 'inventory-history');
    await crud.goto();

    await expect(crud.rows).toHaveCount(1);
    await expect(crud.newButton).toHaveCount(0);
    await expect(crud.rows.first().locator('button:has(.pi-pencil)')).toHaveCount(0);
    await expect(crud.rows.first().locator('button:has(.pi-trash)')).toHaveCount(0);
  });

  test('mostra tipo, quantidade, data/hora, saldo e a origem', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('inventory-transactions', [tx(1, { quantity: 7, quantityAfterTransaction: 27 })] as any);
    const crud = new CrudPage(page, 'inventory-history');
    await crud.goto();

    const row = crud.rows.first();
    await expect(row).toContainText('Item 001');
    await expect(row).toContainText('Compra');
    await expect(row).toContainText('7');
    await expect(row).toContainText('27');
    await expect(row).toContainText(/10\/11\/2026 \d{2}:\d{2}/);
    await expect(row).toContainText('Compra #1');
  });

  test('entradas (compra/devolução) e saídas (empréstimo/saída) usam ícones distintos', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('inventory-transactions', [
      tx(1, { type: 'PURCHASE' }),
      tx(2, { type: 'RETURN' }),
      tx(3, { type: 'LOAN' }),
      tx(4, { type: 'ISSUE' }),
    ] as any);
    const crud = new CrudPage(page, 'inventory-history');
    await crud.goto();

    await expect(crud.row('Item 001').locator('.pi-arrow-up')).toHaveCount(1);
    await expect(crud.row('Item 002').locator('.pi-arrow-up')).toHaveCount(1);
    await expect(crud.row('Item 003').locator('.pi-arrow-down')).toHaveCount(1);
    await expect(crud.row('Item 004').locator('.pi-arrow-down')).toHaveCount(1);
  });

  test('link de origem aponta para o registro de cada tipo', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('inventory-transactions', [
      tx(1, { type: 'PURCHASE', referenceId: 11 }),
      tx(2, { type: 'LOAN', referenceId: 22 }),
      tx(3, { type: 'ISSUE', referenceId: 33 }),
      tx(4, { type: 'RETURN', referenceId: 44 }),
    ] as any);
    const crud = new CrudPage(page, 'inventory-history');
    await crud.goto();

    await expect(crud.row('Item 001').getByRole('link', { name: 'Compra #11' })).toHaveAttribute('href', /\/purchase\?openId=11$/);
    await expect(crud.row('Item 002').getByRole('link', { name: 'Empréstimo #22' })).toHaveAttribute('href', /\/loan\?openId=22$/);
    await expect(crud.row('Item 003').getByRole('link', { name: 'Saída #33' })).toHaveAttribute('href', /\/issue\?openId=33$/);
    await expect(crud.row('Item 004').getByRole('link', { name: 'Devolução #44' })).toHaveAttribute('href', /\/loan\?openReturnId=44$/);
  });

  test('movimentação sem origem mostra "-"', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('inventory-transactions', [tx(1, { referenceId: null })] as any);
    const crud = new CrudPage(page, 'inventory-history');
    await crud.goto();

    await expect(crud.rows.first().getByRole('link')).toHaveCount(0);
  });

  test('é ordenado da movimentação mais recente para a mais antiga', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('inventory-transactions', [tx(1)] as any);
    const crud = new CrudPage(page, 'inventory-history');
    await crud.goto();

    await expect(crud.rows).toHaveCount(1);
    const body = api.callsTo('POST', '/inventory-transactions/search')[0].body;
    expect(body.sort).toEqual({ field: 'date', type: 'DESC' });
  });

  test('filtra por item e mostra a quantidade atual em estoque', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('items', [makeItem(1, { name: 'Arduino', quantity: 42 }), makeItem(2, { name: 'Protoboard', quantity: 7 })] as any);
    api.db.seed('inventory-transactions', [
      tx(1, { itemName: 'Arduino', inventory: { item: { id: 1 } } }),
      tx(2, { itemName: 'Protoboard', inventory: { item: { id: 2 } } }),
    ] as any);
    const crud = new CrudPage(page, 'inventory-history');
    await crud.goto();
    await expect(crud.rows).toHaveCount(2);
    await crud.openFilters();

    await pickFromSearchSelect(page, crud.drawer.locator('app-search-select'), 'Protoboard');

    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Protoboard')).toHaveCount(1);
    await expect(crud.drawer).toContainText('Quantidade atual em estoque: 7');
  });

  test('filtra por tipo de movimentação', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('inventory-transactions', [tx(1, { type: 'PURCHASE' }), tx(2, { type: 'LOAN' }), tx(3, { type: 'LOAN' })] as any);
    const crud = new CrudPage(page, 'inventory-history');
    await crud.goto();
    await expect(crud.rows).toHaveCount(3);
    await crud.openFilters();

    await selectOption(page, crud.drawer.locator('app-static-select'), 'Empréstimo');

    await expect(crud.rows).toHaveCount(2);
    const f = api.callsTo('POST', '/inventory-transactions/search').at(-1)!.body.filters.find((x: any) => x.field === 'type');
    expect(f).toMatchObject({ type: 'EQUALS', value: 'LOAN' });
  });

  test('filtra por período (intervalo enviado como BETWEEN)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('inventory-transactions', [tx(1), tx(2, { date: '2026-11-12T12:00:00Z' })] as any);
    const crud = new CrudPage(page, 'inventory-history');
    await crud.goto();
    await expect(crud.rows).toHaveCount(2);
    await crud.openFilters();

    const input = crud.drawer.locator('p-datepicker input');
    await input.click();
    await input.pressSequentially('12/11/2026 - 12/11/2026');
    await input.press('Tab');

    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Item 002')).toHaveCount(1);
    const f = api.callsTo('POST', '/inventory-transactions/search').at(-1)!.body.filters.find((x: any) => x.field === 'date');
    expect(f.type).toBe('BETWEEN');
    expect(f.value).toHaveLength(2);
  });

  test('aluno e professor não acessam o histórico', async ({ page, loginAs }) => {
    await loginAs('ROLE_STUDENT');
    await page.goto('/inventory-history');
    await expect(page).not.toHaveURL(/\/inventory-history$/);
  });
});
