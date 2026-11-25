import { expect, test } from '../../fixtures/test';
import { toast } from '../../pages/primeng';

test.describe('Esqueci a senha', () => {
  test.beforeEach(async ({ page, api: _api }) => {
    await page.goto('/forgot-password');
  });

  test('envia o link de recuperação', async ({ page, api }) => {
    await page.locator('#email').fill('maria@utfpr.edu.br');
    await page.getByRole('button', { name: 'Enviar link' }).click();

    await expect(toast(page, 'Verifique sua caixa de entrada')).toBeVisible();
    expect(api.callsTo('POST', '/auth/recovery')[0].body).toEqual({ email: 'maria@utfpr.edu.br' });
  });

  test('exige e-mail', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Enviar link' }).click();

    await expect(toast(page, 'Informe o e-mail cadastrado')).toBeVisible();
    expect(api.callsTo('POST', '/auth/recovery')).toHaveLength(0);
  });

  test('mostra erro do servidor', async ({ page, api }) => {
    api.failNext('POST', '/auth/recovery', 404, { message: 'Usuário não encontrado' });

    await page.locator('#email').fill('x@utfpr.edu.br');
    await page.getByRole('button', { name: 'Enviar link' }).click();

    await expect(toast(page, 'Usuário não encontrado')).toBeVisible();
  });

  test('link volta ao login', async ({ page }) => {
    await page.getByRole('link', { name: 'login' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('Redefinir senha', () => {
  const submit = async (page: import('@playwright/test').Page, senha: string, confirma = senha) => {
    await page.locator('#password input').fill(senha);
    await page.locator('#confirmPassword input').fill(confirma);
    await page.getByRole('button', { name: 'Redefinir senha' }).click();
  };

  test('redefine com token válido e volta ao login', async ({ page, api }) => {
    await page.goto('/reset-password?token=abc123');
    await submit(page, 'NovaSenha1');

    await expect(page).toHaveURL(/\/login$/);
    expect(api.callsTo('POST', '/auth/reset-password')[0].body).toEqual({
      token: 'abc123',
      newPassword: 'NovaSenha1',
    });
  });

  test('sem token avisa e não chama a API', async ({ page, api }) => {
    await page.goto('/reset-password');
    await submit(page, 'NovaSenha1');

    await expect(toast(page, 'Use o link enviado por e-mail')).toBeVisible();
    expect(api.callsTo('POST', '/auth/reset-password')).toHaveLength(0);
  });

  const cases: [string, string, string, string][] = [
    ['campos vazios', '', '', 'Preencha a nova senha'],
    ['senha curta', 'Ab1', 'Ab1', 'no mínimo 6 caracteres'],
    ['senha fraca', 'semmaiuscula1', 'semmaiuscula1', 'maiúscula, uma minúscula e um número'],
    ['senhas diferentes', 'NovaSenha1', 'NovaSenha2', 'não coincidem'],
  ];

  for (const [name, senha, confirma, msg] of cases) {
    test(`valida: ${name}`, async ({ page, api }) => {
      await page.goto('/reset-password?token=abc123');
      await submit(page, senha, confirma);

      await expect(toast(page, msg)).toBeVisible();
      expect(api.callsTo('POST', '/auth/reset-password')).toHaveLength(0);
    });
  }

  test('token expirado mostra erro e permanece na tela', async ({ page, api }) => {
    api.failNext('POST', '/auth/reset-password', 400, { message: 'Token expirado' });

    await page.goto('/reset-password?token=velho');
    await submit(page, 'NovaSenha1');

    await expect(toast(page, 'Token expirado')).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password/);
  });
});
