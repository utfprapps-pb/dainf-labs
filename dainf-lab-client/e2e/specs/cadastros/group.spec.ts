import type { MockApi } from '../../mock-api/mock-api';
import { expect, test } from '../../fixtures/test';
import { CrudPage } from '../../pages/crud-page';
import { crudSuite } from '../../pages/crud-suite';
import { multiSelect, toast } from '../../pages/primeng';

const pad = (i: number) => String(i).padStart(3, '0');

const group = (i: number, over: Record<string, any> = {}) => ({
  id: i,
  name: `Grupo ${pad(i)}`,
  description: `Descrição ${i}`,
  active: true,
  ...over,
});

const users = [
  { id: 1, nome: 'Ana Lima', email: 'ana@alunos.utfpr.edu.br', documento: '111' },
  { id: 2, nome: 'Bruno Dias', email: 'bruno@alunos.utfpr.edu.br', documento: '222' },
  { id: 3, nome: 'Carla Melo', email: 'carla@alunos.utfpr.edu.br', documento: '333' },
];

/** Vínculos grupo→usuários (endpoints /groups/{id}/users não fazem parte do CRUD genérico). */
function mockGroupUsers(api: MockApi, initial: Record<number, number[]> = {}) {
  const links = new Map<number, number[]>(Object.entries(initial).map(([k, v]) => [Number(k), v]));
  api.on('GET', /^\/groups\/\d+\/users$/, ({ segments }) => ({
    body: (links.get(Number(segments[1])) ?? []).map((id) => users.find((u) => u.id === id)),
  }));
  api.on('PUT', /^\/groups\/\d+\/users$/, ({ segments, body }) => {
    links.set(Number(segments[1]), body);
    return { body: body.map((id: number) => users.find((u) => u.id === id)) };
  });
  return links;
}

test.beforeEach(async ({ api }) => {
  api.db.seed('users', users as any);
});

crudSuite({
  route: 'group',
  collection: 'groups',
  title: 'Grupos',
  make: (i) => group(i),
  label: (i) => `Grupo ${pad(i)}`,
});

test.describe('Grupos — específico', () => {
  test('mostra status Ativo/Inativo na tabela', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('groups', [group(1), group(2, { active: false })]);
    const crud = new CrudPage(page, 'group');
    await crud.goto();

    await expect(crud.row('Grupo 001')).toContainText('Ativo');
    await expect(crud.row('Grupo 002')).toContainText('Inativo');
  });

  test('cria grupo e vincula usuários', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('users', users as any);
    api.db.seed('groups', []);
    const links = mockGroupUsers(api);
    const crud = new CrudPage(page, 'group');
    await crud.goto();

    await crud.openNew();
    await crud.dialog.locator('input[formcontrolname="name"]').fill('Robótica');
    await crud.dialog.locator('textarea').fill('Grupo de robótica');
    await multiSelect(page, crud.dialog.locator('p-multiselect'), ['Ana Lima', 'Carla Melo']);
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    await expect(crud.row('Robótica')).toHaveCount(1);
    expect(api.callsTo('POST', '/groups')[0].body).toMatchObject({ name: 'Robótica', active: true });
    await expect.poll(() => links.get(1)).toEqual([1, 3]);
  });

  test('nome é obrigatório', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('groups', []);
    mockGroupUsers(api);
    const crud = new CrudPage(page, 'group');
    await crud.goto();

    await crud.openNew();
    await crud.save();

    await expect(toast(page, 'verifique os campos do formulário')).toBeVisible();
    expect(api.callsTo('POST', '/groups')).toHaveLength(0);
  });

  test('editar carrega os usuários do grupo e permite alterar o vínculo', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('users', users as any);
    api.db.seed('groups', [group(1), group(2)]);
    const links = mockGroupUsers(api, { 2: [1, 2] });
    const crud = new CrudPage(page, 'group');
    await crud.goto();

    await crud.openEdit('Grupo 002');
    await expect(crud.dialog.locator('p-multiselect')).toContainText('Ana Lima');
    await expect(crud.dialog.locator('p-multiselect')).toContainText('Bruno Dias');
    expect(api.callsTo('GET', '/groups/2/users')).toHaveLength(1);

    await multiSelect(page, crud.dialog.locator('p-multiselect'), ['Ana Lima', 'Carla Melo']); // desmarca Ana, marca Carla
    await crud.dialog.locator('input[formcontrolname="name"]').fill('Grupo dois');
    await crud.save();

    await expect(crud.row('Grupo dois')).toHaveCount(1);
    await expect.poll(() => links.get(2)).toEqual([2, 3]);
  });

  test('falha ao vincular usuários avisa que o grupo foi salvo', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('groups', []);
    mockGroupUsers(api);
    api.failNext('PUT', /^\/groups\/\d+\/users$/, 500, { message: 'Falha interna' });
    const crud = new CrudPage(page, 'group');
    await crud.goto();

    await crud.openNew();
    await crud.dialog.locator('input[formcontrolname="name"]').fill('Grupo X');
    await crud.save();

    await expect(toast(page, 'Grupo salvo, mas falhou ao vincular os usuários')).toBeVisible();
  });

  test('inativa grupo pelo toggle', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('groups', [group(1)]);
    mockGroupUsers(api);
    const crud = new CrudPage(page, 'group');
    await crud.goto();

    await crud.openEdit('Grupo 001');
    await crud.dialog.locator('p-toggleswitch').click();
    await crud.save();

    await expect(crud.row('Grupo 001')).toContainText('Inativo');
    expect(api.callsTo('PUT', '/groups/1')[0].body).toMatchObject({ active: false });
  });

  test('filtra por nome e por status', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('groups', [group(1, { name: 'Robótica' }), group(2, { name: 'IoT', active: false }), group(3, { name: 'Robôs de campo' })]);
    const crud = new CrudPage(page, 'group');
    await crud.goto();

    await crud.openFilters();
    await crud.drawer.locator('input[pInputText], input').first().fill('rob');
    await expect(crud.rows).toHaveCount(2);

    await crud.drawer.locator('input').first().fill('');
    await crud.drawer.locator('select').selectOption({ label: 'Inativo' });
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('IoT')).toHaveCount(1);

    await crud.drawer.locator('select').selectOption({ label: 'Todos' });
    await expect(crud.rows).toHaveCount(3);
  });
});
