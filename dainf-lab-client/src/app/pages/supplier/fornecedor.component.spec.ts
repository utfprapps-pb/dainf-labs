import { TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { cnpjValidator } from '@/shared/validator/cnpj.validator';
import { phoneValidator } from '@/shared/validator/phone.validator';

describe('FornecedorComponent form', () => {
  let fb: FormBuilder;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReactiveFormsModule] });
    fb = TestBed.inject(FormBuilder);
  });

  function buildForm() {
    return fb.group({
      id: [{ value: null as any, disabled: true }],
      razaoSocial: [null as string | null, [Validators.required, Validators.maxLength(80)]],
      nomeFantasia: [null as string | null, [Validators.required, Validators.maxLength(80)]],
      cnpj: [null as string | null, [Validators.required, cnpjValidator()]],
      ie: [null as string | null, Validators.maxLength(14)],
      telefone: [null as string | null, [Validators.required, phoneValidator(), Validators.maxLength(15)]],
      email: [null as string | null, [Validators.required, Validators.email]],
      endereco: [null as string | null, [Validators.required, Validators.maxLength(100)]],
      estado: [null as string | null, Validators.required],
      cidade: [null as string | null, Validators.required],
      cep: [null as string | null],
      observacao: [null as string | null, Validators.maxLength(2000)],
    });
  }

  const validBase = {
    razaoSocial: 'Empresa Teste',
    nomeFantasia: 'Loja Teste',
    cnpj: '35258347000113',
    telefone: '46999998888',
    email: 'contato@empresa.com',
    endereco: 'Rua das Flores, 123',
    estado: 'PR',
    cidade: 'Pato Branco',
  };

  // --- Required fields ---

  it('starts invalid with no fields filled', () => {
    expect(buildForm().invalid).toBeTrue();
  });

  it('is invalid without razaoSocial', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, razaoSocial: null });
    expect(form.invalid).toBeTrue();
    expect(form.get('razaoSocial')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without nomeFantasia', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, nomeFantasia: null });
    expect(form.invalid).toBeTrue();
    expect(form.get('nomeFantasia')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without cnpj', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, cnpj: null });
    expect(form.invalid).toBeTrue();
    expect(form.get('cnpj')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without telefone', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, telefone: null });
    expect(form.invalid).toBeTrue();
    expect(form.get('telefone')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without email', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, email: null });
    expect(form.invalid).toBeTrue();
    expect(form.get('email')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without endereco', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, endereco: null });
    expect(form.invalid).toBeTrue();
    expect(form.get('endereco')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without estado', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, estado: null });
    expect(form.invalid).toBeTrue();
    expect(form.get('estado')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without cidade', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, cidade: null });
    expect(form.invalid).toBeTrue();
    expect(form.get('cidade')?.errors?.['required']).toBeTrue();
  });

  // --- Format/size validations ---

  it('is invalid with a malformed CNPJ', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, cnpj: '11111111111111' });
    expect(form.invalid).toBeTrue();
    expect(form.get('cnpj')?.errors?.['invalidCnpj']).toBeTrue();
  });

  it('is invalid with a malformed email', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, email: 'not-an-email' });
    expect(form.invalid).toBeTrue();
    expect(form.get('email')?.errors?.['email']).toBeTruthy();
  });

  it('is invalid with an invalid phone number (too short)', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, telefone: '4699' });
    expect(form.invalid).toBeTrue();
    expect(form.get('telefone')?.errors?.['invalidPhone']).toBeTrue();
  });

  it('is invalid when razaoSocial exceeds 80 characters', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, razaoSocial: 'R'.repeat(81) });
    expect(form.invalid).toBeTrue();
    expect(form.get('razaoSocial')?.errors?.['maxlength']).toBeTruthy();
  });

  it('is invalid when nomeFantasia exceeds 80 characters', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, nomeFantasia: 'N'.repeat(81) });
    expect(form.invalid).toBeTrue();
    expect(form.get('nomeFantasia')?.errors?.['maxlength']).toBeTruthy();
  });

  it('is invalid when endereco exceeds 100 characters', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, endereco: 'E'.repeat(101) });
    expect(form.invalid).toBeTrue();
    expect(form.get('endereco')?.errors?.['maxlength']).toBeTruthy();
  });

  it('is invalid when telefone exceeds 15 characters', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, telefone: '1'.repeat(16) });
    expect(form.invalid).toBeTrue();
    expect(form.get('telefone')?.errors?.['maxlength']).toBeTruthy();
  });

  it('is invalid when ie exceeds 14 characters', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, ie: '9'.repeat(15) });
    expect(form.invalid).toBeTrue();
    expect(form.get('ie')?.errors?.['maxlength']).toBeTruthy();
  });

  // --- Valid state ---

  it('is valid when all required fields are correctly filled', () => {
    const form = buildForm();
    form.patchValue(validBase);
    expect(form.valid).toBeTrue();
  });

  it('ie and observacao are optional', () => {
    const form = buildForm();
    form.patchValue(validBase);
    expect(form.get('ie')?.value).toBeNull();
    expect(form.get('observacao')?.value).toBeNull();
    expect(form.valid).toBeTrue();
  });

  it('cep is optional and only used to auto-fill city/state', () => {
    const form = buildForm();
    form.patchValue(validBase);
    expect(form.get('cep')?.value).toBeNull();
    expect(form.valid).toBeTrue();
  });

  it('accepts a valid 11-digit mobile phone number', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, telefone: '46999998888' });
    expect(form.get('telefone')?.errors).toBeNull();
    expect(form.valid).toBeTrue();
  });

  it('accepts a valid 10-digit landline phone number', () => {
    const form = buildForm();
    form.patchValue({ ...validBase, telefone: '4632221234' });
    expect(form.get('telefone')?.errors).toBeNull();
    expect(form.valid).toBeTrue();
  });
});
