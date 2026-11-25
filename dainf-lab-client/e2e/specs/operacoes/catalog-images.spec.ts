import { makeItem } from '../../fixtures/data';
import { expect, test } from '../../fixtures/test';
import { toast } from '../../pages/primeng';
import type { Page } from '@playwright/test';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');

const card = (page: Page, name: string) => page.locator('.card .grid > div').filter({ hasText: name }).first();

/** URL assinada (texto puro) por objeto: 'ruim/...' falha, o resto devolve uma imagem válida. */
async function stubSignedUrls(page: Page) {
  const asked: string[] = [];
  await page.route(/\/api\/items\/storage\/signed-url/, (route) => {
    const req = route.request();
    const headers = { ...CORS, 'access-control-allow-origin': req.headers()['origin'] ?? '*', 'access-control-allow-credentials': 'true' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const object = new URL(req.url()).searchParams.get('objectName') ?? '';
    asked.push(object);
    if (object.startsWith('ruim/')) return route.fulfill({ status: 404, headers, body: 'nao existe' });
    return route.fulfill({ status: 200, headers, contentType: 'text/plain', body: `http://api.test/img/${encodeURIComponent(object)}` });
  });
  await page.route('http://api.test/img/**', (route) =>
    route.fulfill({ status: 200, headers: CORS, contentType: 'image/png', body: PNG }),
  );
  return asked;
}

test.describe('Catálogo — imagens dos itens', () => {
  test('item com foto mostra a imagem pela URL assinada; sem foto mostra o ícone', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('items', [
      makeItem(1, { name: 'Com Foto', images: [{ name: 'itens/1/a.png', originalName: 'a.png' }] }),
      makeItem(2, { name: 'Sem Foto', images: [] }),
    ] as any);
    const asked = await stubSignedUrls(page);
    await page.goto('/item');

    await expect(card(page, 'Com Foto').locator('img')).toHaveAttribute('src', /api\.test\/img\/itens%2F1%2Fa\.png/);
    await expect(card(page, 'Sem Foto').locator('img')).toHaveCount(0);
    await expect(card(page, 'Sem Foto').locator('.pi-image')).toBeVisible();
    expect(asked).toContain('itens/1/a.png');
  });

  test('caminho inválido cai para a próxima foto do item', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('items', [
      makeItem(1, { name: 'Duas Fotos', images: [{ name: 'ruim/1.png' }, { name: 'itens/1/boa.png' }] }),
    ] as any);
    const asked = await stubSignedUrls(page);
    await page.goto('/item');

    await expect(card(page, 'Duas Fotos').locator('img')).toHaveAttribute('src', /itens%2F1%2Fboa\.png/);
    expect(asked).toEqual(['ruim/1.png', 'itens/1/boa.png']);
  });

  test('todas as fotos inválidas: mostra o ícone no lugar da imagem', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('items', [makeItem(1, { name: 'Quebrado', images: [{ name: 'ruim/1.png' }, { name: 'ruim/2.png' }] })] as any);
    await stubSignedUrls(page);
    await page.goto('/item');

    await expect(card(page, 'Quebrado').locator('.pi-image')).toBeVisible();
    await expect(card(page, 'Quebrado').locator('img')).toHaveCount(0);
  });

  test('foto com URL http é usada direto, sem pedir URL assinada', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('items', [makeItem(1, { name: 'Direta', images: ['http://api.test/img/direta.png'] })] as any);
    const asked = await stubSignedUrls(page);
    await page.goto('/item');

    await expect(card(page, 'Direta').locator('img')).toHaveAttribute('src', 'http://api.test/img/direta.png');
    expect(asked).toHaveLength(0);
  });

  test('imagem que falha ao carregar (erro do <img>) troca para a próxima foto e depois para o ícone', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('items', [makeItem(1, { name: 'Imagem Corrompida', images: [{ name: 'itens/1/corrompida.png' }] })] as any);
    await stubSignedUrls(page);
    await page.route('http://api.test/img/**', (route) => route.fulfill({ status: 404, headers: CORS, body: 'x' })); // sobrescreve: imagem não carrega
    await page.goto('/item');

    await expect(card(page, 'Imagem Corrompida').locator('.pi-image')).toBeVisible();
  });

  test('o dialog de detalhes mostra a imagem do item', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.db.seed('items', [makeItem(1, { name: 'Com Foto', images: [{ name: 'itens/1/a.png' }] })] as any);
    await stubSignedUrls(page);
    await page.goto('/item');

    await card(page, 'Com Foto').getByRole('button', { name: 'Ver detalhes' }).click();

    await expect(page.locator('.p-dialog', { hasText: 'Com Foto' }).locator('img.product-image')).toHaveAttribute('src', /itens%2F1%2Fa\.png/);
  });

  test('erro ao buscar o catálogo deixa a lista vazia e encerra o carregamento', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_STUDENT');
    api.failNext('POST', '/items/search', 500, { message: 'Catálogo indisponível' });
    await page.goto('/item');

    await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible();
    await expect(page.locator('.card .grid > div')).toHaveCount(0);
    await expect(page.locator('p-skeleton, .p-skeleton')).toHaveCount(0);
  });

  test('erro ao buscar o catálogo deveria avisar o usuário', async ({ page, loginAs }) => {
    // BUG CONHECIDO (falha silenciosa): o catálogo só faz console.error, como o dashboard e a tela "Sobre".
    // Os cadastros (app-crud) mostram toast. Remova o test.fail quando o aviso for implementado.
    test.fail(true, 'erro de carga do catálogo não mostra aviso');
    const api = await loginAs('ROLE_STUDENT');
    api.failNext('POST', '/items/search', 500, { message: 'Catálogo indisponível' });
    await page.goto('/item');

    await expect(toast(page, /Catálogo indisponível|Falha/)).toBeVisible({ timeout: 3000 });
  });
});
