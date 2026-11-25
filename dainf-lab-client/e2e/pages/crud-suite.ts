import { expect, test } from '../fixtures/test';
import type { Role } from '../fixtures/roles';
import { CrudPage } from './crud-page';
import { toast } from './primeng';

export interface CrudSuiteOptions {
  /** rota do front (ex.: 'category') */
  route: string;
  /** coleção da API (ex.: 'categories') */
  collection: string;
  /** título da tela (config.title): header do dialog e nome do CSV */
  title: string;
  /** perfil usado para logar */
  role?: Role;
  /** gera um registro; `i` começa em 1 */
  make: (i: number) => Record<string, any> & { id: number };
  /** texto exibido na tabela para o registro gerado por make(i) */
  label: (i: number) => string;
  /** quantos registros semear já com a coleção existente (ex.: usuário logado conta como 1) */
  baseline?: number;
  /** endpoint de busca, se diferente de /{collection}/search (ex.: itens usam /items/search/all) */
  searchPath?: string;
  /** a tela permite exclusão pelo botão da linha? (default true) */
  deletable?: boolean;
}

/**
 * Bateria padrão para qualquer tela baseada em `app-crud`:
 * listar, estado vazio, paginar, exportar, editar (abrir/cancelar), excluir (aceitar/recusar/erro),
 * erro de carga e abertura por ?openId=.
 */
export function crudSuite(o: CrudSuiteOptions) {
  const role = o.role ?? 'ROLE_ADMIN';
  const baseline = o.baseline ?? 0;
  const searchPath = o.searchPath ?? `/${o.collection}/search`;
  const rowsOf = (n: number) => Array.from({ length: n }, (_, i) => o.make(i + 1));

  test.describe(`${o.title} — comportamento padrão de CRUD`, () => {
    test('lista os registros', async ({ page, loginAs }) => {
      const api = await loginAs(role);
      api.db.seed(o.collection, rowsOf(3));
      const crud = new CrudPage(page, o.route);
      await crud.goto();

      await expect(crud.row(o.label(1))).toHaveCount(1);
      await expect(crud.row(o.label(2))).toHaveCount(1);
      await expect(crud.row(o.label(3))).toHaveCount(1);
    });

    test('mostra mensagem quando não há registros', async ({ page, loginAs }) => {
      const api = await loginAs(role);
      api.db.seed(o.collection, []);
      const crud = new CrudPage(page, o.route);
      await crud.goto();

      if (baseline === 0) await expect(crud.emptyMessage).toBeVisible();
    });

    test('pagina os resultados (10 por página)', async ({ page, loginAs }) => {
      const api = await loginAs(role);
      api.db.seed(o.collection, rowsOf(25));
      const crud = new CrudPage(page, o.route);
      await crud.goto();

      await expect(crud.rows).toHaveCount(10);
      await expect(crud.pageReport).toContainText('de 25 itens');

      // Algumas telas recarregam a lista ~600ms após abrir (filtro depende do perfil carregado) e voltam à
      // página 1; por isso o clique é repetido até a página 2 estabilizar.
      await expect(async () => {
        if ((await crud.row(o.label(11)).count()) === 0) await crud.nextPage();
        await expect(crud.row(o.label(11))).toHaveCount(1, { timeout: 1500 });
      }).toPass({ timeout: 15000 });
      await expect(crud.row(o.label(1))).toHaveCount(0);
      const last = api.callsTo('POST', searchPath).at(-1)!;
      expect(last.body).toMatchObject({ page: 1, rows: 10 });
    });

    test('exporta CSV com os registros', async ({ page, loginAs }) => {
      const api = await loginAs(role);
      api.db.seed(o.collection, rowsOf(2));
      const crud = new CrudPage(page, o.route);
      await crud.goto();
      await expect(crud.row(o.label(1))).toHaveCount(1);

      const [download] = await Promise.all([page.waitForEvent('download'), crud.exportButton.click()]);
      expect(download.suggestedFilename()).toBe(`${o.title}.csv`);
      const path = await download.path();
      const csv = (await import('node:fs')).readFileSync(path, 'utf8');
      expect(csv).toContain(o.label(1));
      expect(csv).toContain(o.label(2));
    });

    test('exportar sem dados avisa o usuário', async ({ page, loginAs }) => {
      test.skip(baseline > 0, 'coleção sempre tem ao menos o usuário logado');
      const api = await loginAs(role);
      api.db.seed(o.collection, []);
      const crud = new CrudPage(page, o.route);
      await crud.goto();

      await crud.exportButton.click();
      await expect(toast(page, 'Nenhum dado para exportar.')).toBeVisible();
    });

    test('erro ao carregar a lista mostra aviso', async ({ page, loginAs }) => {
      const api = await loginAs(role);
      api.failNext('POST', searchPath, 500);
      await page.goto(`/${o.route}`);

      await expect(toast(page, 'Falha ao carregar os registros.')).toBeVisible();
    });

    test('editar: abre o dialog carregando o registro e cancelar não salva', async ({ page, loginAs }) => {
      const api = await loginAs(role);
      api.db.seed(o.collection, rowsOf(2));
      const crud = new CrudPage(page, o.route);
      await crud.goto();

      await crud.openEdit(o.label(2));
      await expect(crud.dialog).toContainText(o.title);
      expect(api.callsTo('GET', `/${o.collection}/2`)).toHaveLength(1);

      await crud.cancelButton.click();
      await expect(crud.dialog).toBeHidden();
      expect(api.callsTo('PUT', `/${o.collection}/2`)).toHaveLength(0);
    });

    test('abre o registro direto por ?openId=', async ({ page, loginAs }) => {
      const api = await loginAs(role);
      api.db.seed(o.collection, rowsOf(3));
      await page.goto(`/${o.route}?openId=2`);

      const crud = new CrudPage(page, o.route);
      await expect(crud.dialog).toBeVisible();
      expect(api.callsTo('GET', `/${o.collection}/2`)).toHaveLength(1);
      await expect(page).not.toHaveURL(/openId/);
    });

    test('novo: cancelar fecha o dialog sem criar', async ({ page, loginAs }) => {
      const api = await loginAs(role);
      api.db.seed(o.collection, rowsOf(1));
      const crud = new CrudPage(page, o.route);
      await crud.goto();

      await crud.openNew();
      await crud.cancelButton.click();
      await expect(crud.dialog).toBeHidden();
      expect(api.callsTo('POST', `/${o.collection}`)).toHaveLength(0);
    });

    test('salvar vazio não envia e avisa para verificar o formulário', async ({ page, loginAs }) => {
      const api = await loginAs(role);
      api.db.seed(o.collection, rowsOf(1));
      const crud = new CrudPage(page, o.route);
      await crud.goto();

      await crud.openNew();
      await crud.save();

      await expect(toast(page, 'Por favor, verifique os campos do formulário.')).toBeVisible();
      expect(api.callsTo('POST', `/${o.collection}`)).toHaveLength(0);
      await expect(crud.dialog).toBeVisible();
    });

    if (o.deletable !== false) {
      test('excluir: confirmar remove o registro', async ({ page, loginAs }) => {
        const api = await loginAs(role);
        api.db.seed(o.collection, rowsOf(3));
        const crud = new CrudPage(page, o.route);
        await crud.goto();

        await crud.deleteButton(o.label(2)).click();
        await expect(crud.confirm).toContainText('Deseja realmente excluir este registro?');
        await crud.confirmYes();

        await expect(crud.row(o.label(2))).toHaveCount(0);
        await expect(crud.row(o.label(1))).toHaveCount(1);
        expect(api.callsTo('DELETE', `/${o.collection}/2`)).toHaveLength(1);
      });

      test('excluir: recusar mantém o registro', async ({ page, loginAs }) => {
        const api = await loginAs(role);
        api.db.seed(o.collection, rowsOf(2));
        const crud = new CrudPage(page, o.route);
        await crud.goto();

        await crud.deleteButton(o.label(1)).click();
        await crud.confirmNo();

        await expect(crud.confirm).toBeHidden();
        await expect(crud.row(o.label(1))).toHaveCount(1);
        expect(api.callsTo('DELETE', `/${o.collection}/1`)).toHaveLength(0);
      });

      test('excluir: erro do servidor (registro em uso) mostra aviso', async ({ page, loginAs }) => {
        const api = await loginAs(role);
        api.db.seed(o.collection, rowsOf(2));
        api.failNext('DELETE', `/${o.collection}/1`, 409, { message: 'Registro em uso' });
        const crud = new CrudPage(page, o.route);
        await crud.goto();

        await crud.deleteButton(o.label(1)).click();
        await crud.confirmYes();

        await expect(toast(page, 'Falha ao deletar o registro: Registro em uso')).toBeVisible();
        await expect(crud.row(o.label(1))).toHaveCount(1);
      });
    }
  });
}
