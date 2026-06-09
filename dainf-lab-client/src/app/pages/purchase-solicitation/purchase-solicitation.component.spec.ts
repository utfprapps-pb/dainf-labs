import { TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

describe('PurchaseSolicitationComponent forms', () => {
  let fb: FormBuilder;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReactiveFormsModule] });
    fb = TestBed.inject(FormBuilder);
  });

  function buildForm() {
    return fb.group({
      id: [{ value: null as any, disabled: true }],
      date: [new Date() as Date | null, Validators.required],
      user: [null as any],
      observation: [null as string | null],
      items: [[] as any[], [Validators.required, Validators.minLength(1)]],
    });
  }

  function buildSubForm() {
    return fb.group({
      id: [null as any],
      item: [null as any, Validators.required],
      quantity: [null as number | null, [Validators.required, Validators.min(1)]],
    });
  }

  const mockItem = { id: 1, name: 'Item Teste' };

  // --- Main form ---

  it('is valid by default because date defaults to today', () => {
    const form = buildForm();
    form.get('items')?.setValue([mockItem] as any);
    expect(form.valid).toBeTrue();
  });

  it('is invalid when date is cleared', () => {
    const form = buildForm();
    form.get('date')?.setValue(null);
    form.get('items')?.setValue([mockItem] as any);
    expect(form.invalid).toBeTrue();
    expect(form.get('date')?.errors?.['required']).toBeTrue();
  });

  it('is invalid when items list is empty', () => {
    const form = buildForm();
    form.get('items')?.setValue([] as any);
    expect(form.invalid).toBeTrue();
    // Angular treats [] as empty input: Validators.required catches it
    expect(form.get('items')?.errors?.['required']).toBeTrue();
  });

  it('is invalid when items is null', () => {
    const form = buildForm();
    form.get('items')?.setValue(null);
    expect(form.invalid).toBeTrue();
  });

  it('is valid when date is set and items has at least one entry', () => {
    const form = buildForm();
    form.get('items')?.setValue([mockItem] as any);
    expect(form.valid).toBeTrue();
  });

  it('observation is optional and does not block validity', () => {
    const form = buildForm();
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
    sub.patchValue({ quantity: 2 });
    expect(sub.invalid).toBeTrue();
    expect(sub.get('item')?.errors?.['required']).toBeTrue();
  });

  it('sub-form is invalid without quantity', () => {
    const sub = buildSubForm();
    sub.get('item')?.setValue(mockItem);
    expect(sub.invalid).toBeTrue();
    expect(sub.get('quantity')?.errors?.['required']).toBeTrue();
  });

  it('sub-form is invalid when quantity is below 1', () => {
    const sub = buildSubForm();
    sub.get('item')?.setValue(mockItem);
    sub.patchValue({ quantity: 0 });
    expect(sub.invalid).toBeTrue();
    expect(sub.get('quantity')?.errors?.['min']).toBeTruthy();
  });

  it('sub-form is valid with item and quantity >= 1', () => {
    const sub = buildSubForm();
    sub.get('item')?.setValue(mockItem);
    sub.patchValue({ quantity: 5 });
    expect(sub.valid).toBeTrue();
  });

  // --- Key: sub-form does NOT block main form save ---

  it('main form is valid even when sub-form is empty', () => {
    const form = buildForm();
    const sub = buildSubForm();
    form.get('items')?.setValue([mockItem] as any);
    expect(form.valid).toBeTrue();
    expect(sub.invalid).toBeTrue();
  });
});
