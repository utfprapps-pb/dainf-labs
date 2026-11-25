import AxeBuilder from '@axe-core/playwright';
import { makeCategory, makeItem } from '../../fixtures/data';
import type { Role } from '../../fixtures/roles';
import { expect, test } from '../../fixtures/test';

/**
 * Acessibilidade (WCAG 2 A/AA via axe-core) em modo "catraca":
 *
 *  - a tela NÃO pode ter regra violada que não esteja em BASELINE;
 *  - o nº de elementos com problema NÃO pode passar do teto registrado (exceto `color-contrast`,
 *    que oscila com tema/animação e só é checado por presença da regra).
 *
 * Os valores abaixo são a dívida de acessibilidade existente (botões só com ícone sem nome acessível,
 * campos sem label...). Ao corrigir, REDUZA o teto aqui — o objetivo é só ir para baixo.
 */
type Ceiling = Record<string, number>;

const NO_CEILING = Infinity;

const PAGES: { name: string; path: string; role: Role | null; ready: string; baseline: Ceiling }[] = [
  { name: 'login', ready: 'input', path: '/login', role: null, baseline: { 'button-name': 1, 'color-contrast': NO_CEILING, label: 1 } },
  { name: 'cadastro', ready: 'input', path: '/sign-up', role: null, baseline: { 'button-name': 1, 'color-contrast': NO_CEILING } },
  { name: 'recuperar senha', ready: 'input', path: '/forgot-password', role: null, baseline: { 'button-name': 1, 'color-contrast': NO_CEILING } },
  { name: 'dashboard', ready: 'app-stat', path: '/dashboard', role: 'ROLE_ADMIN', baseline: { 'button-name': 3, 'color-contrast': NO_CEILING, 'role-img-alt': 1 } },
  { name: 'categorias', ready: 'p-table', path: '/category', role: 'ROLE_ADMIN', baseline: { 'button-name': 5, 'color-contrast': NO_CEILING } },
  { name: 'fornecedores', ready: 'p-table', path: '/supplier', role: 'ROLE_ADMIN', baseline: { 'button-name': 3, 'color-contrast': NO_CEILING, 'scrollable-region-focusable': 1 } },
  { name: 'usuários', ready: 'p-table', path: '/user', role: 'ROLE_ADMIN', baseline: { 'button-name': 6, 'color-contrast': NO_CEILING } },
  { name: 'itens (gestão)', ready: 'p-table', path: '/item', role: 'ROLE_ADMIN', baseline: { 'button-name': 6, 'color-contrast': NO_CEILING } },
  { name: 'itens (catálogo)', ready: 'app-item-card, .card', path: '/item', role: 'ROLE_STUDENT', baseline: { 'aria-command-name': 2, 'button-name': 4, 'color-contrast': NO_CEILING } },
  { name: 'empréstimos', ready: 'p-table', path: '/loan', role: 'ROLE_ADMIN', baseline: { 'button-name': 3, 'color-contrast': NO_CEILING, 'scrollable-region-focusable': 1 } },
  { name: 'reservas', ready: 'p-table', path: '/reservation', role: 'ROLE_ADMIN', baseline: { 'button-name': 3, 'color-contrast': NO_CEILING, 'scrollable-region-focusable': 1 } },
  { name: 'compras', ready: 'p-table', path: '/purchase', role: 'ROLE_ADMIN', baseline: { 'button-name': 3, 'color-contrast': NO_CEILING, 'scrollable-region-focusable': 1 } },
  { name: 'histórico de estoque', ready: 'p-table', path: '/inventory-history', role: 'ROLE_ADMIN', baseline: { 'button-name': 3, 'color-contrast': NO_CEILING, 'scrollable-region-focusable': 1 } },
  { name: 'auditoria', ready: 'app-crud-table', path: '/audit', role: 'ROLE_ADMIN', baseline: { 'button-name': 4, 'color-contrast': NO_CEILING, label: 2, 'scrollable-region-focusable': 1 } },
  { name: 'configurações', ready: '#clearanceEmailRecipient', path: '/configuration', role: 'ROLE_ADMIN', baseline: { 'button-name': 3, 'color-contrast': NO_CEILING, label: 1 } },
  { name: 'sobre', ready: 'app-info-rows', path: '/about', role: 'ROLE_ADMIN', baseline: { 'button-name': 3, 'color-contrast': NO_CEILING } },
  { name: 'perfil', ready: '#nome', path: '/profile', role: 'ROLE_STUDENT', baseline: { 'button-name': 4, 'color-contrast': NO_CEILING, label: 6 } },
];

test.describe('Acessibilidade (axe, WCAG 2 A/AA) — sem regressão', () => {
  for (const p of PAGES) {
    test(`${p.name} não piora o baseline`, async ({ page, loginAs }) => {
      if (p.role) {
        const api = await loginAs(p.role);
        api.db.seed('categories', [makeCategory(1, 'Cabos')] as any);
        api.db.seed('items', [makeItem(1)] as any);
        api.on('GET', '/audit/entities', () => ({ body: [{ key: 'LOAN', label: 'Empréstimo' }] }));
        api.on('POST', '/audit/search', () => ({
          body: { content: [], page: { size: 10, number: 0, totalElements: 0, totalPages: 0 } },
        }));
        api.on('GET', '/info', () => ({ body: { version: '1', artifact: 'x', name: 'y', buildTime: '2026-11-10T15:30:00Z' } }));
      }
      await page.route('**/build-info.json', (r) => r.fulfill({ json: { version: '1', buildTime: '2026-11-10T15:30:00Z' } }));
      await page.goto(p.path);
      // espera a tela renderizar de verdade (rede ociosa + conteúdo da página) antes de varrer
      await page.waitForLoadState('networkidle');
      await expect(page.locator(p.ready).first()).toBeVisible();
      await expect(page.locator('p-skeleton, .p-skeleton, .layout-nav-loader')).toHaveCount(0);

      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

      const found = Object.fromEntries(violations.map((v) => [v.id, v.nodes.length]));
      const problems: string[] = [];
      for (const [rule, count] of Object.entries(found)) {
        const ceiling = p.baseline[rule];
        if (ceiling === undefined) problems.push(`regra nova: ${rule} (${count} elementos)`);
        else if (count > ceiling) problems.push(`${rule}: ${count} elementos (teto ${ceiling})`);
      }
      expect(problems, `Violações de acessibilidade novas em "${p.name}":\n${problems.join('\n')}`).toEqual([]);
    });
  }
});
