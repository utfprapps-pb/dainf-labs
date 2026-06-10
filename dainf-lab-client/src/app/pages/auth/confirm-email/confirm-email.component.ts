import { AppFloatingConfigurator } from '@/layout/component/app.floatingconfigurator';
import { LogoComponent } from '@/layout/component/logo.component';
import { utfprEmailValidator } from '@/shared/validator/utfpr-email.validator';
import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { RippleModule } from 'primeng/ripple';
import { AuthService } from '../services/auth.service';

type ConfirmationStatus = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-confirm-email',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    RippleModule,
    AppFloatingConfigurator,
    LogoComponent
  ],
  templateUrl: './confirm-email.component.html'
})
export class ConfirmEmailComponent implements OnDestroy {
  status: ConfirmationStatus = 'loading';
  errorMessage = '';
  resendMessage = '';
  isResendLoading = false;

  resendForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email, utfprEmailValidator()])
  });

  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _authService = inject(AuthService);
  private _redirectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this._route.queryParamMap.subscribe(params => {
      const token = params.get('token');
      if (token) {
        this._confirm(token);
      } else {
        this.status = 'error';
        this.errorMessage = 'Token ausente. Use o link enviado por e-mail.';
      }
    });
  }

  ngOnDestroy(): void {
    if (this._redirectTimeout) {
      clearTimeout(this._redirectTimeout);
    }
  }

  goToLogin() {
    this._router.navigate(['/login']);
  }

  private _confirm(token: string) {
    this.status = 'loading';
    this.errorMessage = '';
    this.resendMessage = '';

    this._authService.confirmEmail(token).subscribe({
      next: () => {
        this.status = 'success';
        this._redirectTimeout = setTimeout(() => this.goToLogin(), 1500);
      },
      error: (err) => {
        this.status = 'error';
        this.errorMessage = err?.error?.message || 'Não foi possível confirmar o e-mail. O token pode estar inválido ou expirado.';
        console.error('Failed to confirm e-mail', err);
      }
    });
  }

  get emailControl() {
    return this.resendForm.get('email') as FormControl;
  }

  resendConfirmationEmail() {
    if (this.resendForm.invalid) {
      this.errorMessage = 'Informe um e-mail válido para reenviar o link de confirmação.';
      this.emailControl.markAsTouched();
      return;
    }

    this.isResendLoading = true;
    this.errorMessage = '';
    this.resendMessage = '';

    this._authService.resendConfirmationEmail({ email: this.emailControl.value }).subscribe({
      next: () => {
        this.isResendLoading = false;
        this.resendMessage = 'O link de confirmação foi reenviado para o seu e-mail.';
      },
      error: (err) => {
        this.isResendLoading = false;
        this.errorMessage = err?.error?.message || 'Falha ao reenviar o link de confirmação.';
        console.error('Failed to resend confirmation e-mail', err);
      }
    });
  }
}
