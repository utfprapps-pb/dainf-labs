import { expect, test } from '../../fixtures/test';
import { toast } from '../../pages/primeng';

test.describe('Login', () => {
  test.beforeEach(async ({ page, api: _api }) => {
    await page.goto('/login');
  });

  test('entra com credenciais válidas e vai para o dashboard', async ({ page, api }) => {
    await page.getByPlaceholder('Endereço de e-mail').fill('maria@utfpr.edu.br');
    await page.locator('#password1 input').fill('Senha@123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBe('fake-jwt-token');
    expect(api.callsTo('POST', '/auth/login')[0].body).toMatchObject({
      email: 'maria@utfpr.edu.br',
      password: 'Senha@123',
    });
  });

  test('avisa quando os campos estão vazios e não chama a API', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(toast(page, 'Preencha todos os campos corretamente')).toBeVisible();
    expect(api.callsTo('POST', '/auth/login')).toHaveLength(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('mostra erro para credenciais inválidas', async ({ page, api }) => {
    api.failNext('POST', '/auth/login', 401, { message: 'Email ou senha inválidos' });

    await page.getByPlaceholder('Endereço de e-mail').fill('maria@utfpr.edu.br');
    await page.locator('#password1 input').fill('errada');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(toast(page, 'Email ou senha inválidos')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('e-mail não confirmado exibe aviso e permite reenviar a confirmação', async ({ page, api }) => {
    api.failNext('POST', '/auth/login', 403);

    await page.getByPlaceholder('Endereço de e-mail').fill('maria@utfpr.edu.br');
    await page.locator('#password1 input').fill('Senha@123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('E-mail não confirmado')).toBeVisible();

    await page.getByRole('button', { name: 'Reenviar e-mail de confirmação' }).click();
    await expect(toast(page, 'Um novo link de confirmação foi enviado')).toBeVisible();
    expect(api.callsTo('POST', '/auth/confirm-email/resend')[0].body).toEqual({
      email: 'maria@utfpr.edu.br',
    });
  });

  test('links levam para cadastro e recuperação de senha', async ({ page }) => {
    await page.getByRole('link', { name: 'Esqueceu a senha?' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);

    await page.goBack();
    await page.getByRole('link', { name: 'Cadastre-se' }).click();
    await expect(page).toHaveURL(/\/sign-up$/);
  });
});
