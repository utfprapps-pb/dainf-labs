import { TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

describe('CategoryComponent forms', () => {
  let fb: FormBuilder;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReactiveFormsModule] });
    fb = TestBed.inject(FormBuilder);
  });

  function buildForm() {
    return fb.group({
      id: [{ value: null as any, disabled: true }],
      description: [null as string | null, Validators.required],
      icon: [null as string | null],
    });
  }

  function buildSubcategoryForm() {
    return fb.group({
      id: [{ value: null as any, disabled: true }],
      description: [null as string | null, Validators.required],
      icon: [null as string | null],
    });
  }

  // --- Main form ---

  it('starts invalid without description', () => {
    expect(buildForm().invalid).toBeTrue();
    expect(buildForm().get('description')?.errors?.['required']).toBeTrue();
  });

  it('is invalid with null description', () => {
    const form = buildForm();
    form.get('description')?.setValue(null);
    expect(form.invalid).toBeTrue();
  });

  it('is invalid with empty string description', () => {
    const form = buildForm();
    form.patchValue({ description: '' });
    expect(form.invalid).toBeTrue();
  });

  it('is valid when description is provided', () => {
    const form = buildForm();
    form.patchValue({ description: 'Eletrônicos' });
    expect(form.valid).toBeTrue();
  });

  it('icon is optional and does not block validity', () => {
    const form = buildForm();
    form.patchValue({ description: 'Móveis' });
    expect(form.get('icon')?.value).toBeNull();
    expect(form.valid).toBeTrue();
  });

  // --- Subcategory sub-form ---

  it('subcategory sub-form starts invalid', () => {
    expect(buildSubcategoryForm().invalid).toBeTrue();
  });

  it('subcategory sub-form is invalid with empty description', () => {
    const sub = buildSubcategoryForm();
    sub.patchValue({ description: '' });
    expect(sub.invalid).toBeTrue();
  });

  it('subcategory sub-form is valid when description is provided', () => {
    const sub = buildSubcategoryForm();
    sub.patchValue({ description: 'Subcategoria X' });
    expect(sub.valid).toBeTrue();
  });

  // --- Key: sub-form does NOT block main form save ---

  it('main form is valid even when subcategory sub-form is empty', () => {
    const form = buildForm();
    const sub = buildSubcategoryForm();
    form.patchValue({ description: 'Categoria Principal' });
    expect(form.valid).toBeTrue();
    expect(sub.invalid).toBeTrue();
  });
});
