import { TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

describe('PurchaseComponent forms', () => {
  let fb: FormBuilder;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReactiveFormsModule] });
    fb = TestBed.inject(FormBuilder);
  });

  function buildForm() {
    return fb.group({
      id: [{ value: null as any, disabled: true }],
      date: [new Date() as Date | null, Validators.required],
      fornecedor: [null as any, Validators.required],
      observation: [null as string | null],
      items: [[] as any[], Validators.required],
      totalValue: [{ value: 0, disabled: true }],
    });
  }

  function buildSubForm() {
    return fb.group({
      id: [null as any],
      item: [null as any, Validators.required],
      quantity: [null as number | null, [Validators.required, Validators.min(1)]],
      price: [null as number | null, [Validators.required, Validators.min(0.01)]],
    });
  }

  const mockFornecedor = { id: 1, nomeFantasia: 'Fornecedor Teste' };
  const mockItem = { id: 1, name: 'Item Teste' };

  // --- Main form ---

  it('is invalid without fornecedor even when date is set', () => {
    const form = buildForm();
    form.get('items')?.setValue([mockItem] as any);
    expect(form.invalid).toBeTrue();
    expect(form.get('fornecedor')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without date', () => {
    const form = buildForm();
    form.get('fornecedor')?.setValue(mockFornecedor);
    form.get('date')?.setValue(null);
    form.get('items')?.setValue([mockItem] as any);
    expect(form.invalid).toBeTrue();
    expect(form.get('date')?.errors?.['required']).toBeTrue();
  });

  it('is invalid when items is null', () => {
    const form = buildForm();
    form.get('fornecedor')?.setValue(mockFornecedor);
    form.get('items')?.setValue(null);
    expect(form.invalid).toBeTrue();
  });

  it('is valid when date, fornecedor, and items are set', () => {
    const form = buildForm();
    form.get('fornecedor')?.setValue(mockFornecedor);
    form.get('items')?.setValue([mockItem] as any);
    expect(form.valid).toBeTrue();
  });

  it('observation is optional and does not block validity', () => {
    const form = buildForm();
    form.get('fornecedor')?.setValue(mockFornecedor);
    form.get('items')?.setValue([mockItem] as any);
    expect(form.get('observation')?.value).toBeNull();
    expect(form.valid).toBeTrue();
  });

  // --- Sub-form ---

  it('sub-form starts invalid', () => {
    expect(buildSubForm().invalid).toBeTrue();
  });

  it('sub-form is invalid without item', () => {
    const sub = buildSubForm();
    sub.patchValue({ quantity: 2, price: 10 });
    expect(sub.invalid).toBeTrue();
    expect(sub.get('item')?.errors?.['required']).toBeTrue();
  });

  it('sub-form is invalid without price', () => {
    const sub = buildSubForm();
    sub.get('item')?.setValue(mockItem);
    sub.patchValue({ quantity: 1 });
    expect(sub.invalid).toBeTrue();
    expect(sub.get('price')?.errors?.['required']).toBeTrue();
  });

  it('sub-form is invalid when price is zero', () => {
    const sub = buildSubForm();
    sub.get('item')?.setValue(mockItem);
    sub.patchValue({ quantity: 1, price: 0 });
    expect(sub.invalid).toBeTrue();
    expect(sub.get('price')?.errors?.['min']).toBeTruthy();
  });

  it('sub-form is invalid when quantity is zero', () => {
    const sub = buildSubForm();
    sub.get('item')?.setValue(mockItem);
    sub.patchValue({ quantity: 0, price: 10 });
    expect(sub.invalid).toBeTrue();
    expect(sub.get('quantity')?.errors?.['min']).toBeTruthy();
  });

  it('sub-form is valid with item, quantity >= 1, and price > 0', () => {
    const sub = buildSubForm();
    sub.get('item')?.setValue(mockItem);
    sub.patchValue({ quantity: 2, price: 19.99 });
    expect(sub.valid).toBeTrue();
  });

  // --- Key: sub-form does NOT affect main form validity ---

  it('main form is valid even when sub-form is incomplete', () => {
    const form = buildForm();
    const sub = buildSubForm();
    form.get('fornecedor')?.setValue(mockFornecedor);
    form.get('items')?.setValue([mockItem] as any);
    // Sub-form left empty
    expect(form.valid).toBeTrue();
    expect(sub.invalid).toBeTrue();
  });
});
