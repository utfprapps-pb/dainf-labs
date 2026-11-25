import { makeItem, makeUser } from '../../fixtures/data';
import { expect, test } from '../../fixtures/test';
import type { MockApi } from '../../mock-api/mock-api';
import { CrudPage } from '../../pages/crud-page';
import { ddmmyyyy, toast } from '../../pages/primeng';
import type { Locator, Page } from '@playwright/test';

const student = makeUser('ROLE_STUDENT', { id: 101, nome: 'Mutuário 001', documento: '2000100' });

const loan = (over: Record<string, any> = {}) => ({
  id: 1,
  borrower: student,
  loanDate: '2026-11-10T12:00:00Z',
  deadline: '2026-11-20T12:00:00Z',
  observation: '',
  status: 'ONGOING',
  items: [
    { id: 1, quantity: 3, shouldReturn: true, item: makeItem(1, { name: 'Arduino', location: 'Gaveta A' }) },
    { id: 2, quantity: 5, shouldReturn: true, item: makeItem(2, { name: 'Protoboard', location: 'Armário B' }) },
  ],
  ...over,
});

const setup = async (api: MockApi) => {
  api.db.seed('loans', [loan()] as any);
  api.db.seed('returns', []);
};

const returnDialog = (page: Page): Locator => page.locator('.p-dialog', { hasText: 'Registrar Devolução' });
const rowOf = (dlg: Locator, name: string) => dlg.locator('tbody tr', { hasText: name });

async function openReturn(page: Page) {
  const crud = new CrudPage(page, 'loan');
  await crud.goto();
  await crud.rows.first().locator('button:has(.pi-undo)').click();
  const dlg = returnDialog(page);
  await expect(dlg).toBeVisible();
  return { crud, dlg };
}

/** Edita a célula "Devolvido" (4) ou "Saída" (5) da linha. */
async function setCell(dlg: Locator, name: string, col: 'returned' | 'issued', value: number) {
  const td = rowOf(dlg, name).locator('td').nth(col === 'returned' ? 4 : 5);
  await td.click();
  const input = td.locator('input');
  await input.fill(String(value));
  await dlg.getByRole('heading', { name: 'Registrar Devolução' }).click(); // sai da célula e confirma
}

test.describe('Devolução de empréstimo', () => {
  test('ao abrir, nenhum calendário é aberto sobre a tabela (sem autofocus em datepicker)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    await setup(api);
    await openReturn(page);

    await expect(page.locator('.p-datepicker-panel')).toHaveCount(0);
    await expect(page.locator('.p-dialog p-datepicker input:focus')).toHaveCount(0);
  });

  test('abre com os dados do empréstimo e todos os itens pendentes', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    await setup(api);
    const { dlg } = await openReturn(page);

    await expect(dlg.locator('#loanId')).toHaveValue('1');
    await expect(dlg.locator('#loanId')).toBeDisabled();
    await expect(dlg.locator('app-search-select input')).toHaveValue('Mutuário 001');
    await expect(dlg.locator('p-datepicker').nth(0).locator('input')).toHaveValue('10/11/2026');
    await expect(dlg.locator('p-datepicker').nth(1).locator('input')).toHaveValue('20/11/2026');
    await expect(dlg.locator('p-datepicker').nth(2).locator('input')).toHaveValue(ddmmyyyy(new Date()));

    const arduino = rowOf(dlg, 'Arduino');
    await expect(arduino).toContainText('Gaveta A');
    await expect(arduino.locator('td').nth(2)).toHaveText('3'); // emprestado
    await expect(arduino.locator('td').nth(3)).toHaveText('3'); // pendente
    await expect(rowOf(dlg, 'Protoboard').locator('td').nth(3)).toHaveText('5');
    expect(api.callsTo('GET', '/returns/by-loan/1')).toHaveLength(1);
  });

  test('registra devolução parcial e o pendente é recalculado', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    await setup(api);
    const { crud, dlg } = await openReturn(page);

    await setCell(dlg, 'Arduino', 'returned', 2);
    await expect(rowOf(dlg, 'Arduino').locator('td').nth(3)).toHaveText('1');
    await dlg.locator('textarea').fill('Devolveu parte');
    await dlg.getByRole('button', { name: 'Salvar' }).click();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    await expect(dlg).toBeHidden();
    const body = api.callsTo('POST', '/returns')[0].body;
    expect(body.loan.id).toBe(1);
    expect(body.observation).toBe('Devolveu parte');
    expect(body.items.map((i: any) => [i.item.name, i.quantityReturned, i.quantityIssued])).toEqual([
      ['Arduino', 2, 0],
      ['Protoboard', 0, 0],
    ]);
    // lista recarregada após o sucesso
    expect(api.callsTo('POST', '/loans/search').length).toBeGreaterThanOrEqual(2);
    await expect(crud.rows.first()).toBeVisible();
  });

  test('registra devolução + saída no mesmo item', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    await setup(api);
    const { dlg } = await openReturn(page);

    await setCell(dlg, 'Protoboard', 'returned', 3);
    await setCell(dlg, 'Protoboard', 'issued', 2);
    await expect(rowOf(dlg, 'Protoboard').locator('td').nth(3)).toHaveText('0');
    await dlg.getByRole('button', { name: 'Salvar' }).click();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    const items = api.callsTo('POST', '/returns')[0].body.items;
    expect(items.find((i: any) => i.item.name === 'Protoboard')).toMatchObject({ quantityReturned: 3, quantityIssued: 2 });
  });

  test('não permite devolver mais do que o emprestado (limite do campo)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    await setup(api);
    const { dlg } = await openReturn(page);

    await setCell(dlg, 'Arduino', 'returned', 99);

    await expect(rowOf(dlg, 'Arduino').locator('td').nth(4)).toContainText('3');
    await expect(rowOf(dlg, 'Arduino').locator('td').nth(3)).toHaveText('0');
  });

  test('a saída respeita o que já foi devolvido', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    await setup(api);
    const { dlg } = await openReturn(page);

    await setCell(dlg, 'Arduino', 'returned', 2);
    await setCell(dlg, 'Arduino', 'issued', 99);

    await expect(rowOf(dlg, 'Arduino').locator('td').nth(5)).toContainText('1'); // 3 - 2 devolvidos
  });

  test('cancelar fecha sem enviar nada', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    await setup(api);
    const { dlg } = await openReturn(page);

    await dlg.getByRole('button', { name: 'Cancelar' }).click();

    await expect(dlg).toBeHidden();
    expect(api.callsTo('POST', '/returns')).toHaveLength(0);
  });

  test('erro do servidor ao salvar mostra aviso e mantém o dialog', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    await setup(api);
    api.failNext('POST', '/returns', 422, { message: 'Devolução inválida' });
    const { dlg } = await openReturn(page);

    await setCell(dlg, 'Arduino', 'returned', 1);
    await dlg.getByRole('button', { name: 'Salvar' }).click();

    await expect(toast(page, 'Devolução inválida')).toBeVisible();
    await expect(dlg).toBeVisible();
  });

  test('empréstimo que já tem devolução: carrega os valores e atualiza (PUT)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('loans', [loan()] as any);
    api.db.seed('returns', [
      {
        id: 9,
        loan: { id: 1 },
        returnDate: '2026-11-15T12:00:00Z',
        items: [
          { id: 11, item: makeItem(1, { name: 'Arduino', location: 'Gaveta A' }), quantityReturned: 1, quantityIssued: 0 },
          { id: 12, item: makeItem(2, { name: 'Protoboard', location: 'Armário B' }), quantityReturned: 0, quantityIssued: 0 },
        ],
      },
    ] as any);
    const { dlg } = await openReturn(page);

    await expect(rowOf(dlg, 'Arduino').locator('td').nth(4)).toContainText('1');
    await expect(rowOf(dlg, 'Arduino').locator('td').nth(3)).toHaveText('2'); // 3 - 1

    await setCell(dlg, 'Arduino', 'returned', 3);
    await dlg.getByRole('button', { name: 'Salvar' }).click();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    expect(api.callsTo('POST', '/returns')).toHaveLength(0);
    const put = api.callsTo('PUT', '/returns/9')[0].body;
    expect(put.id).toBe(9);
    expect(put.items[0]).toMatchObject({ id: 11, quantityReturned: 3 });
  });

  test('falha ao consultar a devolução existente bloqueia o salvamento', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    await setup(api);
    api.failNext('GET', '/returns/by-loan/1', 500, { message: 'Serviço indisponível' });
    const { dlg } = await openReturn(page);

    await expect(toast(page, 'Falha ao carregar o registro: Serviço indisponível')).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(api.callsTo('POST', '/returns')).toHaveLength(0);
  });

  test('abre direto pela URL ?openReturnId=', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.db.seed('loans', [loan()] as any);
    api.db.seed('returns', [{ id: 9, loan: loan(), returnDate: '2026-11-15T12:00:00Z', items: [] }] as any);

    await page.goto('/loan?openReturnId=9');

    await expect(returnDialog(page)).toBeVisible();
    expect(api.callsTo('GET', '/returns/9')).toHaveLength(1);
  });
});
