import { TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { utfprEmailValidator } from '@/shared/validator/utfpr-email.validator';
import { passwordStrengthValidator } from '@/shared/validator/password.validator';

describe('UserComponent form', () => {
  let fb: FormBuilder;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ReactiveFormsModule] });
    fb = TestBed.inject(FormBuilder);
  });

  function buildForm() {
    return fb.group({
      id: [{ value: null as any, disabled: true }],
      email: [
        null as string | null,
        Validators.compose([
          Validators.required,
          Validators.email,
          utfprEmailValidator(),
        ]),
      ],
      nome: [null as string | null, Validators.required],
      telefone: [null as string | null],
      documento: [null as string | null],
      role: [null as string | null, Validators.required],
      password: [
        null as string | null,
        Validators.compose([
          Validators.minLength(6),
          passwordStrengthValidator(),
        ]),
      ],
      enabled: [true],
    });
  }

  // --- Required fields ---

  it('starts invalid with no fields filled', () => {
    expect(buildForm().invalid).toBeTrue();
  });

  it('is invalid without email', () => {
    const form = buildForm();
    form.patchValue({ nome: 'João', role: 'ROLE_STUDENT' });
    expect(form.invalid).toBeTrue();
    expect(form.get('email')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without nome', () => {
    const form = buildForm();
    form.patchValue({ email: 'joao@utfpr.edu.br', role: 'ROLE_STUDENT' });
    expect(form.invalid).toBeTrue();
    expect(form.get('nome')?.errors?.['required']).toBeTrue();
  });

  it('is invalid without role', () => {
    const form = buildForm();
    form.patchValue({ email: 'joao@utfpr.edu.br', nome: 'João' });
    expect(form.invalid).toBeTrue();
    expect(form.get('role')?.errors?.['required']).toBeTrue();
  });

  // --- Email validation ---

  it('is invalid with a malformed email', () => {
    const form = buildForm();
    form.patchValue({
      email: 'not-an-email',
      nome: 'João',
      role: 'ROLE_STUDENT',
    });
    expect(form.invalid).toBeTrue();
    expect(form.get('email')?.errors?.['email']).toBeTruthy();
  });

  it('is invalid with a non-UTFPR email domain', () => {
    const form = buildForm();
    form.patchValue({
      email: 'joao@gmail.com',
      nome: 'João',
      role: 'ROLE_STUDENT',
    });
    expect(form.invalid).toBeTrue();
    expect(form.get('email')?.errors?.['utfprEmail']).toBeTrue();
  });

  it('is valid with a utfpr.edu.br email', () => {
    const form = buildForm();
    form.patchValue({
      email: 'joao@utfpr.edu.br',
      nome: 'João',
      role: 'ROLE_STUDENT',
    });
    expect(form.valid).toBeTrue();
  });

  it('is valid with an alunos.utfpr.edu.br email', () => {
    const form = buildForm();
    form.patchValue({
      email: 'a2023@alunos.utfpr.edu.br',
      nome: 'João',
      role: 'ROLE_STUDENT',
    });
    expect(form.valid).toBeTrue();
  });

  it('is valid with a professores.utfpr.edu.br email', () => {
    const form = buildForm();
    form.patchValue({
      email: 'prof@professores.utfpr.edu.br',
      nome: 'Prof',
      role: 'ROLE_PROFESSOR',
    });
    expect(form.valid).toBeTrue();
  });

  // --- Password validation (optional field with rules when provided) ---

  it('is valid when password is null (password is optional)', () => {
    const form = buildForm();
    form.patchValue({
      email: 'joao@utfpr.edu.br',
      nome: 'João',
      role: 'ROLE_STUDENT',
      password: null,
    });
    expect(form.valid).toBeTrue();
  });

  it('is invalid when password is shorter than 6 characters', () => {
    const form = buildForm();
    form.patchValue({
      email: 'joao@utfpr.edu.br',
      nome: 'João',
      role: 'ROLE_STUDENT',
      password: 'Ab1',
    });
    expect(form.invalid).toBeTrue();
    expect(form.get('password')?.errors?.['minlength']).toBeTruthy();
  });

  it('is invalid when password lacks uppercase letter', () => {
    const form = buildForm();
    form.patchValue({
      email: 'joao@utfpr.edu.br',
      nome: 'João',
      role: 'ROLE_STUDENT',
      password: 'abcdef1',
    });
    expect(form.invalid).toBeTrue();
    expect(form.get('password')?.errors?.['passwordStrength']).toBeTrue();
  });

  it('is invalid when password lacks lowercase letter', () => {
    const form = buildForm();
    form.patchValue({
      email: 'joao@utfpr.edu.br',
      nome: 'João',
      role: 'ROLE_STUDENT',
      password: 'ABCDEF1',
    });
    expect(form.invalid).toBeTrue();
    expect(form.get('password')?.errors?.['passwordStrength']).toBeTrue();
  });

  it('is invalid when password lacks a digit', () => {
    const form = buildForm();
    form.patchValue({
      email: 'joao@utfpr.edu.br',
      nome: 'João',
      role: 'ROLE_STUDENT',
      password: 'AbcdefG',
    });
    expect(form.invalid).toBeTrue();
    expect(form.get('password')?.errors?.['passwordStrength']).toBeTrue();
  });

  it('is valid when password meets all requirements', () => {
    const form = buildForm();
    form.patchValue({
      email: 'joao@utfpr.edu.br',
      nome: 'João',
      role: 'ROLE_STUDENT',
      password: 'Senha123',
    });
    expect(form.valid).toBeTrue();
  });

  // --- Optional fields ---

  it('telefone and documento are optional', () => {
    const form = buildForm();
    form.patchValue({
      email: 'joao@utfpr.edu.br',
      nome: 'João',
      role: 'ROLE_STUDENT',
    });
    expect(form.get('telefone')?.value).toBeNull();
    expect(form.get('documento')?.value).toBeNull();
    expect(form.valid).toBeTrue();
  });
});
