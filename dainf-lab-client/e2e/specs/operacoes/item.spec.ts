import { itemCustomFilters, makeCategory, makeGroup, makeItem, pad } from '../../fixtures/data';
import { expect, test } from '../../fixtures/test';
import type { MockApi } from '../../mock-api/mock-api';
import { CrudPage } from '../../pages/crud-page';
import { crudSuite } from '../../pages/crud-suite';
import { multiSelect, selectOption, toast } from '../../pages/primeng';

test.beforeEach(async ({ api }) => {
  api.db.customFilters('items', itemCustomFilters).defaults('items', { active: true, quantity: 0 });
  api.db.seed('categories', [makeCategory(1, 'Eletrônicos'), makeCategory(2, 'Ferramentas')]);
  api.db.seed('groups', [makeGroup(1, 'Robótica'), makeGroup(2, 'IoT')]);
});

const seed = (api: MockApi, items: Record<string, any>[]) => api.db.seed('items', items as any);

// Itens têm exclusão pelo menu "Ações" (testada abaixo), não pelo botão da linha.
crudSuite({
  route: 'item',
  collection: 'items',
  title: 'Itens',
  make: (i) => makeItem(i),
  label: (i) => `Item ${pad(i)}`,
  deletable: false,
  searchPath: '/items/search/all',
});

const actionsMenu = (crud: CrudPage, label: string | RegExp) => crud.row(label).locator('button:has(.pi-cog)');

/** Abre o menu Ações da linha e escolhe a ação (tolera o overlay ainda animando). */
async function rowAction(page: import('@playwright/test').Page, crud: CrudPage, label: string | RegExp, action: string) {
  await expect(async () => {
    await actionsMenu(crud, label).click();
    await page.locator('.p-menu-overlay').waitFor({ timeout: 2000 });
    await page.getByRole('menuitem', { name: action }).click({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
}

test.describe('Itens (gestão) — listagem', () => {
  test('mostra colunas: uso, grupos, situação, categoria, quantidade e localização', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [
      makeItem(1, { restricted: true, groups: [makeGroup(1, 'Robótica')], quantity: 7, location: 'Gaveta A' }),
      makeItem(2, {
        type: 'DURABLE',
        assets: [
          { id: 1, serialNumber: 'P-1', location: 'Sala 1' },
          { id: 2, serialNumber: 'P-2', location: 'Sala 2' },
        ],
      }),
    ]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    const r1 = crud.row('Item 001');
    await expect(r1).toContainText('Restrito');
    await expect(r1).toContainText('Robótica');
    await expect(r1).toContainText('Ativo');
    await expect(r1).toContainText('Eletrônicos');
    await expect(r1).toContainText('7');
    await expect(r1).toContainText('Gaveta A');

    const r2 = crud.row('Item 002');
    await expect(r2).toContainText('Comum');
    await expect(r2).toContainText('Público');
    await expect(r2).toContainText('Sala 1, Sala 2');
  });

  test('por padrão lista só ativos; "Inativos" e "Todos" mudam a lista', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1), makeItem(2, { active: false })]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Item 001')).toHaveCount(1);

    await crud.openFilters();
    const situacao = crud.drawer.locator('app-input-container', { hasText: 'Situação' }).locator('app-static-select');
    await selectOption(page, situacao, 'Inativos');
    await expect(crud.row('Item 002')).toHaveCount(1);
    await expect(crud.rows).toHaveCount(1);

    await selectOption(page, situacao, 'Todos');
    await expect(crud.rows).toHaveCount(2);
  });

  test('filtros: nome, código, siorg, localização, saldo e tipo', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [
      makeItem(1, { name: 'Arduino Uno', siorg: 'S-AAA', location: 'Gaveta 1', quantity: 0 }),
      makeItem(2, { name: 'Resistor 10k', siorg: 'S-BBB', location: 'Gaveta 2', quantity: 50 }),
      makeItem(3, { name: 'Multímetro', type: 'DURABLE', siorg: 'S-CCC', location: 'Armário', quantity: 3 }),
    ]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();
    await expect(crud.rows).toHaveCount(3);
    await crud.openFilters();

    await crud.filterField('Nome').fill('ardu');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Arduino Uno')).toHaveCount(1);
    await crud.filterField('Nome').fill('');

    await crud.filterField('Código').fill('2');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Resistor')).toHaveCount(1);
    await crud.filterField('Código').fill('');

    await crud.filterField('Siorg').fill('ccc');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Multímetro')).toHaveCount(1);
    await crud.filterField('Siorg').fill('');

    await crud.filterField('Localização').fill('gaveta');
    await expect(crud.rows).toHaveCount(2);
    await crud.filterField('Localização').fill('');

    const saldo = crud.drawer.locator('app-input-container', { hasText: 'Saldo' }).locator('app-static-select');
    await selectOption(page, saldo, 'Saldo zerado');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Arduino Uno')).toHaveCount(1);
    await selectOption(page, saldo, 'Com saldo');
    await expect(crud.rows).toHaveCount(2);
    await selectOption(page, saldo, 'Todos');

    const tipo = crud.drawer.locator('app-input-container', { hasText: 'Tipo' }).locator('app-static-select');
    await selectOption(page, tipo, 'Durável');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Multímetro')).toHaveCount(1);
  });

  test('filtros: uso restrito e grupo', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [
      makeItem(1, { restricted: true, groups: [makeGroup(1, 'Robótica')] }),
      makeItem(2, { restricted: false }),
      makeItem(3, { restricted: true, groups: [makeGroup(2, 'IoT')] }),
    ]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();
    await crud.openFilters();

    const restrito = crud.drawer.locator('app-input-container', { hasText: 'Uso restrito' }).locator('app-static-select');
    await selectOption(page, restrito, 'Sim');
    await expect(crud.rows).toHaveCount(2);
    await selectOption(page, restrito, 'Não');
    await expect(crud.rows).toHaveCount(1);
    await selectOption(page, restrito, 'Todos');
    await expect(crud.rows).toHaveCount(3);

    const grupo = crud.drawer.locator('app-input-container', { hasText: 'Grupo' }).locator('p-select');
    await selectOption(page, grupo, 'IoT');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Item 003')).toHaveCount(1);
  });
});

test.describe('Itens (gestão) — criar e editar', () => {
  test('cria item consumível (aparece o campo Localização)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, []);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openNew();
    const d = crud.dialog;
    await expect(d.locator('#location')).toHaveCount(0);

    await d.locator('#name').fill('Capacitor 100uF');
    await d.locator('#description').fill('Eletrolítico 25V');
    await selectOption(page, d.locator('app-static-select'), 'Consumível');
    await expect(d.locator('#location')).toBeVisible();
    await d.locator('#location').fill('Gaveta C');
    await d.locator('#siorg').fill('S-123');
    await d.locator('p-treeselect').click();
    await page.getByRole('treeitem', { name: /Eletrônicos/ }).click();
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    await expect(crud.row('Capacitor 100uF')).toHaveCount(1);
    expect(api.callsTo('POST', '/items')[0].body).toMatchObject({
      name: 'Capacitor 100uF',
      type: 'CONSUMABLE',
      location: 'Gaveta C',
      siorg: 'S-123',
      restricted: false,
      category: { id: 1 },
    });
  });

  test('cria item durável com patrimônios (grade: adicionar e remover)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, []);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openNew();
    const d = crud.dialog;
    await d.locator('#name').fill('Osciloscópio');
    await selectOption(page, d.locator('app-static-select'), 'Durável');
    await d.locator('p-treeselect').click();
    await page.getByRole('treeitem', { name: /Ferramentas/ }).click();

    const assets = d.locator('p-fieldset', { hasText: 'Patrimônios' });
    await expect(assets).toBeVisible();
    await assets.locator('#serialNumber').fill('PAT-001');
    await assets.locator('#location').fill('Lab 1');
    await assets.getByRole('button', { name: 'Adicionar' }).click();
    await assets.locator('#serialNumber').fill('PAT-002');
    await assets.locator('#location').fill('Lab 2');
    await assets.getByRole('button', { name: 'Adicionar' }).click();
    await expect(assets.locator('tbody tr')).toHaveCount(2);

    await assets.locator('tbody tr', { hasText: 'PAT-002' }).locator('button:has(.pi-trash)').click();
    await expect(assets.locator('tbody tr')).toHaveCount(1);
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    const body = api.callsTo('POST', '/items')[0].body;
    expect(body.type).toBe('DURABLE');
    expect(body.assets.map((a: any) => a.serialNumber)).toEqual(['PAT-001']);
  });

  test('patrimônio exige número e localização', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, []);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openNew();
    await selectOption(page, crud.dialog.locator('app-static-select'), 'Durável');
    const assets = crud.dialog.locator('p-fieldset', { hasText: 'Patrimônios' });
    await assets.getByRole('button', { name: 'Adicionar' }).click();

    await expect(assets.locator('tbody tr').filter({ hasNot: page.locator('td[colspan]') })).toHaveCount(0);
  });

  test('nome, tipo e categoria são obrigatórios', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, []);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openNew();
    await crud.save();

    await expect(toast(page, 'verifique os campos do formulário')).toBeVisible();
    expect(api.callsTo('POST', '/items')).toHaveLength(0);
  });

  test('nome acima de 100 caracteres é rejeitado', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, []);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openNew();
    const d = crud.dialog;
    await d.locator('#name').fill('x'.repeat(101));
    await selectOption(page, d.locator('app-static-select'), 'Consumível');
    await d.locator('p-treeselect').click();
    await page.getByRole('treeitem', { name: /Eletrônicos/ }).click();
    await crud.save();

    await expect(toast(page, 'verifique os campos do formulário')).toBeVisible();
    expect(api.callsTo('POST', '/items')).toHaveLength(0);
  });

  test('uso restrito e visibilidade por grupos', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, []);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openNew();
    const d = crud.dialog;
    await d.locator('#name').fill('Kit restrito');
    await selectOption(page, d.locator('app-static-select'), 'Consumível');
    await d.locator('p-treeselect').click();
    await page.getByRole('treeitem', { name: /Eletrônicos/ }).click();
    await d.locator('p-fieldset', { hasText: 'Visibilidade' }).locator('p-toggleswitch').click();
    await multiSelect(page, d.locator('p-multiselect'), ['Robótica']);
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    const body = api.callsTo('POST', '/items')[0].body;
    expect(body.restricted).toBe(true);
    expect(body.groups.map((g: any) => g.name)).toEqual(['Robótica']);
    await expect(crud.row('Kit restrito')).toContainText('Restrito');
    await expect(crud.row('Kit restrito')).toContainText('Robótica');
  });

  test('editar carrega os dados, a quantidade fica bloqueada e o botão de empréstimos aparece', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { name: 'Protoboard', quantity: 12 })]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openEdit('Protoboard');
    const d = crud.dialog;
    await expect(d.locator('#name')).toHaveValue('Protoboard');
    await expect(d.locator('#siorg')).toHaveValue('SIORG-1');
    await expect(d.locator('p-input-number').first().locator('input')).toBeDisabled();
    await expect(d.getByRole('button', { name: 'Ver Empréstimos Ativos do Item' })).toBeVisible();

    await d.locator('#name').fill('Protoboard 830');
    await crud.save();

    await expect(crud.row('Protoboard 830')).toHaveCount(1);
    expect(api.callsTo('PUT', '/items/1')[0].body).toMatchObject({ name: 'Protoboard 830' });
  });

  test('em item novo não há botão de empréstimos ativos', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, []);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openNew();
    await expect(crud.dialog.getByRole('button', { name: 'Ver Empréstimos Ativos do Item' })).toHaveCount(0);
  });

  test('envia fotos: obtém URL assinada e faz upload', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, []);
    api.on('GET', '/items/storage/signed-url', () => ({ body: 'http://api.test/upload/foto.png' }));
    await page.route('http://api.test/upload/**', (route) =>
      route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }),
    );
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openNew();
    await crud.dialog.locator('input[type=file]').first().setInputFiles({
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgo=', 'base64'),
    });

    await expect.poll(() => api.callsTo('GET', '/items/storage/signed-url').length).toBeGreaterThan(0);
  });
});

test.describe('Itens (gestão) — ações da linha', () => {
  test('inativar pelo menu Ações (confirmação + toast)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { name: 'Cabo USB' })]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await rowAction(page, crud, 'Cabo USB', 'Inativar');
    await expect(crud.confirm).toContainText('Inativar “Cabo USB”?');
    await crud.confirm.getByRole('button', { name: 'Confirmar' }).click();

    await expect(toast(page, 'Item inativado.')).toBeVisible();
    expect(api.callsTo('PUT', '/items/1/active')[0].body).toEqual({ active: false });
    // some da lista (filtro padrão = ativos)
    await expect(crud.row('Cabo USB')).toHaveCount(0);
  });

  test('inativar: cancelar não chama a API', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { name: 'Cabo USB' })]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await rowAction(page, crud, 'Cabo USB', 'Inativar');
    await crud.confirm.getByRole('button', { name: 'Cancelar' }).click();

    expect(api.callsTo('PUT', '/items/1/active')).toHaveLength(0);
    await expect(crud.row('Cabo USB')).toHaveCount(1);
  });

  test('reativar item inativo', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { name: 'Cabo USB', active: false })]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openFilters();
    await selectOption(page, crud.drawer.locator('app-input-container', { hasText: 'Situação' }).locator('app-static-select'), 'Todos');
    await expect(crud.row('Cabo USB')).toContainText('Inativo');
    await crud.closeFilters();

    await rowAction(page, crud, 'Cabo USB', 'Reativar');
    await crud.confirm.getByRole('button', { name: 'Confirmar' }).click();

    await expect(toast(page, 'Item reativado.')).toBeVisible();
    expect(api.callsTo('PUT', '/items/1/active')[0].body).toEqual({ active: true });
    await expect(crud.row('Cabo USB')).toContainText('Ativo');
  });

  test('inativar com erro do servidor mostra aviso', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { name: 'Cabo USB' })]);
    api.failNext('PUT', '/items/1/active', 409, { message: 'Item com empréstimos em aberto' });
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await rowAction(page, crud, 'Cabo USB', 'Inativar');
    await crud.confirm.getByRole('button', { name: 'Confirmar' }).click();

    await expect(toast(page, 'Item com empréstimos em aberto')).toBeVisible();
    await expect(crud.row('Cabo USB')).toHaveCount(1);
  });

  test('excluir pelo menu Ações', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { name: 'Cabo USB' }), makeItem(2, { name: 'Cabo HDMI' })]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await rowAction(page, crud, 'Cabo USB', 'Excluir');
    await crud.confirmYes();

    await expect(crud.row('Cabo USB')).toHaveCount(0);
    await expect(crud.row('Cabo HDMI')).toHaveCount(1);
    expect(api.callsTo('DELETE', '/items/1')).toHaveLength(1);
  });

  test('excluir item com vínculos mostra o erro e mantém o item', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { name: 'Cabo USB' })]);
    api.failNext('DELETE', '/items/1', 409, { message: 'Item possui movimentações' });
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await rowAction(page, crud, 'Cabo USB', 'Excluir');
    await crud.confirmYes();

    await expect(toast(page, 'Item possui movimentações')).toBeVisible();
    await expect(crud.row('Cabo USB')).toHaveCount(1);
  });

  test('adicionar ao carrinho dispara a gravação do carrinho', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { name: 'Cabo USB' })]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.row('Cabo USB').locator('button:has(.pi-cart-plus)').click();

    await expect(toast(page, 'Cabo USB adicionado ao carrinho.')).toBeVisible();
    const put = api.callsTo('PUT', '/carts')[0].body;
    expect(put).toHaveLength(1);
    expect(put[0]).toMatchObject({ quantity: 1, item: { id: 1 } });
  });

  test('item inativo não pode ir ao carrinho', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { name: 'Cabo USB', active: false })]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openFilters();
    await selectOption(page, crud.drawer.locator('app-input-container', { hasText: 'Situação' }).locator('app-static-select'), 'Todos');
    await expect(crud.row('Cabo USB').locator('button:has(.pi-cart-plus)')).toBeDisabled();
  });

  test('ver empréstimos do item abre o dialog com os solicitantes', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { name: 'Cabo USB' })]);
    api.on('GET', '/loans/item/1/active', () => ({
      body: [
        { loanItemId: 1, quantity: 2, borrowerName: 'Ana Lima', status: 'ONGOING', loanDate: '2026-11-10', deadline: '2026-11-20' },
        { loanItemId: 2, quantity: 1, borrowerName: 'Bruno Dias', status: 'OVERDUE', loanDate: '2026-10-01', deadline: '2026-10-10' },
      ],
    }));
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.row('Cabo USB').locator('button:has(.pi-clock)').click();

    const dialog = page.locator('.p-dialog', { hasText: 'Empréstimos Ativos: Cabo USB' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('tbody tr')).toHaveCount(2);
    await expect(dialog).toContainText('Ana Lima');
    await expect(dialog).toContainText('10/11/2026');
    await expect(dialog).toContainText('20/11/2026');
    await dialog.getByRole('button', { name: 'Fechar' }).click();
    await expect(dialog).toBeHidden();
  });

  test('ver empréstimos: item sem empréstimos mostra mensagem vazia', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { name: 'Cabo USB' })]);
    api.on('GET', '/loans/item/1/active', () => ({ body: [] }));
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.row('Cabo USB').locator('button:has(.pi-clock)').click();
    await expect(page.getByText('Nenhum empréstimo ativo encontrado para este item.')).toBeVisible();
  });

  test('dentro do dialog de edição, "Ver Empréstimos Ativos do Item" abre a lista', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { name: 'Cabo USB' })]);
    api.on('GET', '/loans/item/1/active', () => ({
      body: [{ loanItemId: 1, quantity: 3, borrowerName: 'Carla Melo', status: 'ONGOING', loanDate: '2026-11-10', deadline: '2026-11-20' }],
    }));
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openEdit('Cabo USB');
    await crud.dialog.getByRole('button', { name: 'Ver Empréstimos Ativos do Item' }).click();

    await expect(page.locator('.p-dialog', { hasText: 'Empréstimos Ativos: Cabo USB' })).toContainText('Carla Melo');
  });

  test('laboratorista também vê as ações de gestão', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    seed(api, [makeItem(1, { name: 'Cabo USB' })]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await expect(crud.row('Cabo USB').locator('button:has(.pi-pencil)')).toBeVisible();
    await expect(crud.row('Cabo USB').locator('button:has(.pi-cog)')).toBeVisible();
  });
});

test.describe('Itens — categorias e carregamento', () => {
  test('categoria exibida na tabela vem do cadastro', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    seed(api, [makeItem(1, { category: makeCategory(2, 'Ferramentas') })]);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await expect(crud.row('Item 001')).toContainText('Ferramentas');
  });
});
