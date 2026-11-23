import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { extractErrorMessage } from '@/shared/utils/error.utils';
import { nameValidator } from '@/shared/validator/name.validator';
import { passwordStrengthValidator } from '@/shared/validator/password.validator';
import { phoneValidator } from '@/shared/validator/phone.validator';
import { Component, inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputMaskModule } from 'primeng/inputmask';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { UserService } from '../user/user.service';

/** Valida a troca de senha: exige senha atual e confirmação quando a nova senha é informada. */
export function passwordChangeValidator(group: AbstractControl): ValidationErrors | null {
  const current = group.get('currentPassword')?.value;
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!next && !current && !confirm) {
    return null;
  }
  const errors: ValidationErrors = {};
  if (!current) errors['currentPasswordRequired'] = true;
  if (!next) errors['newPasswordRequired'] = true;
  if (next && next !== confirm) errors['passwordMismatch'] = true;
  return Object.keys(errors).length ? errors : null;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputMaskModule,
    PasswordModule,
    InputContainerComponent,
  ],
  providers: [UserService],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  private _fb = inject(FormBuilder);
  private _userService = inject(UserService);
  private _messageService = inject(MessageService);

  saving = false;

  form: FormGroup = this._fb.group(
    {
      email: [{ value: null as string | null, disabled: true }],
      nome: [
        null as string | null,
        Validators.compose([
          Validators.required,
          nameValidator(),
          Validators.minLength(5),
          Validators.maxLength(100),
        ]),
      ],
      documento: [null as string | null, Validators.pattern(/^\d{7,16}$/)],
      telefone: [null as string | null, Validators.compose([Validators.required, phoneValidator()])],
      currentPassword: [null as string | null],
      newPassword: [
        null as string | null,
        Validators.compose([Validators.minLength(6), passwordStrengthValidator()]),
      ],
      confirmPassword: [null as string | null],
    },
    { validators: passwordChangeValidator },
  );

  ngOnInit(): void {
    this._userService.getCurrentUser().subscribe({
      next: (user) =>
        this.form.patchValue({
          email: user.email,
          nome: user.nome,
          documento: user.documento,
          telefone: user.telefone,
        }),
      error: (error) => this._showError(extractErrorMessage(error)),
    });
  }

  save(): void {
    if (this.saving) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this._messageService.add({
        severity: 'warn',
        summary: 'Atenção!',
        detail: 'Por favor, verifique os campos do formulário.',
      });
      return;
    }
    const value = this.form.getRawValue();
    this.saving = true;
    this._userService
      .updateProfile({
        nome: value.nome,
        documento: value.documento || null,
        telefone: value.telefone,
        currentPassword: value.currentPassword || null,
        newPassword: value.newPassword || null,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.form.patchValue({ currentPassword: null, newPassword: null, confirmPassword: null });
          this.form.markAsPristine();
          this._messageService.add({
            severity: 'success',
            summary: 'Sucesso!',
            detail: 'Dados atualizados com sucesso.',
          });
        },
        error: (error) => {
          this.saving = false;
          this._showError(extractErrorMessage(error));
        },
      });
  }

  private _showError(detail: string) {
    this._messageService.add({ severity: 'warn', summary: 'Atenção!', detail });
  }
}
