import { TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { dateOrderValidator } from '@/shared/validator/date-order.validator';

describe('LoanComponent forms', () => {
  let fb: FormBuilder;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReactiveFormsModule] });
    fb = TestBed.inject(FormBuilder);
  });

  function buildForm() {
    return fb.group(
      {
        id: [{ value: null as any, disabled: true }],
        borrower: [null as any, Validators.required],
        loanDate: [new Date() as Date | null, Validators.required],
        deadline: [null as Date | null, Validators.required],
        observation: [null as string | null],
        items: [[] as any[], [Validators.required, Validators.minLength(1)]],
      },
      { validators: dateOrderValidator('loanDate', 'deadline') },
    );
  }

  function buildSubForm() {
    return fb.group({
      id: [null as any],
      item: [null as any, Validators.required],
      shouldReturn: [false],
      quantity: [1 as number, [Validators.required, Validators.min(1)]],
    });
  }

  const mockBorrower = { id: 1, nome: 'João Silva' };
  const mockItem = { id: 1, name: 'Equipamento' };

  // --- Main form ---

  it('starts invalid without borrower and deadline', () => {
    expect(buildForm().invalid).toBeTrue();
  });

  it('is invalid without borrower', () => {
    const form = buildForm();
    form.patchValue({ deadline: new Date() });
    form.get('items')?.setValue([mockItem] as any);
    expect(form.invalid).toBeTrue();
    expect(form.get('borrower')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without deadline', () => {
    const form = buildForm();
    form.get('borrower')?.setValue(mockBorrower);
    form.get('items')?.setValue([mockItem] as any);
    expect(form.invalid).toBeTrue();
    expect(form.get('deadline')?.errors?.['required']).toBeTrue();
  });

  it('is invalid when date is cleared', () => {
    const form = buildForm();
    form.get('borrower')?.setValue(mockBorrower);
    form.patchValue({ deadline: new Date() });
    form.get('loanDate')?.setValue(null);
    form.get('items')?.setValue([mockItem] as any);
    expect(form.invalid).toBeTrue();
    expect(form.get('loanDate')?.errors?.['required']).toBeTrue();
  });

  it('is invalid when items list is empty', () => {
    const form = buildForm();
    form.get('borrower')?.setValue(mockBorrower);
    form.patchValue({ deadline: new Date() });
    form.get('items')?.setValue([] as any);
    expect(form.invalid).toBeTrue();
    // Angular treats [] as empty input: Validators.required catches it
    expect(form.get('items')?.errors?.['required']).toBeTrue();
  });

  it('is invalid when items is null', () => {
    const form = buildForm();
    form.get('borrower')?.setValue(mockBorrower);
    form.patchValue({ deadline: new Date() });
    form.get('items')?.setValue(null);
    expect(form.invalid).toBeTrue();
  });

  it('is valid when all required fields are filled and items has entries', () => {
    const form = buildForm();
    form.get('borrower')?.setValue(mockBorrower);
    form.patchValue({ deadline: new Date() });
    form.get('items')?.setValue([mockItem] as any);
    expect(form.valid).toBeTrue();
  });

  it('observation is optional', () => {
    const form = buildForm();
    form.get('borrower')?.setValue(mockBorrower);
    form.patchValue({ deadline: new Date() });
    form.get('items')?.setValue([mockItem] as any);
    expect(form.get('observation')?.value).toBeNull();
    expect(form.valid).toBeTrue();
  });

  // --- deadline cannot be before loanDate ---

  it('is invalid when deadline is before loanDate', () => {
    const form = buildForm();
    form.get('borrower')?.setValue(mockBorrower);
    form.get('items')?.setValue([mockItem] as any);
    form.patchValue({
      loanDate: new Date('2026-07-08'),
      deadline: new Date('2026-07-01'),
    });
    expect(form.invalid).toBeTrue();
    expect(form.get('deadline')?.errors?.['dateBeforeStart']).toBeTrue();
  });

  it('is valid when deadline equals loanDate', () => {
    const form = buildForm();
    form.get('borrower')?.setValue(mockBorrower);
    form.get('items')?.setValue([mockItem] as any);
    const sameDay = new Date('2026-07-08');
    form.patchValue({ loanDate: sameDay, deadline: new Date(sameDay) });
    expect(form.valid).toBeTrue();
  });

  it('is valid when deadline is after loanDate', () => {
    const form = buildForm();
    form.get('borrower')?.setValue(mockBorrower);
    form.get('items')?.setValue([mockItem] as any);
    form.patchValue({
      loanDate: new Date('2026-07-01'),
      deadline: new Date('2026-07-08'),
    });
    expect(form.valid).toBeTrue();
  });

  // --- Sub-form ---

  it('sub-form is invalid without item', () => {
    const sub = buildSubForm();
    sub.get('item')?.setValue(null);
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
    sub.patchValue({ quantity: 2 });
    expect(sub.valid).toBeTrue();
  });

  it('shouldReturn defaults to false and does not block sub-form validity', () => {
    const sub = buildSubForm();
    sub.get('item')?.setValue(mockItem);
    sub.patchValue({ quantity: 1 });
    expect(sub.get('shouldReturn')?.value).toBeFalse();
    expect(sub.valid).toBeTrue();
  });

  // --- Key: sub-form state does NOT affect main form save ---

  it('main form is valid even when sub-form is empty', () => {
    const form = buildForm();
    const sub = buildSubForm();
    form.get('borrower')?.setValue(mockBorrower);
    form.patchValue({ deadline: new Date() });
    form.get('items')?.setValue([mockItem] as any);
    sub.get('item')?.setValue(null);
    sub.patchValue({ quantity: null });
    expect(form.valid).toBeTrue();
    expect(sub.invalid).toBeTrue();
  });

  it('main form can be saved even with partially filled sub-form', () => {
    const form = buildForm();
    const sub = buildSubForm();
    form.get('borrower')?.setValue(mockBorrower);
    form.patchValue({ deadline: new Date() });
    form.get('items')?.setValue([mockItem] as any);
    sub.get('item')?.setValue(mockItem);
    // quantity missing (would block item addition but not main save)
    sub.patchValue({ quantity: 0 });
    expect(form.valid).toBeTrue();
    expect(sub.invalid).toBeTrue();
  });
});
