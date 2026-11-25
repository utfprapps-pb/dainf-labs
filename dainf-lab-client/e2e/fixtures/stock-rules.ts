import type { MockApi } from '../mock-api/mock-api';

/**
 * Simula no mock as regras de estoque do backend, para testes de fluxo longo:
 *  - POST /reservations → define o solicitante como o usuário logado (ReservationService.setUser)
 *  - POST /loans   → baixa o estoque dos itens e registra movimentação LOAN
 *  - POST /returns → devolve ao estoque, registra RETURN e finaliza o empréstimo quando tudo foi tratado
 *
 * Só para fluxos que precisam enxergar o efeito de uma etapa na seguinte; testes de tela isolados
 * continuam usando o CRUD genérico do mock.
 */
export function installStockRules(api: MockApi) {
  const now = () => new Date().toISOString();

  const addTransaction = (itemId: number, type: string, quantity: number, referenceId: number, userName: string) => {
    const item = api.db.find('items', itemId)!;
    api.db.create('inventory-transactions', {
      itemId,
      itemName: item.name,
      type,
      quantity,
      userName,
      date: now(),
      quantityAfterTransaction: item.quantity,
      referenceId,
      inventory: { item: { id: itemId } },
    });
  };

  api.on('POST', '/reservations', ({ body }) => {
    const reservation = api.db.create('reservations', { ...body, user: api.user });
    return { status: 201, body: reservation.id };
  });

  api.on('POST', '/loans', ({ body }) => {
    const loan = api.db.create('loans', { ...body, status: 'ONGOING' });
    for (const line of body.items ?? []) {
      const item = api.db.find('items', line.item.id)!;
      api.db.update('items', item.id, { quantity: item.quantity - line.quantity });
      addTransaction(item.id, 'LOAN', line.quantity, loan.id, api.user.nome);
    }
    return { status: 201, body: loan.id };
  });

  api.on('POST', '/returns', ({ body }) => {
    const ret = api.db.create('returns', body);
    for (const line of body.items ?? []) {
      if (line.quantityReturned > 0) {
        const item = api.db.find('items', line.item.id)!;
        api.db.update('items', item.id, { quantity: item.quantity + line.quantityReturned });
        addTransaction(item.id, 'RETURN', line.quantityReturned, ret.id, api.user.nome);
      }
    }
    const loan = api.db.find('loans', body.loan.id)!;
    const done = (loan.items as any[]).every((li) => {
      const r = (body.items as any[]).find((x) => x.item.id === li.item.id);
      return (r?.quantityReturned ?? 0) + (r?.quantityIssued ?? 0) >= li.quantity;
    });
    if (done) api.db.update('loans', loan.id, { status: 'COMPLETED' });
    return { status: 201, body: ret.id };
  });
}
