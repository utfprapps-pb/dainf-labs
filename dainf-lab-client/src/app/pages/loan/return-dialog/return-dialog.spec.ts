// Mirrors the over-return guard in return-dialog.ts's save(): an item whose
// quantityReturned + quantityIssued exceeds what was loaned must block save with
// a warning. Previously the only guard was p-input-number's [max], which is a UI
// clamp on blur and does not reliably commit before Save is clicked, letting an
// over-returned loan save silently and flip to "Finalizado".
describe('LoanReturnDialog over-return guard', () => {
  interface DisplayItem {
    item: { name: string };
    quantity: number;
    quantityReturned?: number;
    quantityIssued?: number;
  }

  function findOverReturnedItem(items: DisplayItem[]): DisplayItem | undefined {
    return items.find(
      (item) => item.quantity - (item.quantityReturned || 0) - (item.quantityIssued || 0) < 0,
    );
  }

  const mockItem = { name: 'Sugador de Solda' };

  it('flags an item when returned + issued exceeds the loaned quantity', () => {
    const items: DisplayItem[] = [{ item: mockItem, quantity: 1, quantityReturned: 1, quantityIssued: 1 }];
    expect(findOverReturnedItem(items)).toBe(items[0]);
  });

  it('does not flag an item when returned + issued equals the loaned quantity', () => {
    const items: DisplayItem[] = [{ item: mockItem, quantity: 5, quantityReturned: 2, quantityIssued: 3 }];
    expect(findOverReturnedItem(items)).toBeUndefined();
  });

  it('does not flag an item when returned + issued is below the loaned quantity', () => {
    const items: DisplayItem[] = [{ item: mockItem, quantity: 5, quantityReturned: 1, quantityIssued: 1 }];
    expect(findOverReturnedItem(items)).toBeUndefined();
  });

  it('treats missing quantityReturned/quantityIssued as zero', () => {
    const items: DisplayItem[] = [{ item: mockItem, quantity: 1 }];
    expect(findOverReturnedItem(items)).toBeUndefined();
  });

  it('finds the over-returned item even when other items in the list are fine', () => {
    const ok: DisplayItem = { item: { name: 'OK Item' }, quantity: 5, quantityReturned: 5, quantityIssued: 0 };
    const bad: DisplayItem = { item: mockItem, quantity: 1, quantityReturned: 5, quantityIssued: 0 };
    expect(findOverReturnedItem([ok, bad])).toBe(bad);
  });

  it('does not flag anything for a fully valid item list', () => {
    const items: DisplayItem[] = [
      { item: { name: 'A' }, quantity: 3, quantityReturned: 3, quantityIssued: 0 },
      { item: { name: 'B' }, quantity: 2, quantityReturned: 0, quantityIssued: 2 },
    ];
    expect(findOverReturnedItem(items)).toBeUndefined();
  });
});
