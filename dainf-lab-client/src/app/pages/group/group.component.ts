import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { Column, CrudConfig } from '@/shared/crud/crud';
import { CrudComponent } from '@/shared/crud/crud.component';
import { SearchFilter, SearchRequest } from '@/shared/models/search';
import { extractErrorMessage } from '@/shared/utils/error.utils';
import { Component, computed, inject, model } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { map } from 'rxjs';
import { User } from '../user/user';
import { UserService } from '../user/user.service';
import { Group } from './group';
import { GroupService } from './group.service';

@Component({
  standalone: true,
  imports: [
    CrudComponent,
    FormsModule,
    ReactiveFormsModule,
    InputContainerComponent,
    InputTextModule,
    MultiSelectModule,
    TextareaModule,
    ToggleSwitchModule,
  ],
  providers: [GroupService, UserService],
  selector: 'app-group',
  templateUrl: 'group.component.html',
})
export class GroupComponent {
  groupService = inject(GroupService);
  userService = inject(UserService);
  messageService = inject(MessageService);
  formBuilder = inject(FormBuilder);

  form: FormGroup = this.formBuilder.group({
    id: [{ value: null, disabled: true }],
    name: [null, Validators.required],
    description: [null],
    active: [true],
    users: [[] as User[]],
  });

  users = toSignal(
    this.userService
      .search({ rows: 1000, filters: [], sort: { field: 'nome', type: 'ASC' } })
      .pipe(map((page) => page.content)),
    { initialValue: [] as User[] },
  );

  cols: Column<Group>[] = [
    { field: 'id', header: 'Código' },
    { field: 'name', header: 'Nome' },
    { field: 'description', header: 'Descrição' },
    {
      field: 'active',
      header: 'Status',
      transform: (group) => (group.active ? 'Ativo' : 'Inativo'),
    },
  ];

  config: CrudConfig<Group> = {
    title: 'Grupos',
  };

  nameFilter = model<string | undefined>();
  activeFilter = model<boolean | null>(null);

  searchRequest = computed<SearchRequest>(() => {
    const filters: SearchFilter[] = [];
    if (this.nameFilter()) {
      filters.push({ field: 'name', value: this.nameFilter(), type: 'ILIKE' });
    }
    if (this.activeFilter() !== null) {
      filters.push({
        field: 'active',
        value: this.activeFilter(),
        type: 'EQUALS',
      });
    }
    return { filters };
  });

  onEntityLoad(group: Group) {
    this.groupService.getUsers(group.id).subscribe({
      next: (users) => this.form.patchValue({ users }),
      error: (error) => this.warn(`Falha ao carregar os usuários do grupo: ${extractErrorMessage(error)}`),
    });
  }

  onSaved({ id, item }: { id: number; item: Group & { users?: User[] } }) {
    const userIds = (item.users ?? []).map((user) => user.id);
    this.groupService.setUsers(id, userIds).subscribe({
      error: (error) => this.warn(`Grupo salvo, mas falhou ao vincular os usuários: ${extractErrorMessage(error)}`),
    });
  }

  private warn(detail: string) {
    this.messageService.add({ severity: 'warn', summary: 'Atenção!', detail });
  }
}
