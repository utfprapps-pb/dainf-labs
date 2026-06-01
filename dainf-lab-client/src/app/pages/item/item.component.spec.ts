import { TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

describe('ItemComponent forms', () => {
  let fb: FormBuilder;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReactiveFormsModule] });
    fb = TestBed.inject(FormBuilder);
  });

  function buildForm() {
    return fb.group({
      id: [{ value: null as any, disabled: true }],
      name: [null as string | null, Validators.compose([Validators.required, Validators.maxLength(50)])],
      description: [null as string | null],
      price: [null as number | null],
      category: [null as any, Validators.required],
      assets: [null as any],
      images: [null as any],
      siorg: [null as string | null],
      location: [null as string | null, Validators.compose([Validators.maxLength(255)])],
      type: [null as string | null, Validators.required],
      quantity: [{ value: null as any, disabled: true }, Validators.compose([Validators.required])],
      minimumStock: [null as number | null],
    });
  }

  function buildAssetSubForm() {
    return fb.group({
      id: [null as any],
      location: [null as string | null, Validators.compose([Validators.required, Validators.maxLength(255)])],
      serialNumber: [null as string | null, Validators.compose([Validators.required, Validators.maxLength(255)])],
    });
  }

  const mockCategory = { id: 1, description: 'Categoria Teste' };

  // --- Main form ---

  it('starts invalid with no fields filled', () => {
    expect(buildForm().invalid).toBeTrue();
  });

  it('is invalid without name', () => {
    const form = buildForm();
    form.get('category')?.setValue(mockCategory);
    form.patchValue({ type: 'CONSUMABLE' });
    expect(form.invalid).toBeTrue();
    expect(form.get('name')?.errors?.['required']).toBeTrue();
  });

  it('is invalid with blank name', () => {
    const form = buildForm();
    form.patchValue({ name: '', type: 'CONSUMABLE' });
    form.get('category')?.setValue(mockCategory);
    expect(form.invalid).toBeTrue();
  });

  it('is invalid when name exceeds 50 characters', () => {
    const form = buildForm();
    form.patchValue({ name: 'A'.repeat(51), type: 'CONSUMABLE' });
    form.get('category')?.setValue(mockCategory);
    expect(form.invalid).toBeTrue();
    expect(form.get('name')?.errors?.['maxlength']).toBeTruthy();
  });

  it('is invalid without category', () => {
    const form = buildForm();
    form.patchValue({ name: 'Teste', type: 'DURABLE' });
    expect(form.invalid).toBeTrue();
    expect(form.get('category')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without type', () => {
    const form = buildForm();
    form.patchValue({ name: 'Teste' });
    form.get('category')?.setValue(mockCategory);
    expect(form.invalid).toBeTrue();
    expect(form.get('type')?.errors?.['required']).toBeTrue();
  });

  it('is valid when name (≤50), category, and type are filled', () => {
    const form = buildForm();
    form.patchValue({ name: 'Equipamento Teste', type: 'DURABLE' });
    form.get('category')?.setValue(mockCategory);
    expect(form.valid).toBeTrue();
  });

  it('description, price, location, siorg are optional', () => {
    const form = buildForm();
    form.patchValue({ name: 'Teste', type: 'CONSUMABLE' });
    form.get('category')?.setValue(mockCategory);
    expect(form.valid).toBeTrue();
  });

  // --- Asset sub-form ---

  it('asset sub-form starts invalid', () => {
    expect(buildAssetSubForm().invalid).toBeTrue();
  });

  it('asset sub-form is invalid without serialNumber', () => {
    const sub = buildAssetSubForm();
    sub.patchValue({ location: 'Lab 1' });
    expect(sub.invalid).toBeTrue();
    expect(sub.get('serialNumber')?.errors?.['required']).toBeTrue();
  });

  it('asset sub-form is invalid without location', () => {
    const sub = buildAssetSubForm();
    sub.patchValue({ serialNumber: 'PAT-001' });
    expect(sub.invalid).toBeTrue();
    expect(sub.get('location')?.errors?.['required']).toBeTrue();
  });

  it('asset sub-form is invalid when serialNumber exceeds 255 characters', () => {
    const sub = buildAssetSubForm();
    sub.patchValue({ location: 'Lab 1', serialNumber: 'X'.repeat(256) });
    expect(sub.invalid).toBeTrue();
    expect(sub.get('serialNumber')?.errors?.['maxlength']).toBeTruthy();
  });

  it('asset sub-form is valid with location and serialNumber', () => {
    const sub = buildAssetSubForm();
    sub.patchValue({ location: 'Lab 1', serialNumber: 'PAT-001' });
    expect(sub.valid).toBeTrue();
  });

  // --- Key: asset sub-form does NOT affect main form validity ---

  it('main form is valid even when asset sub-form is empty', () => {
    const form = buildForm();
    const sub = buildAssetSubForm();
    form.patchValue({ name: 'Teste', type: 'DURABLE' });
    form.get('category')?.setValue(mockCategory);
    expect(form.valid).toBeTrue();
    expect(sub.invalid).toBeTrue();
  });

  it('main form can be saved without filling the asset sub-form', () => {
    const form = buildForm();
    const sub = buildAssetSubForm();
    form.patchValue({ name: 'Teste', type: 'CONSUMABLE' });
    form.get('category')?.setValue(mockCategory);
    sub.patchValue({ location: null, serialNumber: null });
    expect(form.valid).toBeTrue();
  });
});
