import { makeUser } from '../../fixtures/data';
import type { Role } from '../../fixtures/roles';
import { expect, test } from '../../fixtures/test';
import { toast } from '../../pages/primeng';
import type { Page } from '@playwright/test';

const nome = (page: Page) => page.locator('#nome');
const documento = (page: Page) => page.locator('#documento');
const telefone = (page: Page) => page.locator('#telefone input, input#telefone').first();
async function typePhone(page: Page, digits: string) {
  const input = telefone(page);
  await input.click();
  await input.press('Control+A');
  await input.press('Backspace');
  await input.pressSequentially(digits, { delay: 30 });
  await input.press('Tab');
}
const current = (page: Page) => page.locator('#currentPassword input');
const next = (page: Page) => page.locator('#newPassword input');
const confirm = (page: Page) => page.locator('#confirmPassword input');
const save = (page: Page) => page.getByRole('button', { name: 'Salvar' });

test.describe('Meu perfil', () => {
  test('carrega os dados do usuário; e-mail fica somente leitura', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.user = makeUser('ROLE_STUDENT', { nome: 'Joana Pereira', documento: '2012345', telefone: '46991234567' });
    await page.goto('/profile');

    await expect(page.locator('#email')).toHaveValue('maria@utfpr.edu.br');
    await expect(page.locator('#email')).toBeDisabled();
    await expect(nome(page)).toHaveValue('Joana Pereira');
    await expect(documento(page)).toHaveValue('2012345');
    await expect(telefone(page)).toHaveValue('(46) 99123-4567');
  });

  for (const role of ['ROLE_ADMIN', 'ROLE_LAB_TECHNICIAN', 'ROLE_PROFESSOR', 'ROLE_STUDENT'] as Role[]) {
    test(`${role} acessa o próprio perfil`, async ({ page, loginAs }) => {
      await loginAs(role);
      await page.goto('/profile');

      await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
      await expect(nome(page)).toHaveValue('Maria da Silva');
    });
  }

  test('altera nome, documento e telefone sem trocar a senha', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    await page.goto('/profile');
    await expect(nome(page)).toHaveValue('Maria da Silva');

    await nome(page).fill('Maria Souza Lima');
    await documento(page).fill('2099887');
    await typePhone(page, '46932221234');
    await save(page).click();

    await expect(toast(page, 'Dados atualizados com sucesso.')).toBeVisible();
    const body = api.callsTo('PUT', '/users/me')[0].body;
    expect(body).toMatchObject({
      nome: 'Maria Souza Lima',
      documento: '2099887',
      telefone: '46932221234',
      currentPassword: null,
      newPassword: null,
    });
  });

  test('documento é opcional: vazio é enviado como null', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    await page.goto('/profile');
    await expect(documento(page)).toHaveValue('12345678909');

    await documento(page).fill('');
    await save(page).click();

    await expect(toast(page, 'Dados atualizados com sucesso.')).toBeVisible();
    expect(api.callsTo('PUT', '/users/me')[0].body.documento).toBeNull();
  });

  test('troca a senha com senha atual, nova e confirmação e limpa os campos', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    await page.goto('/profile');
    await expect(nome(page)).toHaveValue('Maria da Silva');

    await current(page).fill('SenhaAntiga1');
    await next(page).fill('NovaSenha123');
    await confirm(page).fill('NovaSenha123');
    await save(page).click();

    await expect(toast(page, 'Dados atualizados com sucesso.')).toBeVisible();
    const body = api.callsTo('PUT', '/users/me')[0].body;
    expect(body).toMatchObject({ currentPassword: 'SenhaAntiga1', newPassword: 'NovaSenha123' });
    await expect(current(page)).toHaveValue('');
    await expect(next(page)).toHaveValue('');
    await expect(confirm(page)).toHaveValue('');
  });

  test('confirmação diferente da nova senha bloqueia e explica', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    await page.goto('/profile');
    await expect(nome(page)).toHaveValue('Maria da Silva');

    await current(page).fill('SenhaAntiga1');
    await next(page).fill('NovaSenha123');
    await confirm(page).fill('Diferente123');
    await save(page).click();

    await expect(toast(page, 'Por favor, verifique os campos do formulário.')).toBeVisible();
    await expect(page.getByText('A confirmação não confere com a nova senha.')).toBeVisible();
    expect(api.callsTo('PUT', '/users/me')).toHaveLength(0);
  });

  test('nova senha sem a senha atual bloqueia e explica', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    await page.goto('/profile');
    await expect(nome(page)).toHaveValue('Maria da Silva');

    await next(page).fill('NovaSenha123');
    await confirm(page).fill('NovaSenha123');
    await save(page).click();

    await expect(page.getByText('Informe a senha atual para alterar a senha.')).toBeVisible();
    expect(api.callsTo('PUT', '/users/me')).toHaveLength(0);
  });

  test('nova senha fraca (sem maiúscula/número ou curta) não é aceita', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    await page.goto('/profile');
    await expect(nome(page)).toHaveValue('Maria da Silva');

    await current(page).fill('SenhaAntiga1');
    await next(page).fill('fraca');
    await confirm(page).fill('fraca');
    await save(page).click();

    await expect(toast(page, 'Por favor, verifique os campos do formulário.')).toBeVisible();
    expect(api.callsTo('PUT', '/users/me')).toHaveLength(0);
  });

  test('nome sem sobrenome é rejeitado', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    await page.goto('/profile');
    await expect(nome(page)).toHaveValue('Maria da Silva');

    await nome(page).fill('Maria');
    await save(page).click();

    await expect(toast(page, 'Por favor, verifique os campos do formulário.')).toBeVisible();
    expect(api.callsTo('PUT', '/users/me')).toHaveLength(0);
  });

  test('nome vazio é rejeitado', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    await page.goto('/profile');
    await expect(nome(page)).toHaveValue('Maria da Silva');

    await nome(page).fill('');
    await save(page).click();

    await expect(toast(page, 'Por favor, verifique os campos do formulário.')).toBeVisible();
    expect(api.callsTo('PUT', '/users/me')).toHaveLength(0);
  });

  test('documento fora do padrão (letras / menos de 7 dígitos) é rejeitado', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    await page.goto('/profile');
    await expect(documento(page)).toHaveValue('12345678909');

    await documento(page).fill('12ab');
    await save(page).click();

    await expect(toast(page, 'Por favor, verifique os campos do formulário.')).toBeVisible();
    expect(api.callsTo('PUT', '/users/me')).toHaveLength(0);
  });

  test('telefone incompleto é apagado pela máscara e rejeitado como obrigatório', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    await page.goto('/profile');
    await expect(nome(page)).toHaveValue('Maria da Silva');

    await typePhone(page, '4699');
    await save(page).click();

    await expect(toast(page, 'Por favor, verifique os campos do formulário.')).toBeVisible();
    expect(api.callsTo('PUT', '/users/me')).toHaveLength(0);
  });

  test('erro do servidor (senha atual incorreta) mostra o aviso e mantém os campos', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.failNext('PUT', '/users/me', 422, { message: 'Senha atual incorreta' });
    await page.goto('/profile');
    await expect(nome(page)).toHaveValue('Maria da Silva');

    await current(page).fill('Errada123');
    await next(page).fill('NovaSenha123');
    await confirm(page).fill('NovaSenha123');
    await save(page).click();

    await expect(toast(page, 'Senha atual incorreta')).toBeVisible();
    await expect(next(page)).toHaveValue('NovaSenha123');
    await expect(save(page)).toBeEnabled();
  });

  test('falha ao carregar o perfil mostra aviso', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    // 1ª chamada é do layout/guard; a falha vale para a chamada da tela
    api.failNext('GET', '/users/me', 500, { message: 'Perfil indisponível' }, 3);
    await page.goto('/profile');

    await expect(toast(page, 'Perfil indisponível')).toBeVisible();
  });

  test('exige login: sem sessão redireciona para o login', async ({ page, api }) => {
    void api;
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login|\/auth/);
  });
});
