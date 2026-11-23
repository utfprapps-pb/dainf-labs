import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { UserService } from '../user/user.service';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent (autoedição de cadastro)', () => {
  let component: ProfileComponent;
  let userService: jasmine.SpyObj<UserService>;
  let messageService: jasmine.SpyObj<MessageService>;

  const currentUser = {
    id: 1,
    email: 'aluno@alunos.utfpr.edu.br',
    nome: 'Fulano de Tal',
    documento: '1234567',
    telefone: '46999999999',
  };

  beforeEach(async () => {
    userService = jasmine.createSpyObj<UserService>('UserService', ['getCurrentUser', 'updateProfile']);
    userService.getCurrentUser.and.returnValue(of(currentUser));
    userService.updateProfile.and.returnValue(of(currentUser));
    messageService = jasmine.createSpyObj<MessageService>('MessageService', ['add']);

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      // Testa somente a lógica; o template (p-password/p-inputmask) não é necessário.
      .overrideComponent(ProfileComponent, {
        set: {
          template: '',
          imports: [],
          providers: [
            { provide: UserService, useValue: userService },
            { provide: MessageService, useValue: messageService },
          ],
        },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the current user data into the form, with the e-mail read-only', () => {
    expect(component.form.getRawValue()).toEqual(jasmine.objectContaining({
      email: currentUser.email,
      nome: currentUser.nome,
      documento: currentUser.documento,
      telefone: currentUser.telefone,
    }));
    expect(component.form.get('email')?.disabled).toBeTrue();
  });

  it('saves name, document and phone without sending a password change', () => {
    component.form.patchValue({ nome: 'Novo Nome Completo', telefone: '46911112222' });

    component.save();

    expect(userService.updateProfile).toHaveBeenCalledOnceWith({
      nome: 'Novo Nome Completo',
      documento: '1234567',
      telefone: '46911112222',
      currentPassword: null,
      newPassword: null,
    });
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
  });

  it('requires the current password to change the password', () => {
    component.form.patchValue({ newPassword: 'Nova1234', confirmPassword: 'Nova1234' });

    expect(component.form.errors?.['currentPasswordRequired']).toBeTrue();
    component.save();
    expect(userService.updateProfile).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match the new password', () => {
    component.form.patchValue({
      currentPassword: 'Antiga1',
      newPassword: 'Nova1234',
      confirmPassword: 'Outra1234',
    });

    expect(component.form.errors?.['passwordMismatch']).toBeTrue();
  });

  it('rejects a weak new password', () => {
    component.form.patchValue({ currentPassword: 'Antiga1', newPassword: 'fraca', confirmPassword: 'fraca' });

    expect(component.form.get('newPassword')?.invalid).toBeTrue();
  });

  it('sends the password change and clears the password fields on success', () => {
    component.form.patchValue({
      currentPassword: 'Antiga1',
      newPassword: 'Nova1234',
      confirmPassword: 'Nova1234',
    });

    component.save();

    expect(userService.updateProfile).toHaveBeenCalledWith(
      jasmine.objectContaining({ currentPassword: 'Antiga1', newPassword: 'Nova1234' }),
    );
    expect(component.form.get('newPassword')?.value).toBeNull();
    expect(component.form.get('currentPassword')?.value).toBeNull();
  });

  it('shows the server error and re-enables saving when the update fails', () => {
    userService.updateProfile.and.returnValue(
      throwError(() => ({ status: 400, error: { message: 'A senha atual informada está incorreta.' } })),
    );

    component.save();

    expect(messageService.add).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'warn', detail: 'A senha atual informada está incorreta.' }),
    );
    expect(component.saving).toBeFalse();
  });
});
