import { expect, test } from '../../fixtures/test';
import { CrudPage } from '../../pages/crud-page';
import { crudSuite } from '../../pages/crud-suite';
import { multiSelect, selectOption, toast } from '../../pages/primeng';

const pad = (i: number) => String(i).padStart(3, '0');

const user = (i: number, over: Record<string, any> = {}) => ({
  id: i,
  nome: `Usuário ${pad(i)}`,
  email: `user${i}@alunos.utfpr.edu.br`,
  telefone: '46999887766',
  documento: `20${pad(i)}00`,
  role: 'ROLE_STUDENT',
  enabled: true,
  emailVerificado: true,
  groups: [],
  ...over,
});

crudSuite({
  route: 'user',
  collection: 'users',
  title: 'Usuários',
  make: (i) => user(i),
  label: (i) => `Usuário ${pad(i)}`,
});


test.describe('Usuários — específico', () => {
  test('mostra perfil e status traduzidos na tabela', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('users', [
      user(1, { role: 'ROLE_ADMIN' }),
      user(2, { role: 'ROLE_LAB_TECHNICIAN', enabled: false }),
      user(3, { role: 'ROLE_PROFESSOR' }),
      user(4),
    ]);
    const crud = new CrudPage(page, 'user');
    await crud.goto();

    await expect(crud.row('Usuário 001')).toContainText('Admin');
    await expect(crud.row('Usuário 002')).toContainText('Laboratorista');
    await expect(crud.row('Usuário 002')).toContainText('Inativo');
    await expect(crud.row('Usuário 003')).toContainText('Professor');
    await expect(crud.row('Usuário 004')).toContainText('Aluno');
    await expect(crud.row('Usuário 001')).toContainText('Ativo');
  });

  test('cria usuário com perfil e grupos', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('users', []);
    api.db.seed('groups', [
      { id: 1, name: 'Robótica', active: true },
      { id: 2, name: 'IoT', active: true },
    ]);
    const crud = new CrudPage(page, 'user');
    await crud.goto();

    await crud.openNew();
    const d = crud.dialog;
    await d.locator('#nome').fill('Carlos Mendes');
    await d.locator('#email').fill('carlos@professores.utfpr.edu.br');
    await d.locator('#telefone').fill('46988776655');
    await d.locator('#documento').fill('1234567');
    await d.locator('#password').fill('Senha1234');
    await selectOption(page, d.locator('p-select'), 'Professor');
    await multiSelect(page, d.locator('p-multiselect'), ['Robótica', 'IoT']);
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    await expect(crud.row('Carlos Mendes')).toContainText('Professor');
    const body = api.callsTo('POST', '/users')[0].body;
    expect(body).toMatchObject({
      nome: 'Carlos Mendes',
      email: 'carlos@professores.utfpr.edu.br',
      role: 'ROLE_PROFESSOR',
      enabled: true,
      password: 'Senha1234',
    });
    expect(body.groups.map((g: any) => g.name)).toEqual(['Robótica', 'IoT']);
  });

  test('valida e-mail institucional, perfil obrigatório e senha fraca', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('users', []);
    const crud = new CrudPage(page, 'user');
    await crud.goto();

    await crud.openNew();
    const d = crud.dialog;
    await d.locator('#nome').fill('Fulano de Tal');
    await d.locator('#email').fill('fulano@gmail.com');
    await d.locator('#password').fill('fraca');
    await crud.save();

    await expect(toast(page, 'verifique os campos do formulário')).toBeVisible();
    expect(api.callsTo('POST', '/users')).toHaveLength(0);
  });

  test('edita usuário: troca perfil e inativa', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('users', [user(1), user(2)]);
    const crud = new CrudPage(page, 'user');
    await crud.goto();

    await crud.openEdit('Usuário 002');
    const d = crud.dialog;
    await expect(d.locator('#nome')).toHaveValue('Usuário 002');
    await selectOption(page, d.locator('p-select'), 'Laboratorista');
    await d.locator('p-toggleswitch').click();
    await crud.save();

    await expect(crud.row('Usuário 002')).toContainText('Laboratorista');
    await expect(crud.row('Usuário 002')).toContainText('Inativo');
    expect(api.callsTo('PUT', '/users/2')[0].body).toMatchObject({
      role: 'ROLE_LAB_TECHNICIAN',
      enabled: false,
    });
  });

  test('avisa quando o e-mail do usuário ainda não foi confirmado', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('users', [user(1, { emailVerificado: false }), user(2)]);
    const crud = new CrudPage(page, 'user');
    await crud.goto();

    await crud.openEdit('Usuário 001');
    await expect(crud.dialog.getByText('ainda não foi confirmado')).toBeVisible();
    await crud.cancelButton.click();

    await crud.openEdit('Usuário 002');
    await expect(crud.dialog.getByText('ainda não foi confirmado')).toHaveCount(0);
  });

  test('filtra por nome, documento, perfil e status', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('users', [
      user(1, { nome: 'Ana Lima', documento: '111', role: 'ROLE_STUDENT' }),
      user(2, { nome: 'Bruno Dias', documento: '222', role: 'ROLE_PROFESSOR' }),
      user(3, { nome: 'Carla Melo', documento: '333', role: 'ROLE_STUDENT', enabled: false }),
    ]);
    const crud = new CrudPage(page, 'user');
    await crud.goto();

    await crud.openFilters();
    await crud.filterField('Nome').fill('bru');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Bruno Dias')).toHaveCount(1);

    await crud.filterField('Nome').fill('');
    await crud.filterField('RA/SIAPE').fill('33');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Carla Melo')).toHaveCount(1);

    await crud.filterField('RA/SIAPE').fill('');
    await selectOption(page, crud.drawer.locator('app-input-container', { hasText: 'Perfil' }).locator('p-select'), 'Aluno');
    await expect(crud.rows).toHaveCount(2);

    await selectOption(page, crud.drawer.locator('app-input-container', { hasText: 'Status' }).locator('p-select'), 'Inativo');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Carla Melo')).toHaveCount(1);
  });

  test.describe('Nada consta (clearance)', () => {
    test('confirmar emite o documento', async ({ page, loginAs }) => {
      const api = await loginAs('ROLE_ADMIN');
      api.db.seed('users', [user(1)]);
      api.on('POST', '/users/clearance', () => ({ body: {} }));
      const crud = new CrudPage(page, 'user');
      await crud.goto();

      await crud.row('Usuário 001').locator('button:has(.pi-check-square)').click();
      await expect(crud.confirm).toContainText('o usuário será inativado no sistema');
      await crud.confirmYes();

      await expect(toast(page, 'Documento emitido com sucesso.')).toBeVisible();
      expect(api.callsTo('POST', '/users/clearance')[0].body).toMatchObject({ id: 1, nome: 'Usuário 001' });
    });

    test('recusar não emite', async ({ page, loginAs }) => {
      const api = await loginAs('ROLE_ADMIN');
      api.db.seed('users', [user(1)]);
      const crud = new CrudPage(page, 'user');
      await crud.goto();

      await crud.row('Usuário 001').locator('button:has(.pi-check-square)').click();
      await crud.confirmNo();

      expect(api.callsTo('POST', '/users/clearance')).toHaveLength(0);
    });

    test('erro do servidor mostra aviso', async ({ page, loginAs }) => {
      const api = await loginAs('ROLE_ADMIN');
      api.db.seed('users', [user(1)]);
      api.on('POST', '/users/clearance', () => ({ status: 409, body: { message: 'Usuário possui pendências' } }));
      const crud = new CrudPage(page, 'user');
      await crud.goto();

      await crud.row('Usuário 001').locator('button:has(.pi-check-square)').click();
      await crud.confirmYes();

      await expect(toast(page, 'Usuário possui pendências')).toBeVisible();
    });
  });

  test('laboratorista acessa usuários; aluno não', async ({ page, loginAs }) => {
    await loginAs('ROLE_LAB_TECHNICIAN');
    await page.goto('/user');
    await expect(page).toHaveURL(/\/user$/);
  });

  test('aluno não acessa usuários', async ({ page, loginAs }) => {
    await loginAs('ROLE_STUDENT');
    await page.goto('/user');
    await expect(page).not.toHaveURL(/\/user$/);
  });
});
