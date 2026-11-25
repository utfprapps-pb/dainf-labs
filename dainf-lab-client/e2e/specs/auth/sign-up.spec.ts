import { expect, test } from '../../fixtures/test';
import { toast, typeMasked } from '../../pages/primeng';

const valid = {
  nome: 'João Pereira Souza',
  documento: '2345678',
  email: '  Joao@Alunos.UTFPR.edu.br ',
  telefone: '46999887766',
  senha: 'Senha1234',
};

test.describe('Cadastro (sign-up)', () => {
  test.beforeEach(async ({ page, api: _api }) => {
    await page.goto('/sign-up');
  });

  const fill = async (page: import('@playwright/test').Page, over: Partial<typeof valid> & { confirma?: string } = {}) => {
    const d = { ...valid, ...over };
    await page.locator('#nome').fill(d.nome);
    await page.locator('#documento').fill(d.documento);
    await page.locator('#email').fill(d.email);
    await typeMasked(page.locator('#telefone input, input#telefone').first(), d.telefone);
    await page.locator('#password input').fill(d.senha);
    await page.locator('#confirmPassword input').fill(over.confirma ?? d.senha);
  };

  test('cadastra com dados válidos, normaliza o e-mail e vai para o login', async ({ page, api }) => {
    await fill(page);
    await page.getByRole('button', { name: 'Cadastrar' }).click();

    await expect(page).toHaveURL(/\/login$/);
    expect(api.callsTo('POST', '/auth/sign-up')[0].body).toEqual({
      nome: 'João Pereira Souza',
      documento: '2345678',
      telefone: '46999887766',
      email: 'joao@alunos.utfpr.edu.br',
      password: 'Senha1234',
    });
  });

  test('formulário vazio avisa e não chama a API', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Cadastrar' }).click();

    await expect(toast(page, 'Preencha todos os campos corretamente')).toBeVisible();
    expect(api.callsTo('POST', '/auth/sign-up')).toHaveLength(0);
  });

  const invalid: [string, Parameters<typeof fill>[1]][] = [
    ['nome sem sobrenome', { nome: 'Joao' }],
    ['documento com menos de 7 dígitos', { documento: '12345' }],
    ['e-mail inválido', { email: 'nao-e-email' }],
    ['telefone incompleto', { telefone: '4699' }],
    ['senha curta', { senha: 'Ab1', confirma: 'Ab1' }],
    ['senha sem maiúscula/número', { senha: 'senhasemforca', confirma: 'senhasemforca' }],
    ['confirmação diferente da senha', { confirma: 'Outra1234' }],
  ];

  for (const [name, over] of invalid) {
    test(`rejeita ${name}`, async ({ page, api }) => {
      await fill(page, over);
      await page.getByRole('button', { name: 'Cadastrar' }).click();

      await expect(toast(page, 'Preencha todos os campos corretamente')).toBeVisible();
      expect(api.callsTo('POST', '/auth/sign-up')).toHaveLength(0);
      await expect(page).toHaveURL(/\/sign-up$/);
    });
  }

  test('erro do servidor (e-mail duplicado) mostra mensagem e reabilita o formulário', async ({ page, api }) => {
    api.failNext('POST', '/auth/sign-up', 409, { message: 'E-mail já cadastrado' });

    await fill(page);
    await page.getByRole('button', { name: 'Cadastrar' }).click();

    await expect(toast(page, 'E-mail já cadastrado')).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(page.locator('#nome')).toBeEnabled();
  });

  test('link "Realizar login" volta ao login', async ({ page }) => {
    await page.getByRole('link', { name: 'Realizar login' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
