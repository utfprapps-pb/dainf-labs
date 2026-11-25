import { itemCustomFilters, makeCategory, makeItem } from '../../fixtures/data';
import { expect, test } from '../../fixtures/test';
import { CrudPage } from '../../pages/crud-page';
import { selectOption, toast } from '../../pages/primeng';
import type { Page } from '@playwright/test';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');

/**
 * Storage falso. O backend devolve a URL assinada como texto puro (não JSON).
 * Conta os uploads (PUT) concluídos: a miniatura aparece antes do upload terminar, então os testes
 * esperam o contador antes de salvar/remover.
 */
/** CORS com credenciais (a API é chamada com withCredentials): eco da origem. */
const apiCors = (origin?: string) => ({ ...CORS, 'access-control-allow-origin': origin ?? '*', 'access-control-allow-credentials': 'true' });

async function stubStorage(page: Page, opts: { signedUrlStatus?: number } = {}) {
  const stats = { signedUrls: 0, puts: 0 };
  await page.route(/\/api\/items\/storage\/signed-url/, (route) => {
    const headers = apiCors(route.request().headers()['origin']);
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    stats.signedUrls++;
    if (opts.signedUrlStatus && opts.signedUrlStatus !== 200) {
      return route.fulfill({ status: opts.signedUrlStatus, headers, contentType: 'text/plain', body: 'erro' });
    }
    return route.fulfill({ status: 200, headers, contentType: 'text/plain', body: 'http://api.test/upload/objeto.png' });
  });
  await page.route('http://api.test/upload/**', (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (method === 'PUT') stats.puts++;
    return route.fulfill({ status: 200, headers: CORS, contentType: 'image/png', body: method === 'GET' ? PNG : '' });
  });
  return stats;
}

/** Espera n uploads concluírem e o componente atualizar o valor do formulário. */
async function uploaded(page: Page, stats: { puts: number }, n: number) {
  await expect.poll(() => stats.puts).toBe(n);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test.beforeEach(async ({ api }) => {
  api.db.customFilters('items', itemCustomFilters).defaults('items', { active: true, quantity: 0 });
  api.db.seed('categories', [makeCategory(1, 'Eletrônicos')]);
});

async function fillRequired(page: Page, crud: CrudPage, name: string) {
  const d = crud.dialog;
  await d.locator('#name').fill(name);
  await d.locator('#description').fill('Descrição');
  await selectOption(page, d.locator('app-static-select'), 'Consumível');
  await d.locator('#location').fill('Gaveta C');
  await d.locator('#siorg').fill('S-1');
  await d.locator('p-treeselect').click();
  await page.getByRole('treeitem', { name: /Eletrônicos/ }).click();
}

const send = (crud: CrudPage, ...names: string[]) =>
  crud.dialog.locator('input[type=file]').first().setInputFiles(names.map((name) => ({ name, mimeType: 'image/png', buffer: PNG })));

test.describe('Itens — fotos', () => {
  test('envia fotos, mostra as miniaturas e salva o item com as imagens', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('items', []);
    const stats = await stubStorage(page);
    const crud = new CrudPage(page, 'item');
    await crud.goto();
    await crud.openNew();
    await fillRequired(page, crud, 'Capacitor');

    await send(crud, 'frente.png', 'verso.png');

    await expect(crud.dialog.locator('p-image img[alt="frente.png"]')).toBeVisible();
    await expect(crud.dialog.locator('p-image img[alt="verso.png"]')).toBeVisible();
    await uploaded(page, stats, 2);
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    const images = api.callsTo('POST', '/items')[0].body.images;
    expect(images.map((i: any) => i.originalName).sort()).toEqual(['frente.png', 'verso.png']);
    expect(images.every((i: any) => i.name.startsWith('temp/') && i.contentType === 'image/png')).toBe(true);
    expect(stats.signedUrls).toBeGreaterThanOrEqual(2);
  });

  test('o mesmo arquivo enviado duas vezes não duplica a imagem', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('items', []);
    const stats = await stubStorage(page);
    const crud = new CrudPage(page, 'item');
    await crud.goto();
    await crud.openNew();
    await fillRequired(page, crud, 'Capacitor');

    await send(crud, 'frente.png');
    await expect(crud.dialog.locator('p-image img[alt="frente.png"]')).toBeVisible();
    await uploaded(page, stats, 1);
    await send(crud, 'frente.png');
    await uploaded(page, stats, 2);
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    expect(api.callsTo('POST', '/items')[0].body.images).toHaveLength(1);
  });

  test('remover uma miniatura a tira do item salvo', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('items', []);
    const stats = await stubStorage(page);
    const crud = new CrudPage(page, 'item');
    await crud.goto();
    await crud.openNew();
    await fillRequired(page, crud, 'Capacitor');
    await send(crud, 'frente.png', 'verso.png');
    await expect(crud.dialog.locator('p-image img[alt="verso.png"]')).toBeVisible();
    await uploaded(page, stats, 2);

    await crud.dialog.locator('p-carousel .card', { hasText: 'verso.png' }).locator('button:has(.pi-times)').click();

    await expect(crud.dialog.locator('p-image img[alt="verso.png"]')).toHaveCount(0);
    await crud.save();
    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    expect(api.callsTo('POST', '/items')[0].body.images.map((i: any) => i.originalName)).toEqual(['frente.png']);
  });

  test('editar item carrega as fotos existentes pela URL assinada', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('items', [
      makeItem(1, { name: 'Capacitor', images: [{ bucket: 'b', contentType: 'image/png', name: 'itens/1/capa.png', originalName: 'capa.png' }] }),
    ] as any);
    const stats = await stubStorage(page);
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openEdit('Capacitor');

    await expect(crud.dialog.locator('p-image img[alt="itens/1/capa.png"]')).toBeVisible();
    expect(stats.signedUrls).toBeGreaterThan(0);
  });

  test('falha no envio da foto deveria avisar o usuário', async ({ page, loginAs }) => {
    // BUG CONHECIDO: quando o upload falha, a miniatura aparece mesmo assim e só há erro no console;
    // o item é salvo sem a foto e nenhum aviso é exibido. Este teste "falha" enquanto o bug existir
    // (test.fail) e passa a acusar quando for corrigido — aí remova o test.fail.
    test.fail(true, 'upload com erro não mostra aviso');
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('items', []);
    await stubStorage(page, { signedUrlStatus: 500 });
    const crud = new CrudPage(page, 'item');
    await crud.goto();
    await crud.openNew();
    await fillRequired(page, crud, 'Capacitor');

    await send(crud, 'frente.png');

    await expect(page.locator('p-toast .p-toast-message').first()).toBeVisible({ timeout: 3000 });
  });

  test('foto que não carrega do storage não impede abrir a edição', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('items', [
      makeItem(1, { name: 'Capacitor', images: [{ bucket: 'b', contentType: 'image/png', name: 'itens/1/capa.png', originalName: 'capa.png' }] }),
    ] as any);
    await stubStorage(page, { signedUrlStatus: 500 });
    const crud = new CrudPage(page, 'item');
    await crud.goto();

    await crud.openEdit('Capacitor');

    await expect(crud.dialog.locator('#name')).toHaveValue('Capacitor');
    await expect(crud.dialog.locator('p-image')).toHaveCount(0);
  });
});
