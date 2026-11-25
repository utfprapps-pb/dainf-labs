import { expect, test } from '../../fixtures/test';
import { CrudPage } from '../../pages/crud-page';
import { crudSuite } from '../../pages/crud-suite';
import { toast } from '../../pages/primeng';

const cat = (i: number, over: Record<string, any> = {}) => ({
  id: i,
  description: `Categoria ${String(i).padStart(3, '0')}`,
  icon: 'pi pi-box',
  subcategories: [],
  ...over,
});

crudSuite({
  route: 'category',
  collection: 'categories',
  title: 'Categorias',
  make: (i) => cat(i),
  label: (i) => `Categoria ${String(i).padStart(3, '0')}`,
});

test.describe('Categorias — específico', () => {
  test('cria categoria', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('categories', [cat(1)]);
    const crud = new CrudPage(page, 'category');
    await crud.goto();

    await crud.openNew();
    await crud.dialog.locator('#description').fill('Resistores');
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    await expect(crud.dialog).toBeHidden();
    await expect(crud.row('Resistores')).toHaveCount(1);
    expect(api.callsTo('POST', '/categories')[0].body).toMatchObject({ description: 'Resistores' });
  });

  test('descrição é obrigatória', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('categories', []);
    const crud = new CrudPage(page, 'category');
    await crud.goto();

    await crud.openNew();
    await crud.save();

    await expect(crud.dialog.getByText('obrigatório', { exact: false }).first()).toBeVisible();
    expect(api.callsTo('POST', '/categories')).toHaveLength(0);
  });

  test('cria categoria com subcategorias (adicionar, editar e remover na grade)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('categories', []);
    const crud = new CrudPage(page, 'category');
    await crud.goto();

    await crud.openNew();
    await crud.dialog.locator('#description').fill('Eletrônicos');

    const sub = crud.dialog.locator('p-fieldset');
    await sub.locator('#description2').fill('Sensores');
    await sub.getByRole('button', { name: 'Adicionar' }).click();
    await sub.locator('#description2').fill('Motores');
    await sub.getByRole('button', { name: 'Adicionar' }).click();
    await expect(sub.locator('tbody tr')).toHaveCount(2);

    // edita "Motores" -> "Servo motores"
    await sub.locator('tbody tr', { hasText: 'Motores' }).locator('button:has(.pi-pencil)').click();
    await sub.locator('#description2').fill('Servo motores');
    await sub.getByRole('button', { name: 'Salvar' }).click();
    await expect(sub.locator('tbody tr', { hasText: 'Servo motores' })).toHaveCount(1);

    // remove "Sensores"
    await sub.locator('tbody tr', { hasText: 'Sensores' }).locator('button:has(.pi-trash)').click();
    await expect(sub.locator('tbody tr')).toHaveCount(1);

    await crud.save();
    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();

    const body = api.callsTo('POST', '/categories')[0].body;
    expect(body.description).toBe('Eletrônicos');
    expect(body.subcategories.map((s: any) => s.description)).toEqual(['Servo motores']);
  });

  test('edita categoria existente', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('categories', [cat(1), cat(2)]);
    const crud = new CrudPage(page, 'category');
    await crud.goto();

    await crud.openEdit('Categoria 002');
    await expect(crud.dialog.locator('#description')).toHaveValue('Categoria 002');
    await crud.dialog.locator('#description').fill('Categoria dois');
    await crud.save();

    await expect(crud.row('Categoria dois')).toHaveCount(1);
    expect(api.callsTo('PUT', '/categories/2')[0].body).toMatchObject({ description: 'Categoria dois' });
  });

  test('só lista categorias raiz (filtro parent IS_NULL)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('categories', [cat(1), cat(2, { description: 'Filha', parent: { id: 1 } })]);
    const crud = new CrudPage(page, 'category');
    await crud.goto();

    await expect(crud.row('Categoria 001')).toHaveCount(1);
    await expect(crud.row('Filha')).toHaveCount(0);
  });

  test('filtra por descrição e por código, e limpa o filtro', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('categories', [cat(1, { description: 'Cabos' }), cat(2, { description: 'Placas' }), cat(3, { description: 'Cabeamento' })]);
    const crud = new CrudPage(page, 'category');
    await crud.goto();

    await crud.openFilters();
    await crud.filterField('Descrição').fill('cab');
    await expect(crud.rows).toHaveCount(2);
    await expect(crud.row('Placas')).toHaveCount(0);

    await crud.filterField('Descrição').fill('');
    await crud.filterField('Código').fill('2');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Placas')).toHaveCount(1);

    await crud.filterField('Código').fill('');
    await expect(crud.rows).toHaveCount(3);
  });

  test('erro de validação do servidor ao salvar mantém o dialog aberto', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('categories', []);
    api.failNext('POST', '/categories', 422, { errors: { description: 'Descrição já cadastrada' } });
    const crud = new CrudPage(page, 'category');
    await crud.goto();

    await crud.openNew();
    await crud.dialog.locator('#description').fill('Duplicada');
    await crud.save();

    await expect(toast(page, 'Descrição já cadastrada')).toBeVisible();
    await expect(crud.dialog).toBeVisible();
  });

  test('perfil sem permissão (aluno) não acessa a tela', async ({ page, loginAs }) => {
    await loginAs('ROLE_STUDENT');
    await page.goto('/category');
    await expect(page).not.toHaveURL(/\/category$/);
  });
});
