import { makeCategory, makeItem, pad } from '../../fixtures/data';
import type { Role } from '../../fixtures/roles';
import { expect, test } from '../../fixtures/test';
import type { MockApi } from '../../mock-api/mock-api';
import { toast } from '../../pages/primeng';

const STUDENT: Role = 'ROLE_STUDENT';

const seed = (api: MockApi, items: Record<string, any>[]) => api.db.seed('items', items as any);

const card = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.card .grid > div').filter({ hasText: name }).first();

const cartButton = (page: import('@playwright/test').Page) => page.locator('app-topbar button:has(.pi-shopping-cart)');
const cartPopover = (page: import('@playwright/test').Page) => page.locator('.p-popover');

test.describe('Itens — visão por perfil', () => {
  for (const role of ['ROLE_STUDENT', 'ROLE_PROFESSOR'] as Role[]) {
    test(`${role} vê o catálogo, não a tabela de gestão`, async ({ page, loginAs }) => {
      const api = await loginAs(role);
      seed(api, [makeItem(1, { name: 'Arduino' })]);
      await page.goto('/item');

      await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible();
      await expect(page.locator('p-table')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Novo' })).toHaveCount(0);
    });
  }

  for (const role of ['ROLE_ADMIN', 'ROLE_LAB_TECHNICIAN'] as Role[]) {
    test(`${role} vê a tabela de gestão, não o catálogo`, async ({ page, loginAs }) => {
      const api = await loginAs(role);
      api.db.seed('items', []);
      await page.goto('/item');

      await expect(page.locator('p-table')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Catálogo' })).toHaveCount(0);
    });
  }
});

test.describe('Catálogo', () => {
  test('lista itens em grade com nome, categoria, descrição e disponibilidade', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, [
      makeItem(1, { name: 'Arduino Uno', description: 'Placa microcontrolada', quantity: 30, category: makeCategory(1, 'Placas') }),
    ]);
    await page.goto('/item');

    const c = card(page, 'Arduino Uno');
    await expect(c).toContainText('Placas');
    await expect(c).toContainText('Placa microcontrolada');
    await expect(c).toContainText('30');
    await expect(c).toContainText('DISPONÍVEL');
  });

  test('status de estoque: disponível, baixo estoque e esgotado (botão desabilitado)', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, [
      makeItem(1, { name: 'Item A', quantity: 50, minimumStock: 5 }),
      makeItem(2, { name: 'Item B', quantity: 3, minimumStock: 5 }),
      makeItem(3, { name: 'Item C', quantity: 0, minimumStock: 5 }),
    ]);
    await page.goto('/item');

    await expect(card(page, 'Item A')).toContainText('DISPONÍVEL');
    await expect(card(page, 'Item B')).toContainText('BAIXO ESTOQUE');
    await expect(card(page, 'Item C')).toContainText('ESGOTADO');
    await expect(card(page, 'Item C').getByRole('button', { name: 'Adicionar' })).toBeDisabled();
    await expect(card(page, 'Item A').getByRole('button', { name: 'Adicionar' })).toBeEnabled();
  });

  test('busca por nome (com debounce) envia ILIKE ordenado por nome', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, [makeItem(1, { name: 'Arduino Uno' }), makeItem(2, { name: 'Resistor' }), makeItem(3, { name: 'Arduino Nano' })]);
    await page.goto('/item');
    await expect(page.locator('.card .grid > div')).toHaveCount(3);

    await page.getByPlaceholder('Buscar pelo nome do item...').fill('ardu');

    await expect(page.locator('.card .grid > div')).toHaveCount(2);
    await expect(card(page, 'Resistor')).toHaveCount(0);
    const last = api.callsTo('POST', '/items/search').at(-1)!.body;
    expect(last).toMatchObject({
      filters: [{ field: 'name', value: 'ardu', type: 'ILIKE' }],
      sort: { field: 'name', type: 'ASC' },
      page: 0,
      rows: 12,
    });
  });

  test('sem resultados mostra o estado vazio', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, [makeItem(1, { name: 'Arduino' })]);
    await page.goto('/item');

    await page.getByPlaceholder('Buscar pelo nome do item...').fill('zzzz');

    await expect(page.getByText('Nenhum item encontrado.')).toBeVisible();
    await expect(page.getByText('Tente buscar por outro termo.')).toBeVisible();
  });

  test('alterna entre grade e lista', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, [makeItem(1, { name: 'Arduino', quantity: 9 })]);
    await page.goto('/item');

    await expect(card(page, 'Arduino')).toContainText('Disponível');

    await page.locator('p-selectbutton .pi-list').click();
    await expect(page.locator('.card .grid > div')).toHaveCount(0);
    const row = page.locator('.card .flex-col.gap-3 > div').filter({ hasText: 'Arduino' });
    await expect(row).toContainText('Estoque');
    await expect(row.getByRole('button', { name: 'Adicionar' })).toBeVisible();

    await page.locator('p-selectbutton .pi-table').click();
    await expect(card(page, 'Arduino')).toBeVisible();
  });

  test('pagina de 12 em 12', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, Array.from({ length: 15 }, (_, i) => makeItem(i + 1, { name: `Peça ${pad(i + 1)}` })));
    await page.goto('/item');

    await expect(page.locator('.card .grid > div')).toHaveCount(12);
    await page.locator('p-paginator .p-paginator-next').click();

    await expect(page.locator('.card .grid > div')).toHaveCount(3);
    await expect(card(page, 'Peça 013')).toBeVisible();
    expect(api.callsTo('POST', '/items/search').at(-1)!.body).toMatchObject({ page: 1, rows: 12 });
  });

  test('erro ao carregar não quebra a tela (mostra vazio)', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    api.failNext('POST', '/items/search', 500);
    await page.goto('/item');

    await expect(page.getByText('Nenhum item encontrado.')).toBeVisible();
  });

  test('"Ver detalhes" abre a descrição completa e "Fechar" fecha', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, [makeItem(1, { name: 'Kit Sensores', description: 'Linha 1\nLinha 2\nLinha 3 com bastante detalhe' })]);
    await page.goto('/item');

    await card(page, 'Kit Sensores').getByRole('button', { name: 'Ver detalhes' }).click();

    const dialog = page.locator('.p-dialog', { hasText: 'Kit Sensores' });
    await expect(dialog.getByTestId('item-full-description')).toContainText('Linha 3 com bastante detalhe');
    await dialog.getByRole('button', { name: 'Fechar' }).click();
    await expect(dialog).toBeHidden();
  });

  test('detalhes: "Adicionar ao carrinho" adiciona e fecha o dialog', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, [makeItem(1, { name: 'Kit Sensores' })]);
    await page.goto('/item');

    await card(page, 'Kit Sensores').getByRole('button', { name: 'Ver detalhes' }).click();
    const dialog = page.locator('.p-dialog', { hasText: 'Kit Sensores' });
    await dialog.getByRole('button', { name: 'Adicionar ao carrinho' }).click();

    await expect(toast(page, 'Kit Sensores adicionado ao carrinho.')).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(api.callsTo('PUT', '/carts')).toHaveLength(1);
  });

  test('detalhes de item esgotado: não permite adicionar', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, [makeItem(1, { name: 'Kit Sensores', quantity: 0 })]);
    await page.goto('/item');

    await card(page, 'Kit Sensores').getByRole('button', { name: 'Ver detalhes' }).click();
    await expect(
      page.locator('.p-dialog', { hasText: 'Kit Sensores' }).getByRole('button', { name: 'Adicionar ao carrinho' }),
    ).toBeDisabled();
  });

  test('item sem foto mostra o ícone de imagem', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, [makeItem(1, { name: 'Sem foto', images: [] })]);
    await page.goto('/item');

    await expect(card(page, 'Sem foto').locator('i.pi-image')).toBeVisible();
    await expect(card(page, 'Sem foto').locator('img')).toHaveCount(0);
  });
});

test.describe('Carrinho', () => {
  test('o ícone do carrinho aparece para aluno/professor e não para laboratório', async ({ page, loginAs }) => {
    for (const role of ['ROLE_STUDENT', 'ROLE_PROFESSOR'] as Role[]) {
      await loginAs(role);
      await page.goto('/dashboard');
      await expect(cartButton(page)).toBeVisible();
    }
  });

  test('administrador não vê o carrinho no topo', async ({ page, loginAs }) => {
    await loginAs('ROLE_ADMIN');
    await page.goto('/dashboard');
    await expect(page.locator('app-user-dropdown button')).toBeVisible();
    await expect(cartButton(page)).toHaveCount(0);
  });

  test('carrinho vazio mostra mensagem', async ({ page, loginAs }) => {
    await loginAs(STUDENT);
    await page.goto('/dashboard');

    await cartButton(page).click();
    await expect(cartPopover(page).getByText('Seu carrinho está vazio.')).toBeVisible();
  });

  test('adicionar do catálogo atualiza o contador e lista o item no popover', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, [makeItem(1, { name: 'Arduino' }), makeItem(2, { name: 'Protoboard' })]);
    await page.goto('/item');

    await card(page, 'Arduino').getByRole('button', { name: 'Adicionar' }).click();
    await expect(cartButton(page).locator('p-badge')).toHaveText('1');
    await card(page, 'Protoboard').getByRole('button', { name: 'Adicionar' }).click();
    await expect(cartButton(page).locator('p-badge')).toHaveText('2');

    await cartButton(page).click();
    await expect(cartPopover(page)).toContainText('Arduino');
    await expect(cartPopover(page)).toContainText('Protoboard');
    await expect(cartPopover(page)).toContainText('ID: 1');
  });

  test('adicionar o mesmo item duas vezes soma a quantidade (sem duplicar)', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, [makeItem(1, { name: 'Arduino' })]);
    await page.goto('/item');

    const add = card(page, 'Arduino').getByRole('button', { name: 'Adicionar' });
    await add.click();
    await expect(toast(page, 'Arduino adicionado ao carrinho.')).toBeVisible();
    await add.click();

    await expect.poll(() => api.callsTo('PUT', '/carts').length).toBe(2);
    const body = api.callsTo('PUT', '/carts').at(-1)!.body;
    expect(body).toHaveLength(1);
    expect(body[0].quantity).toBe(2);
    await expect(cartButton(page).locator('p-badge')).toHaveText('1');
  });

  test('carrega o carrinho salvo ao entrar', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    api.cart = [{ id: 1, quantity: 4, item: makeItem(7, { name: 'Servo motor' }) }];
    await page.goto('/dashboard');

    await expect(cartButton(page).locator('p-badge')).toHaveText('1');
    await cartButton(page).click();
    await expect(cartPopover(page)).toContainText('Servo motor');
    await expect(cartPopover(page).locator('p-inputnumber input, p-inputNumber input').first()).toHaveValue('4');
  });

  test('altera a quantidade pelos botões + e − e persiste', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    api.cart = [{ id: 1, quantity: 2, item: makeItem(1, { name: 'Arduino' }) }];
    await page.goto('/dashboard');

    await cartButton(page).click();
    const qty = cartPopover(page).locator('input').first();
    await cartPopover(page).locator('.p-inputnumber-increment-button').click();
    await expect(qty).toHaveValue('3');
    await cartPopover(page).locator('.p-inputnumber-decrement-button').click();
    await cartPopover(page).locator('.p-inputnumber-decrement-button').click();
    await expect(qty).toHaveValue('1');

    await expect.poll(() => api.callsTo('PUT', '/carts').at(-1)?.body?.[0]?.quantity).toBe(1);
  });

  test('remove um item', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    api.cart = [
      { id: 1, quantity: 1, item: makeItem(1, { name: 'Arduino' }) },
      { id: 2, quantity: 1, item: makeItem(2, { name: 'Protoboard' }) },
    ];
    await page.goto('/dashboard');

    await cartButton(page).click();
    await cartPopover(page).locator('.flex.items-center.gap-9', { hasText: 'Arduino' }).locator('button:has(.pi-trash)').click();

    await expect(cartPopover(page)).not.toContainText('Arduino');
    await expect(cartPopover(page)).toContainText('Protoboard');
    await expect.poll(() => api.callsTo('PUT', '/carts').at(-1)?.body?.length).toBe(1);
  });

  test('"Limpar" esvazia o carrinho', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    api.cart = [{ id: 1, quantity: 1, item: makeItem(1, { name: 'Arduino' }) }];
    await page.goto('/dashboard');

    await cartButton(page).click();
    await cartPopover(page).getByRole('button', { name: 'Limpar' }).click();

    await expect(cartPopover(page).getByText('Seu carrinho está vazio.')).toBeVisible();
    await expect.poll(() => api.callsTo('PUT', '/carts').at(-1)?.body).toEqual([]);
    await expect(cartButton(page).locator('p-badge')).toHaveCount(0);
  });

  test('erro ao salvar o carrinho mostra aviso', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    seed(api, [makeItem(1, { name: 'Arduino' })]);
    api.failNext('PUT', '/carts', 500, { message: 'Carrinho indisponível' });
    await page.goto('/item');

    await card(page, 'Arduino').getByRole('button', { name: 'Adicionar' }).click();

    await expect(toast(page, 'Carrinho indisponível')).toBeVisible();
  });

  test('"Criar Reserva" leva à tela de reservas', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    api.cart = [{ id: 1, quantity: 2, item: makeItem(1, { name: 'Arduino' }) }];
    api.db.seed('reservations', []);
    await page.goto('/dashboard');

    await cartButton(page).click();
    await cartPopover(page).getByRole('button', { name: 'Criar Reserva' }).click();

    await expect(page).toHaveURL(/\/reservation$/);
  });

  test('erro ao carregar o carrinho mostra aviso e deixa o carrinho vazio', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    api.cart = [{ id: 1, quantity: 2, item: makeItem(1, { name: 'Arduino' }) }];
    api.failNext('GET', '/carts', 500, { message: 'Carrinho indisponível' });
    await page.goto('/dashboard');

    await expect(toast(page, 'Carrinho indisponível')).toBeVisible();
    await expect(cartButton(page).locator('p-badge')).toHaveCount(0);
  });

  test('quantidade mínima é 1: digitar 0 volta para 1 e o item continua no carrinho', async ({ page, loginAs }) => {
    const api = await loginAs(STUDENT);
    api.cart = [{ id: 1, quantity: 1, item: makeItem(1, { name: 'Arduino' }) }];
    await page.goto('/dashboard');
    await cartButton(page).click();
    await expect(cartPopover(page)).toContainText('Arduino');

    const input = cartPopover(page).locator('p-inputnumber input, p-inputNumber input').first();
    await input.fill('0');
    await input.press('Tab');
    await expect(input).toHaveValue('1');
    await expect(cartPopover(page)).toContainText('Arduino');
  });
});
