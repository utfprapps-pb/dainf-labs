import { AppFloatingConfigurator } from '@/layout/component/app.floatingconfigurator';
import { LogoComponent } from '@/layout/component/logo.component';
import { extractErrorMessage } from '@/shared/utils/error.utils';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { finalize, Observable, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    PasswordModule,
    FormsModule,
    RouterModule,
    RippleModule,
    AppFloatingConfigurator,
    LogoComponent,
    ToastModule,
  ],
  templateUrl: 'login.component.html',
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  rememberMe: boolean = true;

  emailNotConfirmed = signal(false);
  resending = signal(false);

  private _authService = inject(AuthService);
  private _messageService = inject(MessageService);
  private _tokenService = inject(TokenService);
  private _router = inject(Router);

  loginClick() {
    if (!this.email || !this.password) {
      this._messageService.add({
        severity: 'warn',
        summary: 'Atenção!',
        detail: 'Preencha todos os campos corretamente',
      });
      return;
    }

    this._login().subscribe({
      next: (res) => {
        this.emailNotConfirmed.set(false);
        this._tokenService.setToken(res.token);
        this._router.navigate(['/dashboard']);
      },
      error: (err) => {
        if (err.status === 403) {
          this.emailNotConfirmed.set(true);
          return;
        }
        this.emailNotConfirmed.set(false);
        this._messageService.add({
          severity: 'warn',
          summary: 'Falha ao realizar login',
          detail: extractErrorMessage(err, 'Email ou senha inválidos'),
        });
        console.error('Login failed', err);
      },
    });
  }

  resendConfirmation() {
    this.resending.set(true);
    this._authService
      .resendConfirmationEmail({ email: this.email })
      .pipe(
        take(1),
        finalize(() => this.resending.set(false)),
      )
      .subscribe({
        next: () => {
          this._messageService.add({
            severity: 'success',
            summary: 'E-mail enviado!',
            detail: 'Um novo link de confirmação foi enviado para o seu e-mail.',
          });
        },
        error: (err) => {
          this._messageService.add({
            severity: 'warn',
            summary: 'Atenção!',
            detail: extractErrorMessage(err, 'Falha ao reenviar o e-mail de confirmação.'),
          });
        },
      });
  }

  private _login(): Observable<{ token: string }> {
    return this._authService.login({
      email: this.email,
      password: this.password,
      rememberMe: this.rememberMe,
    });
  }
}
