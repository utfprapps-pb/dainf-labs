import { makeItem, makeUser, pad } from '../../fixtures/data';
import { expect, test } from '../../fixtures/test';
import { CrudPage } from '../../pages/crud-page';
import { crudSuite } from '../../pages/crud-suite';
import { ddmmyyyy, pickFromSearchSelect, toast } from '../../pages/primeng';
import type { Page } from '@playwright/test';

const supplier = (i: number) => ({
  id: i,
  nomeFantasia: `Fornecedor ${pad(i)}`,
  razaoSocial: `Razão ${pad(i)}`,
  cnpj: '11222333000181',
});

const buyer = makeUser('ROLE_LAB_TECHNICIAN', { id: 7, nome: 'Laboratorista Teste' });

const purchase = (i: number, over: Record<string, any> = {}) => ({
  id: i,
  date: '2026-11-10T12:00:00Z',
  fornecedor: supplier(i),
  user: buyer,
  observation: `Nota fiscal ${i}`,
  totalValue: 50,
  items: [{ id: i, quantity: 5, price: 10, item: makeItem(1, { name: 'Arduino' }) }],
  ...over,
});

test.beforeEach(async ({ api }) => {
  api.db.seed('items', [makeItem(1, { name: 'Arduino', price: 10 }), makeItem(2, { name: 'Protoboard', price: 0 })] as any);
  api.db.seed('fornecedores', [supplier(1), supplier(2), supplier(3)] as any);
});

crudSuite({
  route: 'purchase',
  collection: 'purchases',
  title: 'Compras',
  role: 'ROLE_LAB_TECHNICIAN',
  make: (i) => purchase(i),
  label: (i) => `Fornecedor ${pad(i)}`,
  deletable: false, // Compras não permite exclusão
});

const grid = (crud: CrudPage) => crud.dialog.locator('p-fieldset', { hasText: 'Itens da Compra' });
const total = (crud: CrudPage) => crud.dialog.locator('app-input-container', { hasText: 'Valor Total da Compra' }).locator('input');

async function addItem(page: Page, crud: CrudPage, name: string, qty: number, price?: number) {
  const g = grid(crud);
  await pickFromSearchSelect(page, g.locator('app-search-select'), name);
  const [qtyInput, priceInput] = [g.locator('p-inputNumber input').nth(0), g.locator('p-inputNumber input').nth(1)];
  await qtyInput.fill(String(qty));
  if (price !== undefined) await priceInput.fill(String(price).replace('.', ','));
  await g.getByRole('button', { name: 'Adicionar' }).click();
}

test.describe('Compras — específico', () => {
  test('não oferece exclusão na tabela', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('purchases', [purchase(1)] as any);
    const crud = new CrudPage(page, 'purchase');
    await crud.goto();

    await expect(crud.rows.first().locator('button:has(.pi-trash)')).toHaveCount(0);
    await expect(crud.rows.first().locator('button:has(.pi-pencil)')).toBeVisible();
  });

  test('lista data, fornecedor, responsável e observação', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('purchases', [purchase(1)] as any);
    const crud = new CrudPage(page, 'purchase');
    await crud.goto();

    const row = crud.rows.first();
    await expect(row).toContainText('10/11/2026');
    await expect(row).toContainText('Fornecedor 001');
    await expect(row).toContainText('Laboratorista Teste');
    await expect(row).toContainText('Nota fiscal 1');
  });

  test('registra compra: data padrão = hoje, preço sugerido pelo item e total somado', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('purchases', []);
    const crud = new CrudPage(page, 'purchase');
    await crud.goto();

    await crud.openNew();
    await expect(crud.dialog.locator('p-datepicker input')).toHaveValue(ddmmyyyy(new Date()));
    await pickFromSearchSelect(page, crud.dialog.locator('app-search-select').first(), 'Fornecedor 002');
    await crud.dialog.locator('textarea').fill('NF 12345');

    // preço do item (R$ 10,00) é sugerido ao escolher o item
    await pickFromSearchSelect(page, grid(crud).locator('app-search-select'), 'Arduino');
    await expect(grid(crud).locator('p-inputNumber input').nth(1)).toHaveValue(/10,00/);
    await grid(crud).locator('p-inputNumber input').nth(0).fill('5');
    await grid(crud).getByRole('button', { name: 'Adicionar' }).click();
    await addItem(page, crud, 'Protoboard', 2, 7.5);

    await expect(grid(crud).locator('tbody tr')).toHaveCount(2);
    await expect(grid(crud).locator('tbody tr', { hasText: 'Arduino' })).toContainText(/R\$\s*10,00/);
    await expect(grid(crud).locator('tbody tr', { hasText: 'Arduino' })).toContainText(/R\$\s*50,00/); // subtotal
    await expect(grid(crud).locator('tbody tr', { hasText: 'Protoboard' })).toContainText(/R\$\s*15,00/);
    await expect(total(crud)).toHaveValue(/65,00/);
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    const body = api.callsTo('POST', '/purchases')[0].body;
    expect(body.fornecedor.nomeFantasia).toBe('Fornecedor 002');
    expect(body.observation).toBe('NF 12345');
    expect(body.totalValue).toBe(65);
    expect(body.items.map((i: any) => [i.item.name, i.quantity, i.price])).toEqual([
      ['Arduino', 5, 10],
      ['Protoboard', 2, 7.5],
    ]);
    await expect(crud.row('Fornecedor 002')).toHaveCount(1);
  });

  test('remover item recalcula o total', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('purchases', []);
    const crud = new CrudPage(page, 'purchase');
    await crud.goto();

    await crud.openNew();
    await addItem(page, crud, 'Arduino', 5, 10);
    await addItem(page, crud, 'Protoboard', 2, 7.5);
    await expect(total(crud)).toHaveValue(/65,00/);

    await grid(crud).locator('tbody tr', { hasText: 'Protoboard' }).locator('button:has(.pi-trash)').click();

    await expect(grid(crud).locator('tbody tr')).toHaveCount(1);
    await expect(total(crud)).toHaveValue(/50,00/);
  });

  test('exige fornecedor e ao menos um item', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('purchases', []);
    const crud = new CrudPage(page, 'purchase');
    await crud.goto();

    await crud.openNew();
    await crud.save();

    await expect(toast(page, 'verifique os campos do formulário')).toBeVisible();
    await expect(crud.dialog.getByText('No mínimo 1 item deve ser escolhido.')).toBeVisible();
    expect(api.callsTo('POST', '/purchases')).toHaveLength(0);
  });

  test('item sem preço (R$ 0,00) ou sem quantidade não entra na grade', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('purchases', []);
    const crud = new CrudPage(page, 'purchase');
    await crud.goto();

    await crud.openNew();
    // Protoboard tem preço 0 -> preço mínimo 0,01 não é atendido
    await addItem(page, crud, 'Protoboard', 3);
    await expect(grid(crud).locator('tbody tr').filter({ hasNot: page.locator('td[colspan]') })).toHaveCount(0);
  });

  test('erro do servidor mantém o dialog aberto', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('purchases', []);
    api.failNext('POST', '/purchases', 422, { message: 'Compra inválida' });
    const crud = new CrudPage(page, 'purchase');
    await crud.goto();

    await crud.openNew();
    await pickFromSearchSelect(page, crud.dialog.locator('app-search-select').first(), 'Fornecedor 001');
    await addItem(page, crud, 'Arduino', 1, 10);
    await crud.save();

    await expect(toast(page, 'Compra inválida')).toBeVisible();
    await expect(crud.dialog).toBeVisible();
  });

  test('editar abre em modo leitura para os itens (sem Adicionar) e mostra o total', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('purchases', [purchase(1)] as any);
    const crud = new CrudPage(page, 'purchase');
    await crud.goto();

    await crud.openEdit('Fornecedor 001');

    await expect(crud.dialog.locator('p-datepicker input')).toHaveValue('10/11/2026');
    await expect(grid(crud).locator('tbody tr')).toContainText('Arduino');
    await expect(grid(crud).getByRole('button', { name: 'Adicionar' })).toHaveCount(0);
    await expect(grid(crud).locator('button:has(.pi-trash)')).toHaveCount(0);
    await expect(total(crud)).toHaveValue(/50,00/);
  });

  test('filtra por código, fornecedor e responsável', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    const other = makeUser('ROLE_ADMIN', { id: 8, nome: 'Outro Comprador' });
    api.db.seed('purchases', [purchase(1), purchase(2, { user: other }), purchase(3)] as any);
    api.db.seed('users', [buyer, other] as any);
    const crud = new CrudPage(page, 'purchase');
    await crud.goto();
    await crud.openFilters();

    await crud.filterField('Código').fill('3');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Fornecedor 003')).toHaveCount(1);
    await crud.filterField('Código').fill('');
    await expect(crud.rows).toHaveCount(3);

    await pickFromSearchSelect(page, crud.drawer.locator('app-input-container', { hasText: 'Fornecedor' }).locator('app-search-select'), 'Fornecedor 002');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Fornecedor 002')).toHaveCount(1);
  });

  test('filtra por usuário responsável', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    const other = makeUser('ROLE_ADMIN', { id: 8, nome: 'Outro Comprador' });
    api.db.seed('purchases', [purchase(1), purchase(2, { user: other })] as any);
    api.db.seed('users', [buyer, other] as any);
    const crud = new CrudPage(page, 'purchase');
    await crud.goto();
    await crud.openFilters();

    await pickFromSearchSelect(page, crud.drawer.locator('app-input-container', { hasText: 'Usuário Responsável' }).locator('app-search-select'), 'Outro Comprador');

    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Fornecedor 002')).toHaveCount(1);
  });

  test('aluno não acessa compras', async ({ page, loginAs }) => {
    await loginAs('ROLE_STUDENT');
    await page.goto('/purchase');
    await expect(page).not.toHaveURL(/\/purchase$/);
  });
});

