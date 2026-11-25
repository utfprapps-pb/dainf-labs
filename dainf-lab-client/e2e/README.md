# Testes E2E (Playwright, API mockada)

```
npm run e2e          # roda tudo (sobe o ng serve na porta 4300 sozinho)
npm run e2e:ui       # modo interativo
npm run e2e:report   # abre o último relatório HTML
npx playwright test e2e/specs/auth/login.spec.ts   # um arquivo
```

Primeira vez: `npx playwright install chromium`.

## Como funciona

- O front lê o `apiUrl` de `/config/config.json`. Cada teste intercepta esse arquivo e aponta para
  `http://api.test/api`; todas as chamadas a esse host são atendidas por `mock-api/mock-api.ts`.
- A API falsa tem **estado em memória** (`mock-api/in-memory-db.ts`): `POST /{coleção}/search`,
  `POST/GET/PUT/DELETE /{coleção}[/{id}]` funcionam como o `CrudService` do front espera.
- Como no `CrudController` do backend, `POST`/`PUT` respondem **apenas o id** (o front depende disso, ex.: vínculo de usuários do grupo).
- Telas de cadastro usam `CrudPage` (`pages/crud-page.ts`) e a bateria `crudSuite()` (`pages/crud-suite.ts`):
  listar, vazio, paginar, exportar CSV, editar/cancelar, `?openId=`, excluir (sim/não/erro), erro de carga.
- Menu e permissões por perfil espelham `MenuConfig.java` do backend (`fixtures/roles.ts`).
  **Se o menu do backend mudar, atualize esse arquivo.**

## Escrevendo um teste

```ts
import { expect, test } from '../../fixtures/test';

test('exemplo', async ({ page, loginAs }) => {
  const api = await loginAs('ROLE_ADMIN');      // sessão + perfil
  api.db.seed('categories', [{ id: 1, description: 'Cabos' }]);   // dados iniciais

  await page.goto('/category');
  await expect(page.getByText('Cabos')).toBeVisible();

  api.failNext('POST', '/categories', 422, { message: 'Inválido' }); // injeta erro
  expect(api.callsTo('POST', '/categories')).toHaveLength(0);       // inspeciona chamadas
});
```

Endpoints fora do CRUD (ex.: devolução de empréstimo): `api.on('POST', '/returns', ({ body }) => ({ body: ... }))`.

## Regras

- Sem `waitForTimeout`; use `expect(...)` / `expect.poll(...)`.
- Seletores: `getByRole`/`getByLabel`/`getByText`; `data-testid` só quando necessário.
- Tela nova ou alterada ⇒ spec novo ou atualizado no mesmo PR.

## Mapa dos specs

| Pasta | Cobre |
|---|---|
| `specs/auth` | login, cadastro, recuperação/redefinição de senha, confirmação de e-mail, nada consta, guards e permissões por perfil, sessão (401 renova token, 403/500 não derrubam) |
| `specs/layout` | menu lateral por perfil, menu do usuário/logout, tema claro/escuro, responsividade (celular/tablet/desktop) |
| `specs/cadastros` | categorias, fornecedores, usuários (inclui nada consta), grupos |
| `specs/operacoes` | itens (gestão), catálogo, carrinho, reservas, empréstimos, devolução, compras, solicitações de compra, saídas |
| `specs/sistema` | dashboard, histórico de estoque, auditoria, configurações, sobre, perfil |
| `specs/fluxos` | fluxo longo: carrinho → reserva → empréstimo → devolução → histórico (estoque baixa e volta) |
| `specs/a11y` | acessibilidade (axe, WCAG 2 A/AA) em modo catraca: não pode piorar o baseline |

Helpers úteis: `pages/primeng.ts` (`selectOption`, `multiSelect`, `fillDate`, `typeMasked`, `pickFromSearchSelect`, `toast`),
`pages/crud-page.ts` e `fixtures/data.ts` (`makeItem`, `makeUser`, ...).
Dicas: `fillDate` digita (não use `fill`) e sai com Tab — Enter/Escape fecham o dialog; datas do backend são
`Instant` ISO (use `T12:00:00Z` nos dados para evitar virada de dia por fuso).

## Acessibilidade (catraca)

`specs/a11y/a11y.spec.ts` roda o axe em cada tela e compara com um **baseline** (dívida atual: botões só com ícone
sem nome acessível, campos sem label...). Regra nova ou mais elementos que o teto ⇒ o teste falha. Ao corrigir algo,
**reduza o teto** no spec. `color-contrast` só é checado por presença (oscila com tema/animação).

## CI

`Jenkinsfile-e2e` (raiz do repositório) roda a suíte numa imagem do Playwright e publica relatório HTML + JUnit.
É um pipeline à parte, sem deploy. Mantenha a tag da imagem igual à versão de `@playwright/test`.

## Fluxos longos (regras de estoque)

`fixtures/stock-rules.ts` (`installStockRules(api)`) faz o mock reproduzir regras do backend que uma etapa precisa ver na seguinte:
reserva recebe o usuário logado, empréstimo baixa o estoque, devolução devolve e finaliza o empréstimo, e ambos geram
movimentações no histórico. Troque o perfil no meio do teste mudando `api.role`/`api.user` e recarregando a página.

## Bugs conhecidos (`test.fail`)

Comportamento errado já identificado fica em um teste com `test.fail(true, ...)`: ele **passa enquanto o bug existe** e
**falha quando for corrigido** — aí é só remover o `test.fail`. Hoje: erro de carga sem aviso no dashboard, em "Sobre" e
no catálogo, e falha de upload de foto sem aviso (item é salvo sem a imagem).

## Cobertura de código

`npm run e2e:coverage` roda a suíte coletando cobertura V8 do Chromium (mapeada por source map para `src/app`) e gera
`e2e/.coverage/report/index.html` + resumo no terminal. Serve para achar código que nenhum teste exercita; não é meta fixa.
