import { expect, test } from '../../fixtures/test';

test.describe('Confirmação de e-mail', () => {
  test('token válido confirma e redireciona ao login', async ({ page, api }) => {
    await page.goto('/confirm-mail?token=ok-token');

    await expect(page.getByText('Seu e-mail foi confirmado com sucesso.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(api.callsTo('GET', '/auth/confirm-email')).toHaveLength(1);
  });

  test('exibe "validando" enquanto aguarda a resposta', async ({ page, api }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/auth/confirm-email?**', async (route) => {
      await gate;
      await route.fallback();
    });

    await page.goto('/confirm-mail?token=lento');
    await expect(page.getByText('Validando seu token, aguarde...')).toBeVisible();

    release();
    await expect(page.getByText('Seu e-mail foi confirmado com sucesso.')).toBeVisible();
    expect(api.callsTo('GET', '/auth/confirm-email')).toHaveLength(1);
  });

  test('sem token mostra erro de token ausente', async ({ page }) => {
    await page.goto('/confirm-mail');

    await expect(page.getByText('Token ausente. Use o link enviado por e-mail.')).toBeVisible();
  });

  test('token inválido mostra erro e permite reenviar o link', async ({ page, api }) => {
    api.failNext('GET', '/auth/confirm-email', 400, { message: 'Token inválido ou expirado' });

    await page.goto('/confirm-mail?token=ruim');
    await expect(page.getByText('Token inválido ou expirado')).toBeVisible();

    const email = page.locator('#email');
    await email.fill('aluno@alunos.utfpr.edu.br');
    await page.getByRole('button', { name: 'Reenviar link de confirmação' }).click();

    await expect(page.getByText('O link de confirmação foi reenviado para o seu e-mail.')).toBeVisible();
    expect(api.callsTo('POST', '/auth/confirm-email/resend')[0].body).toEqual({
      email: 'aluno@alunos.utfpr.edu.br',
    });
  });

  test('falha no reenvio mostra a mensagem do servidor e reabilita o botão', async ({ page, api }) => {
    api.failNext('GET', '/auth/confirm-email', 400, { message: 'Token inválido ou expirado' });
    api.failNext('POST', '/auth/confirm-email/resend', 429, { message: 'Aguarde antes de pedir outro link' });
    await page.goto('/confirm-mail?token=ruim');

    await page.locator('#email').fill('aluno@alunos.utfpr.edu.br');
    const resend = page.getByRole('button', { name: 'Reenviar link de confirmação' });
    await resend.click();

    await expect(page.getByText('Aguarde antes de pedir outro link')).toBeVisible();
    await expect(page.getByText('O link de confirmação foi reenviado para o seu e-mail.')).toHaveCount(0);
    await expect(resend).toBeEnabled();
  });

  test('falha no reenvio sem mensagem do servidor usa o texto padrão', async ({ page, api }) => {
    api.failNext('GET', '/auth/confirm-email', 400, { message: 'Token inválido ou expirado' });
    api.failNext('POST', '/auth/confirm-email/resend', 500, {});
    await page.goto('/confirm-mail?token=ruim');

    await page.locator('#email').fill('aluno@alunos.utfpr.edu.br');
    await page.getByRole('button', { name: 'Reenviar link de confirmação' }).click();

    await expect(page.getByText('Falha ao reenviar o link de confirmação.')).toBeVisible();
  });

  test('reenvio exige e-mail UTFPR válido', async ({ page, api }) => {
    await page.goto('/confirm-mail');

    await page.locator('#email').fill('alguem@gmail.com');
    await expect(page.getByText('O e-mail deve ser um UTFPR válido.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reenviar link de confirmação' })).toBeDisabled();
    expect(api.callsTo('POST', '/auth/confirm-email/resend')).toHaveLength(0);
  });

  test('"Ir para o login" navega ao login', async ({ page }) => {
    await page.goto('/confirm-mail');
    await page.getByRole('button', { name: 'Ir para o login' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
