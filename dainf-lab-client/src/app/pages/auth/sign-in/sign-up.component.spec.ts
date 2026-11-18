import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Subject, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SignUpComponent } from './sign-up.component';

describe('SignUpComponent (proteção contra cadastro duplicado)', () => {
  let fixture: ComponentFixture<SignUpComponent>;
  let component: SignUpComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let messageService: jasmine.SpyObj<MessageService>;
  let router: Router;

  const validForm = {
    nome: 'Fulano de Tal',
    documento: '1234567',
    email: 'fulano@alunos.utfpr.edu.br',
    telefone: '(46) 99999-9999',
    password: 'Senha123',
    confirmPassword: 'Senha123',
  };

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['signUp']);
    messageService = jasmine.createSpyObj<MessageService>('MessageService', ['add']);

    await TestBed.configureTestingModule({
      imports: [SignUpComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: authService },
        { provide: MessageService, useValue: messageService },
      ],
    })
      // O template completo (p-password/p-inputmask) trava o Chrome headless após os testes.
      // Mantemos apenas o botão real do PrimeNG com os mesmos bindings de sign-up.component.html,
      // suficiente para validar a trava de envio duplicado; a lógica testada é a da classe real.
      .overrideComponent(SignUpComponent, {
        set: {
          imports: [ButtonModule],
          template: `<p-button label="Cadastrar" [loading]="submitting" [disabled]="submitting" (onClick)="signUpClick()"></p-button>`,
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SignUpComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });

  function fillValidForm(overrides: Partial<typeof validForm> = {}) {
    component.form.setValue({ ...validForm, ...overrides });
    // Garante que validadores customizados (ex.: telefone) não bloqueiem o teste do fluxo de envio.
    Object.values(component.form.controls).forEach((c) => c.setErrors(null));
  }

  it('não envia nada quando o formulário é inválido', () => {
    component.signUpClick();

    expect(authService.signUp).not.toHaveBeenCalled();
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn' }));
    expect(component.submitting).toBeFalse();
  });

  it('cliques repetidos enquanto a requisição está pendente geram UMA única chamada', () => {
    const pending = new Subject<object>();
    authService.signUp.and.returnValue(pending.asObservable());
    fillValidForm();

    component.signUpClick();
    component.signUpClick();
    component.signUpClick();

    expect(authService.signUp).toHaveBeenCalledTimes(1);
    expect(component.submitting).toBeTrue();
  });

  it('desabilita o formulário e o botão (com loading) durante o envio', () => {
    authService.signUp.and.returnValue(new Subject<object>().asObservable());
    fillValidForm();

    component.signUpClick();
    fixture.detectChanges();

    expect(component.form.disabled).toBeTrue();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('p-button button');
    expect(button.disabled).toBeTrue();
  });

  it('envia o e-mail normalizado (trim + minúsculas) e sem confirmPassword', () => {
    authService.signUp.and.returnValue(new Subject<object>().asObservable());
    fillValidForm({ email: '  Fulano@ALUNOS.UTFPR.edu.br ' });

    component.signUpClick();

    const payload = authService.signUp.calls.mostRecent().args[0] as unknown as Record<string, unknown>;
    expect(payload['email']).toBe('fulano@alunos.utfpr.edu.br');
    expect(payload['confirmPassword']).toBeUndefined();
    expect(Object.keys(payload).sort()).toEqual(['documento', 'email', 'nome', 'password', 'telefone']);
  });

  it('em caso de sucesso navega para o login', () => {
    const response = new Subject<object>();
    authService.signUp.and.returnValue(response.asObservable());
    fillValidForm();

    component.signUpClick();
    response.next({});
    response.complete();

    expect(router.navigate).toHaveBeenCalledWith(['login']);
  });

  it('em caso de erro reabilita o formulário, mostra a mensagem do servidor e permite tentar de novo', () => {
    authService.signUp.and.returnValue(
      throwError(() => ({ status: 400, error: { errors: { email: 'O e-mail informado já está em uso' } } })),
    );
    fillValidForm();

    component.signUpClick();

    expect(component.submitting).toBeFalse();
    expect(component.form.enabled).toBeTrue();
    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'warn', detail: 'O e-mail informado já está em uso' }),
    );

    fillValidForm();
    component.signUpClick();
    expect(authService.signUp).toHaveBeenCalledTimes(2);
  });
});
