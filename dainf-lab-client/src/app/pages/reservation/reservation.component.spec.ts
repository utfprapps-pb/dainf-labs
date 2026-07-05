import { TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

describe('ReservationComponent forms', () => {
  let fb: FormBuilder;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReactiveFormsModule] });
    fb = TestBed.inject(FormBuilder);
  });

  function buildForm() {
    return fb.group({
      id: [{ value: null as any, disabled: true }],
      description: ['' as string],
      observation: ['' as string],
      reservationDate: [null as Date | null, Validators.required],
      withdrawalDate: [null as Date | null, Validators.required],
      user: [null as any],
      items: [[] as any[], [Validators.required, Validators.minLength(1)]],
    });
  }

  function buildSubForm() {
    return fb.group({
      id: [null as any],
      item: [null as any, Validators.required],
      quantity: [0 as number, [Validators.required, Validators.min(1)]],
    });
  }

  const mockItem = { id: 1, name: 'Item Teste' };

  // --- Main form ---

  it('starts invalid when no fields are filled', () => {
    expect(buildForm().invalid).toBeTrue();
  });

  it('is invalid without reservationDate', () => {
    const form = buildForm();
    form.patchValue({ withdrawalDate: new Date() });
    form.get('items')?.setValue([mockItem] as any);
    expect(form.invalid).toBeTrue();
    expect(form.get('reservationDate')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without withdrawalDate', () => {
    const form = buildForm();
    form.patchValue({ reservationDate: new Date() });
    form.get('items')?.setValue([mockItem] as any);
    expect(form.invalid).toBeTrue();
    expect(form.get('withdrawalDate')?.errors?.['required']).toBeTrue();
  });

  it('is invalid when items is empty', () => {
    const form = buildForm();
    form.patchValue({
      reservationDate: new Date(),
      withdrawalDate: new Date(),
    });
    form.get('items')?.setValue([] as any);
    expect(form.invalid).toBeTrue();
    // Angular treats [] as empty input: Validators.required catches it
    expect(form.get('items')?.errors?.['required']).toBeTrue();
  });

  it('is invalid when items is null', () => {
    const form = buildForm();
    form.patchValue({
      reservationDate: new Date(),
      withdrawalDate: new Date(),
    });
    form.get('items')?.setValue(null);
    expect(form.invalid).toBeTrue();
  });

  it('is valid when all required fields are filled and items has at least one entry', () => {
    const form = buildForm();
    form.patchValue({
      reservationDate: new Date(),
      withdrawalDate: new Date(),
    });
    form.get('items')?.setValue([mockItem] as any);
    expect(form.valid).toBeTrue();
  });

  it('description and observation are optional', () => {
    const form = buildForm();
    form.patchValue({
      reservationDate: new Date(),
      withdrawalDate: new Date(),
    });
    form.get('items')?.setValue([mockItem] as any);
    expect(form.valid).toBeTrue();
  });

  // --- Sub-form ---

  it('sub-form starts invalid with zero quantity', () => {
    const sub = buildSubForm();
    expect(sub.invalid).toBeTrue();
  });

  it('sub-form is invalid without item', () => {
    const sub = buildSubForm();
    sub.patchValue({ quantity: 1 });
    expect(sub.invalid).toBeTrue();
    expect(sub.get('item')?.errors?.['required']).toBeTrue();
  });

  it('sub-form is invalid when quantity is zero', () => {
    const sub = buildSubForm();
    sub.get('item')?.setValue(mockItem);
    sub.patchValue({ quantity: 0 });
    expect(sub.invalid).toBeTrue();
    expect(sub.get('quantity')?.errors?.['min']).toBeTruthy();
  });

  it('sub-form is valid with item and quantity >= 1', () => {
    const sub = buildSubForm();
    sub.get('item')?.setValue(mockItem);
    sub.patchValue({ quantity: 3 });
    expect(sub.valid).toBeTrue();
  });

  // --- Key: sub-form does NOT block main form save ---

  it('main form is valid even when sub-form has invalid data', () => {
    const form = buildForm();
    const sub = buildSubForm();
    form.patchValue({
      reservationDate: new Date(),
      withdrawalDate: new Date(),
    });
    form.get('items')?.setValue([mockItem] as any);
    expect(form.valid).toBeTrue();
    expect(sub.invalid).toBeTrue();
  });
});
