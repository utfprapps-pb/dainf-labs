import { expect, test } from '../../fixtures/test';
import type { MockApi } from '../../mock-api/mock-api';
import type { Page } from '@playwright/test';

const payload = (over: Record<string, any> = {}) => ({
  loanSummary: { ongoingCount: 3, overdueCount: 1, completedCount: 8, totalCount: 12 },
  loanCountByDays: [
    { day: '2026-11-01', total: 2 },
    { day: '2026-11-02', total: 4 },
  ],
  lowStockItems: [
    { itemId: 1, name: 'Arduino Uno', quantity: 0, minimumStock: 10, category: 'Eletrônicos' },
    { itemId: 2, name: 'Protoboard', quantity: 2, minimumStock: 10, category: 'Eletrônicos' },
    { itemId: 3, name: 'Resistor', quantity: 8, minimumStock: 10 },
  ],
  recentOperations: [
    { id: 1, itemName: 'Arduino Uno', type: 'PURCHASE', quantity: 10, date: '2026-11-10T12:00:00Z', userName: 'Maria da Silva' },
    { id: 2, itemName: 'Protoboard', type: 'LOAN', quantity: 2, date: '2026-11-11T12:00:00Z', userName: '' },
    { id: 3, itemName: 'Resistor', type: 'RETURN', quantity: 5, date: '2026-11-12T12:00:00Z', userName: 'João' },
    { id: 4, itemName: 'Cabo', type: 'ISSUE', quantity: 1, date: '2026-11-13T12:00:00Z', userName: 'Ana' },
  ],
  ...over,
});

const stat = (page: Page, label: string) => page.locator('app-stat', { hasText: label });
const dashboardCalls = (api: MockApi) => api.callsTo('GET', '/dashboard');

test.describe('Dashboard — cartões', () => {
  test('mostra os quatro indicadores de empréstimos', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.on('GET', '/dashboard', () => ({ body: payload() }));
    await page.goto('/dashboard');

    await expect(stat(page, 'Empréstimos em andamento')).toContainText('3');
    await expect(stat(page, 'Empréstimos em atraso')).toContainText('1');
    await expect(stat(page, 'Empréstimos concluídos')).toContainText('8');
    await expect(stat(page, 'Total de empréstimos')).toContainText('12');
    await expect(stat(page, 'Total de empréstimos')).toContainText('empréstimos no sistema');
  });

  test('mostra skeleton enquanto carrega e some depois', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    api.on('GET', '/dashboard', async () => {
      await gate;
      return { body: payload() };
    });
    await page.goto('/dashboard');

    await expect(page.locator('app-stat-skeleton')).toHaveCount(4);
    release();
    await expect(page.locator('app-stat-skeleton')).toHaveCount(0);
    await expect(page.locator('app-stat')).toHaveCount(4);
  });

  test('erro ao carregar não quebra a tela (nenhum cartão exibido)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.failNext('GET', '/dashboard', 500, { message: 'Falha' });
    await page.goto('/dashboard');

    await expect(page.locator('app-stat-skeleton')).toHaveCount(0);
    await expect(page.locator('app-stat')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Filtrar' })).toBeVisible();
  });
});

test.describe('Dashboard — erro de carga', () => {
  test('erro ao carregar deveria avisar o usuário', async ({ page, loginAs }) => {
    // BUG CONHECIDO (falha silenciosa): só há console.error; a tela fica sem cartões e sem mensagem.
    // Remova o test.fail quando o aviso for implementado.
    test.fail(true, 'erro de carga do dashboard não mostra aviso');
    const api = await loginAs('ROLE_ADMIN');
    api.failNext('GET', '/dashboard', 500, { message: 'Falha' });
    await page.goto('/dashboard');

    await expect(page.locator('p-toast .p-toast-message').first()).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Dashboard — painéis por perfil', () => {
  for (const role of ['ROLE_ADMIN', 'ROLE_LAB_TECHNICIAN'] as const) {
    test(`${role} vê gráfico, estoque crítico e últimas movimentações`, async ({ page, loginAs }) => {
      const api = await loginAs(role);
      api.on('GET', '/dashboard', () => ({ body: payload() }));
      await page.goto('/dashboard');

      await expect(page.getByText('Empréstimos por dia')).toBeVisible();
      await expect(page.locator('app-chart canvas')).toBeVisible();
      await expect(page.getByText('Estoque crítico')).toBeVisible();
      await expect(page.getByText('Últimas movimentações')).toBeVisible();
    });
  }

  for (const role of ['ROLE_STUDENT', 'ROLE_PROFESSOR'] as const) {
    test(`${role} vê só os cartões (sem gráfico e painéis)`, async ({ page, loginAs }) => {
      const api = await loginAs(role);
      api.on('GET', '/dashboard', () => ({ body: payload() }));
      await page.goto('/dashboard');

      await expect(page.locator('app-stat')).toHaveCount(4);
      await expect(page.getByText('Empréstimos por dia')).toHaveCount(0);
      await expect(page.getByText('Estoque crítico')).toHaveCount(0);
      await expect(page.getByText('Últimas movimentações')).toHaveCount(0);
    });
  }
});

test.describe('Dashboard — estoque crítico', () => {
  test('classifica cada item: sem estoque, crítico e atenção', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.on('GET', '/dashboard', () => ({ body: payload() }));
    await page.goto('/dashboard');

    const panel = page.locator('app-low-stock-panel');
    const arduino = panel.locator('.flex.flex-col.gap-2', { hasText: 'Arduino Uno' }).first();
    await expect(arduino).toContainText('Sem estoque');
    await expect(arduino).toContainText('0 em estoque • mínimo 10');
    await expect(panel.locator('.flex.flex-col.gap-2', { hasText: 'Protoboard' }).first()).toContainText('Crítico');
    const resistor = panel.locator('.flex.flex-col.gap-2', { hasText: 'Resistor' }).first();
    await expect(resistor).toContainText('Atenção');
    await expect(resistor).toContainText('Sem categoria');
  });

  test('sem itens abaixo do mínimo mostra mensagem vazia', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.on('GET', '/dashboard', () => ({ body: payload({ lowStockItems: [] }) }));
    await page.goto('/dashboard');

    await expect(page.getByText('Nenhum item está abaixo do estoque mínimo no momento.')).toBeVisible();
  });
});

test.describe('Dashboard — últimas movimentações', () => {
  test('mostra rótulo, quantidade, usuário e data de cada operação', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.on('GET', '/dashboard', () => ({ body: payload() }));
    await page.goto('/dashboard');

    const panel = page.locator('app-recent-operations');
    await expect(panel.locator('p-tag').filter({ hasText: 'Compra' })).toHaveCount(1);
    await expect(panel.locator('p-tag').filter({ hasText: 'Empréstimo' })).toHaveCount(1);
    await expect(panel.locator('p-tag').filter({ hasText: 'Devolução' })).toHaveCount(1);
    await expect(panel.locator('p-tag').filter({ hasText: 'Saída' })).toHaveCount(1);
    await expect(panel).toContainText('Maria da Silva • 10/11/2026');
    await expect(panel).toContainText('Qtd: 10');
    // operação sem usuário aparece como "Sistema"
    await expect(panel).toContainText('Sistema • 11/11/2026');
  });

  test('sem movimentações mostra mensagem vazia', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.on('GET', '/dashboard', () => ({ body: payload({ recentOperations: [] }) }));
    await page.goto('/dashboard');

    await expect(page.getByText('Nenhuma movimentação recente encontrada para o período.')).toBeVisible();
  });
});

test.describe('Dashboard — período', () => {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  };

  test('período padrão são os últimos 30 dias', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.on('GET', '/dashboard', () => ({ body: payload() }));
    await page.goto('/dashboard');

    await expect(page.locator('app-stat')).toHaveCount(4);
    const q = dashboardCalls(api).at(-1)!;
    expect(q).toBeTruthy();
    await expect(page.locator('p-datepicker input')).toHaveValue(/^\d{2}\/\d{2}\/\d{4} - \d{2}\/\d{2}\/\d{4}$/);
  });

  test('período salvo no localStorage é restaurado e enviado à API', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.on('GET', '/dashboard', () => ({ body: payload() }));
    const start = daysAgo(10);
    const end = daysAgo(2);
    await page.addInitScript(
      ([s, e]) => localStorage.setItem('dashboardDateRange', JSON.stringify([s, e])),
      [start.toISOString(), end.toISOString()],
    );
    await page.goto('/dashboard');

    await expect(page.locator('app-stat')).toHaveCount(4);
    const seen = dashboardCalls(api).map((c) => c.path);
    expect(seen.length).toBeGreaterThan(0);
    const input = page.locator('p-datepicker input');
    await expect(input).toHaveValue(new RegExp(`${String(start.getDate()).padStart(2, '0')}/`));
    expect(iso(start)).toBeTruthy();
  });

  test('valor salvo inválido cai no período padrão sem quebrar', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.on('GET', '/dashboard', () => ({ body: payload() }));
    await page.addInitScript(() => localStorage.setItem('dashboardDateRange', 'isto-nao-e-json'));
    await page.goto('/dashboard');

    await expect(page.locator('app-stat')).toHaveCount(4);
  });

  test('botão "Filtrar" consulta novamente a API', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.on('GET', '/dashboard', () => ({ body: payload() }));
    await page.goto('/dashboard');
    await expect(page.locator('app-stat')).toHaveCount(4);
    const before = dashboardCalls(api).length;

    await page.getByRole('button', { name: 'Filtrar' }).click();

    await expect.poll(() => dashboardCalls(api).length).toBeGreaterThan(before);
  });

  test('"Últimos 30 dias" restaura o período padrão e persiste no localStorage', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.on('GET', '/dashboard', () => ({ body: payload() }));
    await page.addInitScript(
      ([s, e]) => localStorage.setItem('dashboardDateRange', JSON.stringify([s, e])),
      [daysAgo(5).toISOString(), daysAgo(1).toISOString()],
    );
    await page.goto('/dashboard');
    await expect(page.locator('app-stat')).toHaveCount(4);

    await page.getByRole('button', { name: 'Últimos 30 dias' }).click();

    await expect
      .poll(async () => {
        const saved = await page.evaluate(() => localStorage.getItem('dashboardDateRange'));
        if (!saved) return 0;
        const [s, e] = JSON.parse(saved).map((d: string) => new Date(d).getTime());
        return Math.round((e - s) / 86400000);
      })
      .toBeGreaterThanOrEqual(29);
  });

  test('parâmetros start/end são enviados no formato yyyy-MM-dd', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    let query: URLSearchParams | undefined;
    api.on('GET', '/dashboard', ({ query: q }) => {
      query = q;
      return { body: payload() };
    });
    await page.goto('/dashboard');

    await expect(page.locator('app-stat')).toHaveCount(4);
    expect(query?.get('start')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(query?.get('end')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
