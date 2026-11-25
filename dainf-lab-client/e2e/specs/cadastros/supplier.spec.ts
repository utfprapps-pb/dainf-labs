import { expect, test } from '../../fixtures/test';
import { CrudPage } from '../../pages/crud-page';
import { crudSuite } from '../../pages/crud-suite';
import { toast, typeMasked } from '../../pages/primeng';

const pad = (i: number) => String(i).padStart(3, '0');

const supplier = (i: number, over: Record<string, any> = {}) => ({
  id: i,
  razaoSocial: `Razão Social ${pad(i)} LTDA`,
  nomeFantasia: `Fornecedor ${pad(i)}`,
  cnpj: '11222333000181',
  ie: '123456',
  telefone: '46999887766',
  email: `contato${i}@fornecedor.com`,
  endereco: 'Rua das Flores, 100',
  estado: 'PR',
  cidade: 'Pato Branco',
  cep: '85501000',
  observacao: '',
  ...over,
});

crudSuite({
  route: 'supplier',
  collection: 'fornecedores',
  title: 'Fornecedores',
  make: (i) => supplier(i),
  label: (i) => `Fornecedor ${pad(i)}`,
});

test.describe('Fornecedores — específico', () => {
  test('exibe o CNPJ formatado na tabela', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('fornecedores', [supplier(1)]);
    const crud = new CrudPage(page, 'supplier');
    await crud.goto();

    await expect(crud.row('Fornecedor 001')).toContainText('11.222.333/0001-81');
  });

  test('cria fornecedor com todos os campos obrigatórios', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('fornecedores', []);
    const crud = new CrudPage(page, 'supplier');
    await crud.goto();

    await crud.openNew();
    const d = crud.dialog;
    await d.locator('#razaoSocial').fill('Eletrônica Sul LTDA');
    await d.locator('#nomeFantasia').fill('Eletrônica Sul');
    await typeMasked(d.locator('#cnpj input, input#cnpj').first(), '11222333000181');
    await d.locator('#email').fill('vendas@eletronicasul.com');
    await typeMasked(d.locator('#telefone input, input#telefone').first(), '46999887766');
    await d.locator('#endereco').fill('Av. Brasil, 500');
    await d.locator('#estado').fill('PR');
    await d.locator('#cidade').fill('Pato Branco');
    await crud.save();

    await expect(toast(page, 'Registro salvo com sucesso.')).toBeVisible();
    await expect(crud.row('Eletrônica Sul')).toHaveCount(1);
    expect(api.callsTo('POST', '/fornecedores')[0].body).toMatchObject({
      razaoSocial: 'Eletrônica Sul LTDA',
      nomeFantasia: 'Eletrônica Sul',
      cnpj: '11222333000181',
      email: 'vendas@eletronicasul.com',
      telefone: '46999887766',
      estado: 'PR',
      cidade: 'Pato Branco',
    });
  });

  test('rejeita CNPJ inválido', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('fornecedores', []);
    const crud = new CrudPage(page, 'supplier');
    await crud.goto();

    await crud.openNew();
    const d = crud.dialog;
    await d.locator('#razaoSocial').fill('X LTDA');
    await d.locator('#nomeFantasia').fill('X');
    await typeMasked(d.locator('#cnpj input, input#cnpj').first(), '11111111111111');
    await d.locator('#email').fill('x@x.com');
    await typeMasked(d.locator('#telefone input, input#telefone').first(), '46999887766');
    await d.locator('#endereco').fill('Rua X');
    await d.locator('#estado').fill('PR');
    await d.locator('#cidade').fill('Pato Branco');
    await crud.save();

    await expect(toast(page, 'verifique os campos do formulário')).toBeVisible();
    expect(api.callsTo('POST', '/fornecedores')).toHaveLength(0);
  });

  test('preenche estado e cidade ao digitar o CEP (ViaCEP)', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('fornecedores', []);
    await page.route('https://viacep.com.br/ws/*/json', (route) =>
      route.fulfill({
        json: { cep: '85501-000', logradouro: 'Rua X', localidade: 'Pato Branco', uf: 'PR' },
        headers: { 'access-control-allow-origin': '*' },
      }),
    );
    const crud = new CrudPage(page, 'supplier');
    await crud.goto();

    await crud.openNew();
    await crud.dialog.locator('#cep').fill('85501000');

    await expect(crud.dialog.locator('#estado')).toHaveValue('PR');
    await expect(crud.dialog.locator('#cidade')).toHaveValue('Pato Branco');
  });

  test('edita fornecedor existente', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('fornecedores', [supplier(1), supplier(2)]);
    const crud = new CrudPage(page, 'supplier');
    await crud.goto();

    await crud.openEdit('Fornecedor 002');
    await expect(crud.dialog.locator('#nomeFantasia')).toHaveValue('Fornecedor 002');
    await expect(crud.dialog.locator('#cnpj input')).toHaveValue('11.222.333/0001-81');
    await crud.dialog.locator('#nomeFantasia').fill('Novo Nome');
    await crud.save();

    await expect(crud.row('Novo Nome')).toHaveCount(1);
    expect(api.callsTo('PUT', '/fornecedores/2')[0].body).toMatchObject({ nomeFantasia: 'Novo Nome' });
  });

  test('filtra por nome fantasia, razão social e código', async ({ page, loginAs }) => {
    const api = await loginAs('ROLE_ADMIN');
    api.db.seed('fornecedores', [
      supplier(1, { nomeFantasia: 'Alfa', razaoSocial: 'Alfa Comercial' }),
      supplier(2, { nomeFantasia: 'Beta', razaoSocial: 'Beta Industrial' }),
      supplier(3, { nomeFantasia: 'Gama', razaoSocial: 'Gama Industrial' }),
    ]);
    const crud = new CrudPage(page, 'supplier');
    await crud.goto();

    await crud.openFilters();
    await crud.filterField('Nome Fantasia').fill('alf');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Alfa')).toHaveCount(1);

    await crud.filterField('Nome Fantasia').fill('');
    await crud.filterField('Razão Social').fill('industrial');
    await expect(crud.rows).toHaveCount(2);

    await crud.filterField('Razão Social').fill('');
    await crud.filterField('Código').fill('3');
    await expect(crud.rows).toHaveCount(1);
    await expect(crud.row('Gama')).toHaveCount(1);
  });

  test('perfil aluno não acessa fornecedores', async ({ page, loginAs }) => {
    await loginAs('ROLE_STUDENT');
    await page.goto('/supplier');
    await expect(page).not.toHaveURL(/\/supplier$/);
  });
});
