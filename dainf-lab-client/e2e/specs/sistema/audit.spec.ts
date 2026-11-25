import { makeUser } from '../../fixtures/data';
import { expect, test } from '../../fixtures/test';
import type { MockApi } from '../../mock-api/mock-api';
import { fillDate, pickFromSearchSelect, selectOption, toast } from '../../pages/primeng';
import type { Page } from '@playwright/test';

const ENTITIES = [
  { key: 'LOAN', label: 'Empréstimo' },
  { key: 'ITEM', label: 'Item' },
  { key: 'CATEGORY', label: 'Categoria' },
  { key: 'CONFIGURATION', label: 'Configuração' },
  { key: 'REGISTRY', label: 'Cadastro auxiliar' }, // sem página dedicada → sem link
];

const entry = (i: number, over: Record<string, any> = {}) => ({
  revisionId: 100 + i,
  revisionDate: '2026-11-10T15:00:00Z',
  username: 'maria@utfpr.edu.br',
  revisionType: 'MOD',
  entityKey: 'LOAN',
  entityName: 'Empréstimo',
  entityId: i,
  description: `Empréstimo #${i}`,
  ...over,
});

/** Instala /audit/entities e /audit/search com paginação (rows/page do request). */
function stubAudit(api: MockApi, all: Record<string, any>[], entities = ENTITIES) {
  api.on('GET', '/audit/entities', () => ({ body: entities }));
  api.on('POST', '/audit/search', ({ body }) => {
    const rows = body.rows ?? 10;
    const page = body.page ?? 0;
    const matches = all.filter(
      (e) =>
        (!body.entityKey || e.entityKey === body.entityKey) &&
        (!body.username || e.username === body.username) &&
        (!body.revisionType || e.revisionType === body.revisionType),
    );
    return {
      body: {
        content: matches.slice(page * rows, page * rows + rows),
        page: { size: rows, number: page, totalElements: matches.length, totalPages: Math.ceil(matches.length / rows) },
      },
    };
  });
}

const rows = (page: Page) => page.locator('app-crud-table tbody tr').filter({ hasNot: page.locator('td[colspan]') });
const searches = (api: MockApi) => api.callsTo('POST', '/audit/search');
const lastSearch = (api: MockApi) => searches(api).at(-1)!.body;

test.describe('Auditoria', () => {
  test('carrega as entidades, seleciona a primeira e lista os registros', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubAudit(api, [entry(1), entry(2)]);
    await page.goto('/audit');

    await expect(page.getByText('Auditoria').first()).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    expect(lastSearch(api).entityKey).toBe('LOAN');
    await expect(page.locator('p-select').first()).toContainText('Empréstimo');
  });

  test('mostra data/hora, usuário, entidade, registro e tipo de alteração', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubAudit(api, [
      entry(1, { revisionType: 'ADD' }),
      entry(2, { revisionType: 'MOD' }),
      entry(3, { revisionType: 'DEL' }),
    ]);
    await page.goto('/audit');

    await expect(rows(page)).toHaveCount(3);
    const first = rows(page).filter({ hasText: 'Empréstimo #1' });
    await expect(first).toContainText(/10\/11\/2026 \d{2}:\d{2}:\d{2}/);
    await expect(first).toContainText('maria@utfpr.edu.br');
    await expect(first).toContainText('Inclusão');
    await expect(rows(page).filter({ hasText: 'Empréstimo #2' })).toContainText('Alteração');
    await expect(rows(page).filter({ hasText: 'Empréstimo #3' })).toContainText('Exclusão');
  });

  test('o registro vira link para a edição na tela da entidade', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubAudit(api, [entry(7)]);
    await page.goto('/audit');

    await expect(page.getByRole('link', { name: 'Empréstimo #7' })).toHaveAttribute('href', /\/loan\?openId=7$/);
  });

  test('entidade sem página dedicada mostra a descrição sem link', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubAudit(api, [entry(1, { entityKey: 'REGISTRY', entityName: 'Cadastro auxiliar', description: 'Registro solto' })]);
    await page.goto('/audit');
    await selectOption(page, page.locator('p-select').first(), 'Cadastro auxiliar');

    await expect(rows(page).filter({ hasText: 'Registro solto' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Registro solto' })).toHaveCount(0);
  });

  test('clicar no link navega para a tela da entidade abrindo o registro', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('loans', [
      {
        id: 7,
        borrower: makeUser('ROLE_STUDENT', { id: 9, nome: 'Aluno Teste' }),
        loanDate: '2026-11-10T12:00:00Z',
        deadline: '2026-11-20T12:00:00Z',
        status: 'ONGOING',
        items: [],
      },
    ] as any);
    stubAudit(api, [entry(7)]);
    await page.goto('/audit');

    await page.getByRole('link', { name: 'Empréstimo #7' }).click();

    await expect(page).toHaveURL(/\/loan/);
    expect(api.callsTo('GET', '/loans/7')).toHaveLength(1);
  });

  test('trocar a entidade consulta novamente com a nova chave', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubAudit(api, [entry(1), entry(2, { entityKey: 'ITEM', entityName: 'Item', description: 'Item Arduino' })]);
    await page.goto('/audit');
    await expect(rows(page)).toHaveCount(1);

    await selectOption(page, page.locator('p-select').first(), 'Item');

    await expect(rows(page).filter({ hasText: 'Item Arduino' })).toHaveCount(1);
    expect(lastSearch(api).entityKey).toBe('ITEM');
  });

  test('filtra por tipo de alteração e permite limpar', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubAudit(api, [entry(1, { revisionType: 'ADD' }), entry(2, { revisionType: 'DEL' }), entry(3, { revisionType: 'DEL' })]);
    await page.goto('/audit');
    await expect(rows(page)).toHaveCount(3);

    await selectOption(page, page.locator('app-input-container', { hasText: 'Tipo de alteração' }).locator('p-select'), 'Exclusão');

    await expect(rows(page)).toHaveCount(2);
    expect(lastSearch(api).revisionType).toBe('DEL');

    await page.locator('app-input-container', { hasText: 'Tipo de alteração' }).locator('.p-select-clear-icon').click();
    await expect(rows(page)).toHaveCount(3);
    expect(lastSearch(api).revisionType).toBeFalsy();
  });

  test('filtra por usuário (envia o e-mail)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('users', [
      makeUser('ROLE_ADMIN', { id: 1, nome: 'Maria da Silva', email: 'maria@utfpr.edu.br' }),
      makeUser('ROLE_LAB_TECHNICIAN', { id: 2, nome: 'Carlos Souza', email: 'carlos@utfpr.edu.br' }),
    ] as any);
    stubAudit(api, [entry(1), entry(2, { username: 'carlos@utfpr.edu.br' })]);
    await page.goto('/audit');
    await expect(rows(page)).toHaveCount(2);

    await pickFromSearchSelect(page, page.locator('app-input-container', { hasText: 'Usuário' }).locator('app-search-select'), 'Carlos Souza');

    await expect(rows(page)).toHaveCount(1);
    expect(lastSearch(api).username).toBe('carlos@utfpr.edu.br');
  });

  test('filtra por período (De/Até) enviando início e fim do dia', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubAudit(api, [entry(1)]);
    await page.goto('/audit');
    await expect(rows(page)).toHaveCount(1);

    await fillDate(page.locator('app-input-container', { hasText: 'De' }).locator('p-datepicker').first(), '01/11/2026');
    await fillDate(page.locator('app-input-container', { hasText: 'Até' }).locator('p-datepicker').first(), '30/11/2026');

    await expect.poll(() => lastSearch(api).dateTo).toBeTruthy();
    const body = lastSearch(api);
    expect(new Date(body.dateFrom).getTime()).toBeLessThan(new Date(body.dateTo).getTime());
    expect(new Date(body.dateFrom).getHours()).toBe(0);
    expect(new Date(body.dateTo).getHours()).toBe(23);
  });

  test('pagina os registros', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubAudit(api, Array.from({ length: 25 }, (_, i) => entry(i + 1)));
    await page.goto('/audit');
    await expect(rows(page)).toHaveCount(10);

    await page.locator('.p-paginator-next').click();

    await expect(rows(page).filter({ hasText: 'Empréstimo #11' })).toHaveCount(1);
    expect(lastSearch(api)).toMatchObject({ page: 1, rows: 10 });
  });

  test('sem registros mostra mensagem vazia', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubAudit(api, []);
    await page.goto('/audit');

    await expect(page.getByText('Nenhum registro encontrado')).toBeVisible();
  });

  test('erro ao carregar a lista mostra aviso', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubAudit(api, [entry(1)]);
    api.failNext('POST', '/audit/search', 500, { message: 'Auditoria indisponível' });
    await page.goto('/audit');

    await expect(toast(page, 'Falha ao carregar os registros de auditoria: Auditoria indisponível')).toBeVisible();
  });

  test.describe('alterações do registro', () => {
    const open = async (page: Page) => {
      await rows(page).first().locator('button:has(.pi-eye)').click();
      return page.locator('.p-dialog', { hasText: 'Alterações do registro' });
    };

    test('mostra campo, valor anterior e novo valor', async ({ page, loginAs }) => {
      const api = await loginAs('ROLE_ADMIN');
      stubAudit(api, [entry(1)]);
      api.on('GET', '/audit/LOAN/1/101/changes', () => ({
        body: [
          { field: 'Prazo', oldValue: '20/11/2026', newValue: '25/11/2026' },
          { field: 'Observação', newValue: 'Renovado' },
        ],
      }));
      await page.goto('/audit');
      const dlg = await open(page);

      await expect(dlg.locator('tbody tr')).toHaveCount(2);
      await expect(dlg.locator('tbody tr', { hasText: 'Prazo' })).toContainText('20/11/2026');
      await expect(dlg.locator('tbody tr', { hasText: 'Prazo' })).toContainText('25/11/2026');
      await expect(dlg.locator('tbody tr', { hasText: 'Observação' })).toContainText('—');
    });

    test('sem diferenças mostra mensagem', async ({ page, loginAs }) => {
      const api = await loginAs('ROLE_ADMIN');
      stubAudit(api, [entry(1)]);
      api.on('GET', '/audit/LOAN/1/101/changes', () => ({ body: [] }));
      await page.goto('/audit');
      const dlg = await open(page);

      await expect(dlg.getByText('Nenhuma alteração de campo encontrada para este registro.')).toBeVisible();
    });

    test('erro ao carregar mostra aviso', async ({ page, loginAs }) => {
      const api = await loginAs('ROLE_ADMIN');
      stubAudit(api, [entry(1)]);
      api.failNext('GET', '/audit/LOAN/1/101/changes', 500, { message: 'Sem acesso ao histórico' });
      await page.goto('/audit');
      await open(page);

      await expect(toast(page, 'Falha ao carregar as alterações: Sem acesso ao histórico')).toBeVisible();
    });
  });

  test('somente administrador acessa', async ({ page, loginAs }) => {
    await loginAs('ROLE_LAB_TECHNICIAN');
    await page.goto('/audit');
    await expect(page).not.toHaveURL(/\/audit$/);
  });
});

test.describe('Auditoria — mapa de rotas das entidades', () => {
  const keys: Record<string, string> = {
    CATEGORY: 'category',
    FORNECEDOR: 'supplier',
    USER: 'user',
    ITEM: 'item',
    PURCHASE: 'purchase',
    LOAN: 'loan',
    ISSUE: 'issue',
    INVENTORY_TRANSACTION: 'inventory-history',
    RESERVATION: 'reservation',
    SOLICITATION: 'purchase-solicitation',
    CONFIGURATION: 'configuration',
  };

  for (const [key, route] of Object.entries(keys)) {
    test(`${key} leva para /${route}`, async ({ page, loginAs }) => {
      const api = await loginAs('ROLE_ADMIN');
      stubAudit(
        api,
        [entry(5, { entityKey: key, entityName: key, description: `Registro ${key}` })],
        [{ key, label: key }],
      );
      await page.goto('/audit');

      const link = page.getByRole('link', { name: `Registro ${key}` });
      await expect(link).toHaveAttribute('href', new RegExp(`/${route}\\?openId=5$`));
    });
  }
});
