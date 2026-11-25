import { expect, test } from '../../fixtures/test';

test.describe('Validação de Nada Consta (página pública)', () => {
  test('código válido mostra os dados do documento', async ({ page, api }) => {
    api.on('GET', '/clearance/validate', ({ query }) => ({
      body: {
        nomeAluno: 'Ana Souza',
        matricula: '2012345',
        dataEmissao: '2026-11-20T14:30:00',
        codigoValidacao: query.get('code'),
      },
    }));

    await page.goto('/clearance?code=ABC-123');

    await expect(page.getByText('Documento validado')).toBeVisible();
    await expect(page.getByTestId('student-name')).toHaveText('Ana Souza');
    await expect(page.getByTestId('student-id')).toContainText('2012345');
    await expect(page.getByText('Código de validação: ABC-123')).toBeVisible();
    await expect(page.getByText('20/11/2026 14:30')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir para o login' })).toBeVisible();
  });

  test('código inexistente mostra erro', async ({ page, api }) => {
    api.failNext('GET', '/clearance/validate', 404, { message: 'Código inválido ou não encontrado.' });

    await page.goto('/clearance?code=ZZZ');

    await expect(page.getByText('Código inválido ou não encontrado.')).toBeVisible();
    await expect(page.getByText('Documento validado')).toHaveCount(0);
  });

  test('sem código informa que o código não foi informado', async ({ page, api }) => {
    await page.goto('/clearance');

    await expect(page.getByText('Código não informado.')).toBeVisible();
    expect(api.callsTo('GET', '/clearance/validate')).toHaveLength(0);
  });

  test('não exige login', async ({ page, api }) => {
    api.on('GET', '/clearance/validate', () => ({
      body: { nomeAluno: 'Ana', matricula: '1', dataEmissao: '2026-11-20T10:00:00', codigoValidacao: 'X' },
    }));
    await page.goto('/clearance?code=X');
    await expect(page).toHaveURL(/\/clearance/);
  });
});
