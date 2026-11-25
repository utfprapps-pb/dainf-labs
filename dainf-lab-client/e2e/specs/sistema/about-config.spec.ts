import { expect, test } from '../../fixtures/test';
import type { MockApi } from '../../mock-api/mock-api';
import { toast } from '../../pages/primeng';
import type { Page } from '@playwright/test';

// ───────────────────────────────── Sobre ─────────────────────────────────

const mockBuildInfo = (page: Page, version = '1.1.0') =>
  page.route('**/build-info.json', (route) => route.fulfill({ json: { version, buildTime: '2026-11-10T15:30:00Z' } }));

test.describe('Sobre o sistema', () => {
  test('mostra versão e build do frontend e do backend', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_LAB_TECHNICIAN');
    api.on('GET', '/info', () => ({
      body: { version: '2.3.4', artifact: 'dainf-lab-server', name: 'DAINF Lab', buildTime: '2026-11-09T10:00:00Z' },
    }));
    await mockBuildInfo(page, '1.1.0');
    await page.goto('/about');

    await expect(page.getByRole('heading', { name: 'Sobre o Sistema' })).toBeVisible();
    const front = page.locator('p-card', { hasText: 'Frontend' });
    await expect(front).toContainText('1.1.0');
    await expect(front).toContainText('10/11/2026');
    const back = page.locator('p-card', { hasText: 'Backend' });
    await expect(back).toContainText('2.3.4');
    await expect(back).toContainText('dainf-lab-server');
    await expect(back).toContainText('09/11/2026');
  });

  test('mostra skeleton enquanto carrega', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    api.on('GET', '/info', async () => {
      await gate;
      return { body: { version: '2.3.4', artifact: 'x', name: 'y', buildTime: '2026-11-09T10:00:00Z' } };
    });
    await mockBuildInfo(page);
    await page.goto('/about');

    await expect(page.locator('app-info-skeleton')).toHaveCount(2);
    release();
    await expect(page.locator('app-info-skeleton')).toHaveCount(0);
    await expect(page.locator('app-info-rows')).toHaveCount(2);
  });

  test('falha na API tira o skeleton e não quebra a tela', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.failNext('GET', '/info', 500);
    await mockBuildInfo(page);
    await page.goto('/about');

    await expect(page.locator('app-info-skeleton')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sobre o Sistema' })).toBeVisible();
  });

  test('falha na API deveria avisar o usuário', async ({ page, loginAs }) => {
    // BUG CONHECIDO (falha silenciosa): a tela só tira o skeleton e fica vazia, sem mensagem.
    // Remova o test.fail quando o aviso for implementado.
    test.fail(true, 'erro de carga de "Sobre" não mostra aviso');
    const api = await loginAs('ROLE_ADMIN');
    api.failNext('GET', '/info', 500);
    await mockBuildInfo(page);
    await page.goto('/about');

    await expect(page.locator('p-toast .p-toast-message').first()).toBeVisible({ timeout: 3000 });
  });

  test('professor e aluno não acessam', async ({ page, loginAs }) => {
    await loginAs('ROLE_PROFESSOR');
    await page.goto('/about');
    await expect(page).not.toHaveURL(/\/about$/);
  });
});

// ─────────────────────────────── Configurações ───────────────────────────────

interface Config {
  id: number;
  clearanceEmailRecipient: string | null;
  useMinimumStockValidator: boolean;
}

const stubConfig = (api: MockApi, initial: Config) => {
  let current = { ...initial };
  api.on('GET', '/configuration', () => ({ body: current }));
  api.on('PUT', '/configuration', ({ body }) => {
    current = { ...current, ...body };
    return { body: current };
  });
  return () => current;
};

const emailField = (page: Page) => page.locator('#clearanceEmailRecipient');
const toggle = (page: Page) => page.locator('p-toggleswitch');

test.describe('Configurações', () => {
  test('carrega o e-mail do nada consta e o estado do validador de estoque', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubConfig(api, { id: 1, clearanceEmailRecipient: 'biblioteca@utfpr.edu.br', useMinimumStockValidator: false });
    await page.goto('/configuration');

    await expect(emailField(page)).toHaveValue('biblioteca@utfpr.edu.br');
    await expect(toggle(page).locator('input')).not.toBeChecked();
  });

  test('o validador de estoque mínimo vem ligado por padrão quando não há configuração', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.on('GET', '/configuration', () => ({ body: {} }));
    await page.goto('/configuration');

    await expect(toggle(page).locator('input')).toBeChecked();
    await expect(emailField(page)).toHaveValue('');
  });

  test('salva alterações e recarrega a configuração', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    const current = stubConfig(api, { id: 1, clearanceEmailRecipient: 'antigo@utfpr.edu.br', useMinimumStockValidator: true });
    await page.goto('/configuration');
    await expect(emailField(page)).toHaveValue('antigo@utfpr.edu.br');
    const before = api.callsTo('GET', '/configuration').length;

    await emailField(page).fill('novo@utfpr.edu.br');
    await toggle(page).click();
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    const put = api.callsTo('PUT', '/configuration')[0].body;
    expect(put).toMatchObject({ id: 1, clearanceEmailRecipient: 'novo@utfpr.edu.br', useMinimumStockValidator: false });
    expect(current().clearanceEmailRecipient).toBe('novo@utfpr.edu.br');
    expect(api.callsTo('GET', '/configuration').length).toBeGreaterThan(before);
  });

  test('e-mail obrigatório: não salva e avisa', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubConfig(api, { id: 1, clearanceEmailRecipient: 'a@utfpr.edu.br', useMinimumStockValidator: true });
    await page.goto('/configuration');
    await expect(emailField(page)).toHaveValue('a@utfpr.edu.br');

    await emailField(page).fill('');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(toast(page, 'Por favor, preencha todos os campos obrigatórios.')).toBeVisible();
    expect(api.callsTo('PUT', '/configuration')).toHaveLength(0);
  });

  test('e-mail em formato inválido: não salva', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    stubConfig(api, { id: 1, clearanceEmailRecipient: 'a@utfpr.edu.br', useMinimumStockValidator: true });
    await page.goto('/configuration');
    await expect(emailField(page)).toHaveValue('a@utfpr.edu.br');

    await emailField(page).fill('isto-nao-e-email');
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(toast(page, 'Por favor, preencha todos os campos obrigatórios.')).toBeVisible();
    expect(api.callsTo('PUT', '/configuration')).toHaveLength(0);
  });

  test('somente administrador acessa', async ({ page, loginAs }) => {
    await loginAs('ROLE_LAB_TECHNICIAN');
    await page.goto('/configuration');
    await expect(page).not.toHaveURL(/\/configuration$/);
  });
});
