import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { Column, CrudConfig } from '@/shared/crud/crud';
import { CrudComponent } from '@/shared/crud/crud.component';
import { SearchRequest } from '@/shared/models/search';
import { TelefonePipe } from '@/shared/pipes/telefone.pipe';
import { utfprEmailValidator } from '@/shared/validator/utfpr-email.validator';
import { passwordStrengthValidator } from '@/shared/validator/password.validator';
import { AfterViewInit, Component, computed, inject, model, signal, TemplateRef, viewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { catchError, take, tap } from 'rxjs';
import { User } from './user';
import { UserService } from './user.service';

@Component({
  standalone: true,
  imports: [
    CrudComponent,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    InputContainerComponent,
    Select,
    Button,
    TooltipModule,
    ToggleSwitchModule,
    TagModule,
  ],
  selector: 'app-user',
  templateUrl: 'user.component.html',
  providers: [UserService, TelefonePipe],
})
export class UserComponent implements AfterViewInit {
  roleTemplate = viewChild<TemplateRef<any>>('roleTemplate');
  enabledTemplate = viewChild<TemplateRef<any>>('enabledTemplate');

  templateMap: Map<keyof User | string, TemplateRef<any>> | undefined;
  emailNaoVerificado = signal(false);

  userService = inject(UserService);
  confirmationService = inject(ConfirmationService);
  messageService = inject(MessageService);
  formBuilder = inject(FormBuilder);
  telefonePipe = inject(TelefonePipe);

  form: FormGroup = this.formBuilder.group({
    id: [{ value: null, disabled: true }],
    email: [null, Validators.compose([Validators.required, Validators.email, utfprEmailValidator()])],
    nome: [null, Validators.required],
    telefone: [null],
    documento: [null],
    role: [null, Validators.required],
    password: [null, Validators.compose([Validators.minLength(6), passwordStrengthValidator()])],
    enabled: [true],
  });

  cols: Column<User>[] = [
    { field: 'email', header: 'E-mail' },
    { field: 'nome', header: 'Nome' },
    {
      field: 'telefone',
      header: 'Telefone',
      transform: (row: User) => this.telefonePipe.transform(row.telefone),
    },
    { field: 'documento', header: 'RA/SIAPE' },
    {
      field: 'role',
      header: 'Perfil',
      transform: (row: User) => this.roleLabel(row.role),
    },
    {
      field: 'enabled',
      header: 'Status',
      transform: (row: User) => (row.enabled ? 'Ativo' : 'Inativo'),
    },
  ];

  config: CrudConfig<User> = {
    title: 'Usuários',
  };

  roleOptions = [
    { label: 'Admin', value: 'ROLE_ADMIN' },
    { label: 'Professor', value: 'ROLE_PROFESSOR' },
    { label: 'Laboratorista', value: 'ROLE_LAB_TECHNICIAN' },
    { label: 'Aluno', value: 'ROLE_STUDENT' },
  ];

  enabledOptions = [
    { label: 'Ativo', value: true },
    { label: 'Inativo', value: false },
  ];

  filtroNome = model<string | undefined>();
  filtroDocumento = model<string | undefined>();
  idFilter = model<string | undefined>();
  filtroRole = model<string | undefined>();
  filtroEnabled = model<boolean | null | undefined>();

  searchRequest = computed<SearchRequest>(() => {
    const filters = [];
    if (this.idFilter())
      filters.push({ field: 'id', value: this.idFilter(), type: 'EQUALS' });
    if (this.filtroNome())
      filters.push({ field: 'nome', value: this.filtroNome(), type: 'ILIKE' });
    if (this.filtroDocumento())
      filters.push({
        field: 'documento',
        value: this.filtroDocumento(),
        type: 'ILIKE',
      });
    if (this.filtroRole())
      filters.push({ field: 'role', value: this.filtroRole(), type: 'EQUALS' });
    if (this.filtroEnabled() !== undefined && this.filtroEnabled() !== null)
      filters.push({ field: 'enabled', value: this.filtroEnabled(), type: 'EQUALS' });
    return <SearchRequest>{ filters };
  });

  ngAfterViewInit(): void {
    this.templateMap = new Map([
      ['role', this.roleTemplate()!],
      ['enabled', this.enabledTemplate()!],
    ]);
  }

  roleLabel(role?: string): string {
    return this.roleOptions.find((o) => o.value === role)?.label ?? role ?? '';
  }

  roleSeverity(role?: string): 'danger' | 'info' | 'warn' | 'secondary' {
    const map: Record<string, 'danger' | 'info' | 'warn' | 'secondary'> = {
      ROLE_ADMIN: 'danger',
      ROLE_PROFESSOR: 'info',
      ROLE_LAB_TECHNICIAN: 'warn',
      ROLE_STUDENT: 'secondary',
    };
    return map[role ?? ''] ?? 'secondary';
  }

  onEntityLoad(user: User) {
    this.emailNaoVerificado.set(user.emailVerificado === false);
  }

  onCancel() {
    this.emailNaoVerificado.set(false);
  }

  grantClearance(user: User) {
    this.confirmationService.confirm({
      header: 'Atenção!',
      message:
        'Ao emitir o documento de nada consta, o usuário será inativado no sistema. Deseja realmente emitir o documento?',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      rejectButtonStyleClass: 'p-button-secondary',
      accept: () => this._grantClearance(user),
    });
  }

  private _grantClearance(user: User) {
    this.userService
      .grantClearance(user)
      .pipe(
        take(1),
        tap(() => {
          this.messageService.add({
            severity: 'success',
            summary: 'Sucesso!',
            detail: 'Documento emitido com sucesso.',
          });
        }),
        catchError((err) => {
          this.messageService.add({
            severity: 'warn',
            summary: 'Atenção!',
            detail: err?.error?.message ||  'Falha ao emitir o documento.',
          });
          return err;
        }),
      )
      .subscribe();
  }
}
