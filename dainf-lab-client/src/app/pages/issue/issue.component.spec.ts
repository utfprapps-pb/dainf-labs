import { TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

describe('IssueComponent forms', () => {
  let fb: FormBuilder;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReactiveFormsModule] });
    fb = TestBed.inject(FormBuilder);
  });

  function buildForm() {
    return fb.group({
      id: [{ value: null as any, disabled: true }],
      date: [null as Date | null, Validators.required],
      user: [null as any],
      loan: [null as any],
      observation: [null as string | null],
      items: [[] as any[], Validators.required],
    });
  }

  function buildSubForm() {
    return fb.group({
      id: [null as any],
      item: [null as any, Validators.required],
      quantity: [
        null as number | null,
        [Validators.required, Validators.min(1)],
      ],
    });
  }

  // --- Main form ---

  it('starts invalid when no fields are filled', () => {
    expect(buildForm().invalid).toBeTrue();
  });

  it('is invalid without a date', () => {
    const form = buildForm();
    form.get('items')?.setValue([{ item: { id: 1 }, quantity: 2 }] as any);
    expect(form.invalid).toBeTrue();
    expect(form.get('date')?.errors?.['required']).toBeTrue();
  });

  it('is valid when all required fields are filled', () => {
    const form = buildForm();
    form.patchValue({ date: new Date() });
    form.get('items')?.setValue([{ item: { id: 1 }, quantity: 2 }] as any);
    expect(form.valid).toBeTrue();
  });

  it('is invalid when items is null', () => {
    const form = buildForm();
    form.patchValue({ date: new Date() });
    form.get('items')?.setValue(null);
    expect(form.invalid).toBeTrue();
  });

  it('optional fields do not affect validity', () => {
    const form = buildForm();
    form.patchValue({ date: new Date() });
    form.get('items')?.setValue([{ item: { id: 1 }, quantity: 1 }] as any);
    expect(form.valid).toBeTrue();
  });

  // --- Sub-form ---

  it('sub-form starts invalid', () => {
    expect(buildSubForm().invalid).toBeTrue();
  });

  it('sub-form is invalid without item', () => {
    const subForm = buildSubForm();
    subForm.patchValue({ quantity: 2 });
    expect(subForm.invalid).toBeTrue();
    expect(subForm.get('item')?.errors?.['required']).toBeTrue();
  });

  it('sub-form is invalid without quantity', () => {
    const subForm = buildSubForm();
    subForm.get('item')?.setValue({ id: 1 });
    expect(subForm.invalid).toBeTrue();
    expect(subForm.get('quantity')?.errors?.['required']).toBeTrue();
  });

  it('sub-form is invalid when quantity is below minimum', () => {
    const subForm = buildSubForm();
    subForm.get('item')?.setValue({ id: 1 });
    subForm.patchValue({ quantity: 0 });
    expect(subForm.invalid).toBeTrue();
    expect(subForm.get('quantity')?.errors?.['min']).toBeTruthy();
  });

  it('sub-form is valid with item and quantity >= 1', () => {
    const subForm = buildSubForm();
    subForm.get('item')?.setValue({ id: 1 });
    subForm.patchValue({ quantity: 1 });
    expect(subForm.valid).toBeTrue();
  });

  // --- Key: sub-form state does NOT affect main form validity ---

  it('main form is valid even when sub-form has invalid data', () => {
    const form = buildForm();
    const subForm = buildSubForm();
    form.patchValue({ date: new Date() });
    form.get('items')?.setValue([{ item: { id: 1 }, quantity: 1 }] as any);
    // Sub-form is left empty (invalid)
    expect(form.valid).toBeTrue();
    expect(subForm.invalid).toBeTrue();
  });

  it('main form save proceeds independently of sub-form validity', () => {
    const form = buildForm();
    const subForm = buildSubForm();
    form.patchValue({ date: new Date() });
    form.get('items')?.setValue([{ item: { id: 1 }, quantity: 1 }] as any);
    subForm.get('item')?.setValue(null);
    subForm.patchValue({ quantity: null });
    expect(form.valid).toBeTrue();
  });
});
