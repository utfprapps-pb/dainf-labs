import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, model, signal, viewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ItemService } from '../item/item.service';

import { InputContainerComponent } from '@/shared/components/input-container/input-container.component';
import { SearchSelectComponent } from '@/shared/components/search-select/search-select.component';
import { StaticSelectComponent } from '@/shared/components/static-select/static-select.component';
import { SubItemFormComponent } from '@/shared/components/subitem-form/subitem-form.component';

import { Column, CrudConfig } from '@/shared/crud/crud';
import { CrudComponent } from '@/shared/crud/crud.component';
import { SearchFilter, SearchRequest } from '@/shared/models/search';
import { toSignal } from '@angular/core/rxjs-interop';

import { Issue, IssueItem } from './issue';
import { IssueService } from './issue.service';

import { LoanService } from '../loan/loan.service';
import { User } from '../user/user';
import { UserService } from '../user/user.service';

import { DatePickerModule } from 'primeng/datepicker';
import { FieldsetModule } from 'primeng/fieldset';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { Loan } from '../loan/loan';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CrudComponent,
    InputContainerComponent,
    InputTextModule,
    InputNumberModule,
    FieldsetModule,
    SubItemFormComponent,
    DatePickerModule,
    SearchSelectComponent,
    StaticSelectComponent,
    TextareaModule,
  ],
  providers: [IssueService, LoanService, UserService, DatePipe, ItemService],
  selector: 'app-issue',
  templateUrl: 'issue.component.html',
})
export class IssueComponent {
  issueService = inject(IssueService);
  userService = inject(UserService);
  itemService = inject(ItemService);
  loanService = inject(LoanService);
  formBuilder = inject(FormBuilder);
  datePipe = inject(DatePipe);

  crud = viewChild(CrudComponent);

  disabled = signal(false);

  hasAdvancedPrivileges = toSignal(this.userService.hasAdvancedPrivileges(), {
    initialValue: false,
  });

  config: CrudConfig<Issue> = {
    title: 'Saídas de Estoque',
    allowDeletion: false
  };

  form: FormGroup = this.formBuilder.group({
    id: [{ value: null, disabled: true }],
    date: [null, Validators.required],
    user: [null],
    loan: [null],
    observation: [null],
    items: [[], Validators.required],
  });

  issueItemForm: FormGroup = this.formBuilder.group({
    id: [null],
    item: [null, Validators.required],
    quantity: [null, [Validators.required, Validators.min(1)]],
  });

  cols: Column<Issue>[] = [
    { field: 'id', header: 'Código' },
    {
      field: 'date',
      header: 'Data da Saída',
      transform: (row) => this.datePipe.transform(row.date, 'dd/MM/yyyy') || '',
    },
    { field: 'user.nome', header: 'Responsável' },
    { field: 'observation', header: 'Observações' },
  ];

  issueItemCols: Column<IssueItem>[] = [
    { field: 'item.name', header: 'Item' },
    { field: 'quantity', header: 'Quantidade' },
  ];

  issueDateFilter = model<string | Date | undefined>();
  responsibleFilter = model<User | undefined>();
  raSiapeFilter = model<string | undefined>();
  idFilter = model<string | undefined>();

  searchRequest = computed<SearchRequest>(() => {
    const filters: SearchFilter[] = [];

    if (this.idFilter()) {
      filters.push({
        field: 'id',
        value: this.idFilter(),
        type: 'EQUALS',
      });
    }

    if (this.issueDateFilter()) {
      const dateValue = this.issueDateFilter();
      const date = dateValue instanceof Date ? dateValue : new Date(dateValue as string);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filters.push({
        field: 'date',
        value: [startOfDay.toISOString(), endOfDay.toISOString()],
        type: 'BETWEEN',
      });
    }

    if (this.hasAdvancedPrivileges() && this.responsibleFilter()) {
      filters.push({
        field: 'user.id',
        value: this.responsibleFilter()?.id,
        type: 'EQUALS',
      });
    }

    if (this.raSiapeFilter()) {
      filters.push({
        field: 'user.documento',
        value: this.raSiapeFilter(),
        type: 'ILIKE',
      });
    }

    return <SearchRequest>{ filters };
  });

  onEntityLoad(issue: Issue) {
    this.form.patchValue({
      date: new Date(issue.date),
    });

    setTimeout(() => {
      this.issueItemForm.disable();
      this.form.get('borrower')?.disable();

      this.issueItemForm.updateValueAndValidity();
      this.form.get('borrower')?.updateValueAndValidity();

      this.disabled.set(true);
    }, 100);
  }

  onCancel() {
    this.issueItemForm.enable();
    this.form.get('borrower')?.enable();

    this.issueItemForm.updateValueAndValidity();
    this.form.get('borrower')?.updateValueAndValidity();

    this.disabled.set(false);
  }

  clearFilters() {
    this.idFilter.set(undefined);
    this.issueDateFilter.set(undefined);
    this.responsibleFilter.set(undefined);
    this.raSiapeFilter.set(undefined);
    this.crud()?.loadItems();
    this.crud()?.drawerVisible.set(false);
  }

  formatLoan(loan: Loan): string {
    const nome = loan.borrower ? loan.borrower.nome : 'N/A';
    const data = loan.loanDate ? new Date(loan.loanDate).toLocaleDateString('pt-BR') : '';
    return `${loan.id} - ${nome} - ${data}`;
  }
}
