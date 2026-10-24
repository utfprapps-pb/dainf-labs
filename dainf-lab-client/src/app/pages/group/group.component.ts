import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { Column, CrudConfig } from '@/shared/crud/crud';
import { CrudComponent } from '@/shared/crud/crud.component';
import { SearchFilter, SearchRequest } from '@/shared/models/search';
import { Component, computed, inject, model } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
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
    TextareaModule,
    ToggleSwitchModule,
  ],
  providers: [GroupService],
  selector: 'app-group',
  templateUrl: 'group.component.html',
})
export class GroupComponent {
  groupService = inject(GroupService);
  formBuilder = inject(FormBuilder);

  form: FormGroup = this.formBuilder.group({
    id: [{ value: null, disabled: true }],
    name: [null, Validators.required],
    description: [null],
    active: [true],
  });

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
}
